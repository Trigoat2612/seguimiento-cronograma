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
export const readBody=async(req,maxBytes=200_000)=>{const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>maxBytes)throw Error('Solicitud demasiado grande');chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Error('JSON no válido')}};
export const failure=(res,e)=>{console.error('[seguimiento-cronograma]',e.message);json(res,e.message.includes('demasiado grande')?413:500,{error:'No se pudo completar la operación. Revisa la configuración del servidor.'})};
