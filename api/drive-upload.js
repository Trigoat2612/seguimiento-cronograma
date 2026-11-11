import {json, guard, getSql} from '../lib/core.js';
import {
  ACTIVITY_IDS, MAX_UPLOADS_PER_IP_HOUR, MAX_UPLOADS_GLOBAL_DAY,
  UploadError, header, decodeHeader, safeName,
  requireUploadCode, clientHash, readLimitedFile, validateFile, uploaderName,
  driveConfig, getAccessToken, saveToDrive, cleanupDrive
} from '../lib/drive-upload.js';

export const config = { api: { bodyParser: false } };

const respond = (res, error) => {
  if (error instanceof UploadError) return json(res,error.status,{error:error.message,code:error.code});
  console.error('[drive-evidence]', error?.code || 'unknown', error?.message || '');
  return json(res,500,{error:'No fue posible completar el registro de la evidencia.',code:'UPLOAD_FAILED'});
};
async function markAttempt(sql, id, state, driveId = null) {
  try {
    await sql`UPDATE seguimiento_cronograma.operational_upload_attempts
      SET state=${state}, drive_file_id=${driveId}, finished_at=now()
      WHERE upload_id=${id}`;
  } catch (e) { console.error('[drive-upload-state]',e?.code||'',e?.message||''); }
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res,405,{error:'Método no permitido.'});
  if (!guard(req,res,true)) return;

  let sql, attemptId, driveFile, token;
  try {
    requireUploadCode(req);
    const google = driveConfig();
    const id = String(req.query?.activityId || '');
    if (!ACTIVITY_IDS.has(id)) throw new UploadError('INVALID_ACTIVITY','Código de actividad no válido.');
    const filename = decodeHeader(header(req,'x-file-name'), 'nombre del archivo');
    const uploader = uploaderName(decodeHeader(header(req,'x-uploaded-by'),'responsable'));
    if (uploader === 'Sin identificar') {
      throw new UploadError('MISSING_UPLOADER','Indica quién está registrando la evidencia.');
    }
    const buffer = await readLimitedFile(req);
    const {mime, filename:cleanName} = validateFile(buffer,header(req,'content-type'),filename);
    sql = getSql();
    const hashedIP = clientHash(req);

    // Cuotas preventivas tras validar el código.
    const admitted = await sql`WITH usage AS (
      SELECT
        count(*) FILTER(WHERE uploader_hash=${hashedIP}
          AND created_at>now()-interval '1 hour')::int AS per_ip,
        count(*) FILTER(WHERE created_at>now()-interval '1 day')::int AS daily
      FROM seguimiento_cronograma.operational_upload_attempts
      WHERE state IN ('started','stored','orphaned')
    ), reserved AS (
      INSERT INTO seguimiento_cronograma.operational_upload_attempts
        (activity_id, uploader_hash, uploader, filename, mime_type, size_bytes, state)
      SELECT ${id},${hashedIP},${uploader},${safeName(cleanName)},
             ${mime},${buffer.length},'started'
      FROM usage WHERE usage.per_ip<${MAX_UPLOADS_PER_IP_HOUR}
        AND usage.daily<${MAX_UPLOADS_GLOBAL_DAY}
      RETURNING upload_id
    ) SELECT upload_id FROM reserved`;
    if (!admitted.length) throw new UploadError('UPLOAD_QUOTA','Límite de cargas alcanzado. Intenta más tarde.',429);
    attemptId = admitted[0].upload_id;

    token = await getAccessToken(google);
    driveFile = await saveToDrive({
      buffer,mime,filename:cleanName,activityId:id,
      uploader,folderId:google.GOOGLE_DRIVE_FOLDER_ID,token
    });
    try {
      await sql`INSERT INTO seguimiento_cronograma.operational_status(id)
        VALUES(${id}) ON CONFLICT DO NOTHING`;
      const label = cleanName;
      const results = await sql`WITH saved AS (
        INSERT INTO seguimiento_cronograma.operational_evidence
          (activity_id,label,url,created_by,drive_file_id)
        VALUES (${id},${label},${driveFile.url},${uploader},${driveFile.id})
        RETURNING evidence_id,activity_id,label,url,created_by,created_at,drive_file_id
      ), history AS (
        INSERT INTO seguimiento_cronograma.operational_history
          (activity_id,status,notes,changed_by,action)
        SELECT saved.activity_id, s.status, saved.label, ${uploader}, 'archivo_drive'
        FROM saved JOIN seguimiento_cronograma.operational_status s
          ON saved.activity_id=s.id
        RETURNING event_id
      ) SELECT * FROM saved`;
      if (!results.length) throw Error('Evidencia no insertada');
      await markAttempt(sql,attemptId,'stored',driveFile.id);
      return json(res,201,{evidence:results[0],stored_in:'google_drive'});
    } catch (dbError) {
      const cleaned = await cleanupDrive(driveFile.id,token);
      await markAttempt(sql,attemptId,cleaned?'failed':'orphaned',driveFile.id);
      console.error('[drive-evidence-db]',dbError?.code||'',dbError?.message||'');
      throw new UploadError('DB_SAVE_FAILED',
        cleaned?'No se pudo vincular la evidencia a Neon; se revirtió la carga en Drive.':
          'La carga llegó a Drive, pero falló su registro en Neon. Comunica el incidente al administrador.',502);
    }
  } catch (e) {
    if (sql && attemptId && !driveFile) await markAttempt(sql,attemptId,'failed');
    return respond(res,e);
  }
}
