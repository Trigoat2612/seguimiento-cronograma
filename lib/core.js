import {neon} from '@neondatabase/serverless';
export const STATUSES=['Pendiente','En curso','Completada','Bloqueada','No aplica'];
export const getSql=()=>{if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL sin configurar');return neon(process.env.DATABASE_URL)};
export const json=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))};
// La comprobación del origen reduce peticiones accidentales desde otras páginas, pero NO es autenticación.
export const hasValidOrigin=req=>{
 const origin=req.headers.origin;
 if(!origin)return false;
 try{
  const host=req.headers['x-forwarded-host']||req.headers.host;
  const protocol=req.headers['x-forwarded-proto']||(String(host).startsWith('localhost:')?'http':'https');
  return new URL(origin).origin===`${protocol}://${host}`;
 }catch{return false}
};
export const guard=(req,res,mutating=false)=>{if(mutating&&!hasValidOrigin(req)){json(res,403,{error:'Origen de petición no permitido.'});return false}return true};
// Vercel puede entregar req.body ya parseado; Node local entrega un stream.
export const readBody=async(req,maxBytes=200_000)=>{
 const parsed=req.body;
 let raw;
 if(parsed!==undefined&&parsed!==null){
   raw=Buffer.isBuffer(parsed)?parsed.toString('utf8'):typeof parsed==='string'?parsed:JSON.stringify(parsed);
   if(Buffer.byteLength(raw,'utf8')>maxBytes)throw Error('Solicitud demasiado grande');
 }else{
   const chunks=[];let n=0;
   for await(const c of req){n+=c.length;if(n>maxBytes)throw Error('Solicitud demasiado grande');chunks.push(c)}
   raw=Buffer.concat(chunks).toString('utf8');
 }
 try{const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid');return body}
 catch{throw Error('JSON no válido')}
};
export const failure=(res,e)=>{
 console.error('[seguimiento-cronograma]',e?.code||'error',e?.message);
 const code=e?.message?.includes('DATABASE_URL sin configurar')?'DB_ENV_MISSING':e?.code==='42P01'?'DB_SCHEMA_MISSING':e?.code==='28P01'?'DB_LOGIN_FAILED':'API_FAILED';
 const size=e?.message?.includes('demasiado grande');
 json(res,size?413:code==='DB_ENV_MISSING'?503:500,{error:size?'Solicitud demasiado grande':'No se pudo completar la operación. Revisa la configuración del servidor.',code:size?'REQUEST_TOO_LARGE':code});
};
