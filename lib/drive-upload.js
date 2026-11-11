import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_UPLOADS_PER_IP_HOUR = 10;
export const MAX_UPLOADS_GLOBAL_DAY = 120;
export const ALLOWED_MIME = Object.freeze({
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg']
});
// Identificadores de las 23 filas del cronograma oficial.
// La lista impide almacenar evidencias bajo identificadores arbitrarios.
export const ACTIVITY_IDS = new Set([
  'a3','a4','a2','a5','go','a6','b2','b5','b1','b3','b9','b4',
  'b6-b7-b8','c1','c2','c5','c7','c3','c4','c4-r','c5-1','c5-2','d2'
]);

export class UploadError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.status = status;
  }
}
export const header = (req, key) => {
  const value = req.headers?.[key.toLowerCase()];
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] || '' : '';
};
export function decodeHeader(value, label) {
  try { return decodeURIComponent(value || ''); }
  catch { throw new UploadError('BAD_HEADER', 'El campo '+label+' tiene una codificación inválida.'); }
}
export function safeName(input) {
  const last = String(input || '').split(/[\\/]/).pop();
  return last.normalize('NFC').replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .replace(/^\.+/, '').replace(/\s+/g, ' ').trim().slice(0,120);
}
export function validateFile(buffer, contentType, fileName) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    throw new UploadError('EMPTY_FILE', 'El archivo está vacío o no tiene un formato válido.');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadError('TOO_LARGE', 'El máximo permitido es 3 MiB por archivo.', 413);
  }
  const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  const allowedExtensions = ALLOWED_MIME[mime];
  if (!allowedExtensions) {
    throw new UploadError('UNSUPPORTED_TYPE', 'Solo se admiten PDF, PNG y JPG.', 415);
  }
  const filename = safeName(fileName);
  if (!filename || !allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext))) {
    throw new UploadError('EXTENSION_MISMATCH', 'La extensión no coincide con el tipo del archivo.');
  }
  const pdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const png = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg = buffer.subarray(0, 3).equals(Buffer.from([255,216,255]));
  if (!(mime === 'application/pdf' && pdf ||
        mime === 'image/png' && png ||
        mime === 'image/jpeg' && jpg)) {
    throw new UploadError('INVALID_SIGNATURE', 'El contenido del archivo no corresponde al formato indicado.');
  }
  return { mime, filename };
}
export function requireUploadCode(req, secret = process.env.EVIDENCE_UPLOAD_CODE) {
  if (typeof secret !== 'string' || secret.length < 16) {
    throw new UploadError('UPLOAD_NOT_CONFIGURED', 'La carga no está habilitada en este entorno.', 503);
  }
  const sent = Buffer.from(header(req, 'x-evidence-upload-code'), 'utf8');
  const required = Buffer.from(secret, 'utf8');
  if (sent.length !== required.length || !timingSafeEqual(sent, required)) {
    throw new UploadError('WRONG_UPLOAD_CODE', 'Código de carga incorrecto.', 403);
  }
}
export function clientHash(req, secret = process.env.EVIDENCE_UPLOAD_CODE) {
  // Útil para limitar cargas; evita guardar IPs en texto claro.
  const ip = header(req,'x-forwarded-for').split(',')[0].trim() ||
    req.socket?.remoteAddress || 'sin-ip';
  return createHmac('sha256', secret).update(ip).digest('hex');
}
export async function readLimitedFile(req) {
  const size = Number(header(req, 'content-length'));
  if (Number.isFinite(size) && size > MAX_UPLOAD_BYTES) {
    throw new UploadError('TOO_LARGE', 'El máximo permitido es 3 MiB por archivo.', 413);
  }
  if (req.body != null) {
    const val = req.body;
    const body = Buffer.isBuffer(val) ? val :
      val instanceof Uint8Array ? Buffer.from(val) :
      typeof val === 'string' ? Buffer.from(val, 'binary') : null;
    if (!body) throw new UploadError('BAD_BODY', 'Se esperaba un archivo binario.');
    if (body.length > MAX_UPLOAD_BYTES) throw new UploadError('TOO_LARGE','El máximo permitido es 3 MiB por archivo.',413);
    return body;
  }
  const chunks = []; let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_UPLOAD_BYTES) throw new UploadError('TOO_LARGE', 'El máximo permitido es 3 MiB por archivo.', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function uploaderName(value) {
  const text = String(value || '').trim().replace(/[\r\n<>]/g, ' ');
  return text && text.length <= 100 ? text : 'Sin identificar';
}
export function driveConfig(env = process.env) {
  const keys = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET',
    'GOOGLE_OAUTH_REFRESH_TOKEN', 'GOOGLE_DRIVE_FOLDER_ID'];
  if (keys.some(key => !env[key])) {
    throw new UploadError('DRIVE_NOT_CONFIGURED', 'Faltan credenciales de Google Drive en el servidor.', 503);
  }
  return Object.fromEntries(keys.map(k => [k, env[k]]));
}
export async function getAccessToken(config, requester = fetch) {
  let response;
  try {
    response = await requester('https://oauth2.googleapis.com/token', {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({
        client_id:config.GOOGLE_OAUTH_CLIENT_ID,
        client_secret:config.GOOGLE_OAUTH_CLIENT_SECRET,
        refresh_token:config.GOOGLE_OAUTH_REFRESH_TOKEN,
        grant_type:'refresh_token'
      }), signal:AbortSignal.timeout(15000)
    });
  } catch {
    throw new UploadError('TOKEN_UNAVAILABLE', 'No se pudo contactar con Google para autorizar la carga.', 502);
  }
  if (!response.ok) throw new UploadError('TOKEN_REJECTED', 'Google rechazó las credenciales configuradas.', 502);
  const data = await response.json();
  if (!data.access_token || typeof data.access_token !== 'string') {
    throw new UploadError('TOKEN_UNAVAILABLE', 'Google no entregó un token de acceso.', 502);
  }
  return data.access_token;
}
export async function saveToDrive({buffer, mime, filename, activityId, uploader, token, folderId, requester = fetch}) {
  const boundary = 'drive_' + randomUUID().replaceAll('-','');
  const now = new Date().toISOString().replace(/[:.]/g,'-');
  const destinationName = activityId.toUpperCase() + '_' + now + '_' + filename;
  const metadata = JSON.stringify({
    name:destinationName, parents:[folderId],mimeType:mime,
    description:'Evidencia de migración '+activityId.toUpperCase()+'; registrada por '+uploader
  });
  const before = Buffer.from('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'
    +metadata+'\r\n--'+boundary+'\r\nContent-Type: '+mime+'\r\n\r\n');
  const after = Buffer.from('\r\n--'+boundary+'--\r\n');
  const multipart = Buffer.concat([before,buffer,after]);
  let response;
  try {
    response = await requester('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink', {
      method:'POST',
      headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/related; boundary='+boundary},
      body:multipart, signal:AbortSignal.timeout(60000)
    });
  } catch {
    throw new UploadError('DRIVE_UNAVAILABLE','Google Drive no respondió durante la carga.',502);
  }
  if (!response.ok) {
    // No devolver detalles crudos del proveedor: podrían contener datos internos.
    throw new UploadError('DRIVE_REJECTED',
      response.status===403?'Google Drive rechazó la carga; revisa permisos y alcance OAuth.':
      'Google Drive no pudo almacenar el archivo.',502);
  }
  const data = await response.json();
  if (!/^[A-Za-z0-9_-]{10,}$/.test(data.id || '')) {
    throw new UploadError('DRIVE_BAD_RESPONSE','Google Drive no devolvió un ID de archivo válido.',502);
  }
  return {
    id:data.id, name:data.name||destinationName,
    url:(typeof data.webViewLink === 'string' && data.webViewLink.startsWith('https://'))
      ? data.webViewLink : 'https://drive.google.com/file/d/'+encodeURIComponent(data.id)+'/view'
  };
}
export async function cleanupDrive(fileId, token, requester = fetch) {
  try {
    const r = await requester('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId)+'?supportsAllDrives=true',{
      method:'DELETE',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)
    });
    return r.ok;
  } catch { return false; }
}
