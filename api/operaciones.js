import { timingSafeEqual } from 'node:crypto';
import { getSql, json, guard, readBody, failure } from '../lib/core.js';

const statuses = new Set(['Sin confirmar', 'En curso', 'Completada', 'Bloqueada', 'No aplica']);
const isId = value => typeof value === 'string' && /^[a-z0-9-]{2,18}$/.test(value);
const editorName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 100 ? value.trim() : 'Sin identificar';
const writeAllowed = (req, res) => {
  if (!guard(req, res, true)) return false;
  const secret = process.env.OPERACIONES_EDITOR_KEY || '';
  if (secret.length < 12) { json(res, 503, { error: 'Edición deshabilitada: falta configurar OPERACIONES_EDITOR_KEY (mínimo 12 caracteres).' }); return false; }
  const sent = req.headers['x-operaciones-editor'];
  const a = Buffer.from(typeof sent === 'string' ? sent : '');
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) { json(res, 403, { error: 'Clave de edición incorrecta.' }); return false; }
  return true;
};
export default async function handler(req, res) {
  if (!['GET','PATCH','POST','DELETE'].includes(req.method)) return json(res,405,{error:'Método no permitido.'});
  if (req.method!=='GET'&&!writeAllowed(req,res)) return;
  try {
    const sql=getSql();
    if (req.method==='GET') {
      const id=String(req.query?.id||'');
      if (!id) {
        const activities=await sql`SELECT s.id,s.status,s.notes,s.actual_at,s.version,s.updated_at,s.updated_by,
          COUNT(e.evidence_id)::integer AS evidence_count
          FROM seguimiento_cronograma.operational_status s
          LEFT JOIN seguimiento_cronograma.operational_evidence e ON e.activity_id=s.id
          GROUP BY s.id ORDER BY s.id`;
        return json(res,200,{activities});
      }
      if (!isId(id))return json(res,400,{error:'Identificador de actividad inválido.'});
      const [evidence,history]=await Promise.all([
        sql`SELECT evidence_id,activity_id,label,url,created_at,created_by FROM seguimiento_cronograma.operational_evidence WHERE activity_id=${id} ORDER BY created_at DESC LIMIT 100`,
        sql`SELECT event_id,status,notes,action,changed_by,changed_at FROM seguimiento_cronograma.operational_history WHERE activity_id=${id} ORDER BY event_id DESC LIMIT 50`
      ]);
      return json(res,200,{evidence,history});
    }
    const body=await readBody(req,20000);
    const id=body.id;
    if (!isId(id))return json(res,400,{error:'Código de actividad inválido.'});
    const changedBy=editorName(body.changedBy);
    if (req.method==='PATCH') {
      const {status,notes,actualAt,version}=body;
      if (!statuses.has(status)||typeof notes!=='string'||notes.length>10000||!Number.isSafeInteger(version)||version<0)return json(res,400,{error:'Estado, nota o versión inválidos.'});
      if(actualAt!==null&&actualAt!==undefined&&(typeof actualAt!=='string'||Number.isNaN(Date.parse(actualAt))))return json(res,400,{error:'Fecha/hora real inválida.'});
      const actual=actualAt||null;
      const rows=await sql`WITH changed AS (
        INSERT INTO seguimiento_cronograma.operational_status AS s
         (id,status,notes,actual_at,version,updated_at,updated_by)
        VALUES (${id},${status},${notes},${actual},1,now(),${changedBy})
        ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,notes=EXCLUDED.notes,
         actual_at=EXCLUDED.actual_at,version=s.version+1,updated_at=now(),updated_by=EXCLUDED.updated_by
        WHERE s.version=${version}
        RETURNING s.id,s.status,s.notes,s.actual_at,s.version,s.updated_at,s.updated_by
       ), recorded AS (
        INSERT INTO seguimiento_cronograma.operational_history(activity_id,status,notes,changed_by,action)
        SELECT id,status,notes,updated_by,'estado' FROM changed RETURNING event_id
       ) SELECT * FROM changed`;
      if(rows.length)return json(res,200,{activity:rows[0]});
      return json(res,409,{error:'La actividad fue actualizada desde otra sesión. Actualiza el tablero y vuelve a intentarlo.'});
    }
    if (req.method==='POST') {
      const {label,url}=body;
      if(typeof label!=='string'||!label.trim()||label.length>200||typeof url!=='string'||url.length>2048)return json(res,400,{error:'Completa título y enlace HTTPS.'});
      try { const u=new URL(url); if(u.protocol!=='https:'||!u.hostname)throw Error('no https'); } catch { return json(res,400,{error:'La evidencia debe ser una URL HTTPS válida.'}); }
      const rows=await sql`WITH ensured AS (
        INSERT INTO seguimiento_cronograma.operational_status(id) VALUES(${id}) ON CONFLICT DO NOTHING RETURNING id
      ), added AS (
        INSERT INTO seguimiento_cronograma.operational_evidence(activity_id,label,url,created_by)
        VALUES(${id},${label.trim()},${url.trim()},${changedBy})
        RETURNING evidence_id,activity_id,label,url,created_at,created_by
      ), recorded AS (
        INSERT INTO seguimiento_cronograma.operational_history(activity_id,status,notes,changed_by,action)
        SELECT ${id}, 'Sin confirmar', ${label.trim()}, ${changedBy}, 'evidencia_añadida' FROM added RETURNING event_id
      ) SELECT * FROM added`;
      return json(res,201,{evidence:rows[0]});
    }
    const {evidenceId}=body;
    if(typeof evidenceId!=='string'||!/^[a-f0-9-]{36}$/i.test(evidenceId))return json(res,400,{error:'Identificador de evidencia inválido.'});
    const rows=await sql`WITH removed AS (
      DELETE FROM seguimiento_cronograma.operational_evidence
      WHERE evidence_id=${evidenceId}::uuid AND activity_id=${id}
      RETURNING activity_id,label
     ), recorded AS (
      INSERT INTO seguimiento_cronograma.operational_history(activity_id,status,notes,changed_by,action)
      SELECT activity_id,'Sin confirmar',label,${changedBy},'evidencia_eliminada' FROM removed RETURNING event_id
     ) SELECT activity_id FROM removed`;
    return json(res,200,{removed:rows.length>0});
  } catch (e) { return failure(res,e); }
}