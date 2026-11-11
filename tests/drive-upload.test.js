import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {
  ACTIVITY_IDS, ALLOWED_MIME, MAX_UPLOAD_BYTES, UploadError,
  safeName, validateFile, clientHash,
  readLimitedFile, driveConfig, getAccessToken, saveToDrive,
  uploaderName
} from '../lib/drive-upload.js';

const pdf=Buffer.from('%PDF-1.7\narchivo de prueba');
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0]);
const jpeg=Buffer.from([255,216,255,224,0,16,74,70,73,70,0]);

test('23 IDs de actividades del plan, no acepta códigos arbitrarios',()=>{
 assert.equal(ACTIVITY_IDS.size,23);
 assert.equal(ACTIVITY_IDS.has('a3'),true);
 assert.equal(ACTIVITY_IDS.has('c4-r'),true);
 assert.equal(ACTIVITY_IDS.has('otro'),false);
});
test('valida extensión y firma, incluso si el MIME fue falsificado',()=>{
 assert.equal(validateFile(pdf,'application/pdf','acta.pdf').mime,'application/pdf');
 assert.equal(validateFile(png,'image/png','prueba.png').mime,'image/png');
 assert.equal(validateFile(jpeg,'image/jpeg','foto.jpg').mime,'image/jpeg');
 assert.throws(()=>validateFile(pdf,'image/png','trampa.png'),e=>e.code==='INVALID_SIGNATURE');
 assert.throws(()=>validateFile(pdf,'application/pdf','acta.exe'),e=>e.code==='EXTENSION_MISMATCH');
 assert.throws(()=>validateFile(pdf,'application/zip','acta.zip'),e=>e.code==='UNSUPPORTED_TYPE');
 assert.throws(()=>validateFile(Buffer.alloc(0),'application/pdf','vacio.pdf'),e=>e.code==='EMPTY_FILE');
});
test('limita el peso de archivo a 3 MiB',()=>{
 assert.equal(MAX_UPLOAD_BYTES,3145728);
 assert.throws(()=>validateFile(Buffer.alloc(MAX_UPLOAD_BYTES+1),'application/pdf','inmenso.pdf'),e=>e.status===413);
});
test('normaliza nombres sin rutas ni separadores extraños',()=>{
 assert.equal(safeName('../../acta 1.pdf'),'acta 1.pdf');
 assert.equal(safeName('C:\\users\\documentos\\ acta.pdf'),' acta.pdf'.trim());
});
test('hash de cliente no divulga IP en registro',()=>{
 const req={headers:{'x-forwarded-for':'198.51.100.23, 10.0.0.1'}};
 const hash=clientHash(req,'OAuthSecretParaPrueba');
 assert.match(hash,/^[a-f0-9]{64}$/);
 assert.equal(hash.includes('198.51.100.23'),false);
});
test('cuota de carga usa el secreto OAuth existente',()=>{
 const req={headers:{'x-forwarded-for':'192.0.2.23'}};
 assert.throws(()=>clientHash(req,''),e=>e.code==='DRIVE_NOT_CONFIGURED');
 assert.equal(clientHash(req,'SecretOauth1'),clientHash(req,'SecretOauth1'));
 assert.notEqual(clientHash(req,'SecretOauth1'),clientHash(req,'SecretOauth2'));
});
test('rechaza un cuerpo binario demasiado grande, sin red',async()=>{
 const req=Readable.from([Buffer.alloc(MAX_UPLOAD_BYTES+1)]);
 req.headers={};
 await assert.rejects(()=>readLimitedFile(req),e=>e.status===413);
});
test('OAuth de Google se solicita del servidor, no en el navegador',async()=>{
 const conf={
  GOOGLE_OAUTH_CLIENT_ID:'test-client',
  GOOGLE_OAUTH_CLIENT_SECRET:'test-secret',
  GOOGLE_OAUTH_REFRESH_TOKEN:'test-refresh'
 };
 let called=false;
 const token=await getAccessToken(conf, async (url,opts)=>{
  called=true;
  assert.equal(url,'https://oauth2.googleapis.com/token');
  assert.equal(opts.body.get('grant_type'),'refresh_token');
  assert.equal(opts.body.get('refresh_token'),'test-refresh');
  return {ok:true,json:async()=>({access_token:'test-access-token'})};
 });
 assert.equal(called,true);
 assert.equal(token,'test-access-token');
});
test('multipart guarda metadatos de carpeta y el archivo sin publicarlo',async()=>{
 let body;
 const result=await saveToDrive({
  buffer:pdf,mime:'application/pdf',filename:'acta.pdf',
  activityId:'a3',uploader:'Validador',token:'test-access',
  folderId:'carpeta-prueba',
  requester:async (url,opts)=>{
   assert.match(url,/uploadType=multipart/);
   assert.equal(opts.headers.Authorization,'Bearer test-access');
   body=opts.body.toString('latin1');
   return {ok:true,json:async()=>({id:'abcdef1234567890',name:'acta.pdf'})};
  }
 });
 assert.match(body,/"parents":\["carpeta-prueba"\]/);
 assert.match(body,/%PDF-1.7/);
 assert.equal(result.id,'abcdef1234567890');
 assert.match(result.url,/drive.google.com/);
 assert.equal(body.includes('"anyone"'),false);
});
test('credenciales incompletas desactivan subida',()=>{
 assert.throws(()=>driveConfig({GOOGLE_OAUTH_CLIENT_ID:'a'}),e=>e.code==='DRIVE_NOT_CONFIGURED');
});

test('dashboard incluye formulario, evento de carga y JS válido',async()=>{
 const {readFile} = await import('node:fs/promises');
 const html = await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/id="drive-file"/);
 assert.doesNotMatch(html,/id="drive-code"/);
 assert.match(html,/id="drive-submit"/);
 assert.match(html,/async function uploadDriveEvidence/);
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'JS del dashboard no encontrado');
 assert.doesNotThrow(()=>new Function('async function validateModule(){\n'+script+'\n}'));
});

test('favicon personalizado PNG en la página y ruta local',async()=>{
 const {readFile} = await import('node:fs/promises');
 const index = await readFile(new URL('../index.html',import.meta.url),'utf8');
 const icon = await readFile(new URL('../favicon.png',import.meta.url));
 const server = await readFile(new URL('../server-local.mjs',import.meta.url),'utf8');
 assert.match(index, /<link rel="icon" href="\/favicon\.png" type="image\/png" sizes="64x64">/);
 assert.ok(icon.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
 assert.equal(icon.readUInt32BE(16),64);
 assert.equal(icon.readUInt32BE(20),64);
 assert.match(server,/url\.pathname==='\/favicon\.png'/);
});
