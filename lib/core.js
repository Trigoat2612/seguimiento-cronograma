import {createHmac,timingSafeEqual} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
const cookieName='sijeje_session';
export const STATUSES=['Pendiente','En curso','Completada','Bloqueada','No aplica'];
export const getSql=()=>{if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL sin configurar');return neon(process.env.DATABASE_URL)};
export const json=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));};
const sign=data=>createHmac('sha256',process.env.SESSION_SECRET||'').update(data).digest('base64url');
const safeEq=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
export const issueSession=()=>{const encoded=Buffer.from(JSON.stringify({u:'administrador',exp:Date.now()+8*3600*1000})).toString('base64url');return `${encoded}.${sign(encoded)}`};
export const cookie=(value,maxAge=28800)=>`${cookieName}=${value}; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=${maxAge}`;
export const verifySession=req=>{
 if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)return false;
 const raw=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(!raw)return false;const [encoded,sig]=raw.split('.');if(!encoded||!sig||!safeEq(sign(encoded),sig))return false;
 try{const p=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));return p.u==='administrador'&&Number.isFinite(p.exp)&&p.exp>Date.now()}catch{return false}
};
export const hasValidOrigin=req=>{const origin=req.headers.origin;if(!origin)return true;try{const o=new URL(origin);const host=req.headers['x-forwarded-host']||req.headers.host;return o.host===host&&o.protocol==='https:'}catch{return false}};
export const guard=(req,res,mutating=false)=>{if(!verifySession(req)){json(res,401,{error:'Sesión no válida. Ingresa nuevamente.'});return false}if(mutating&&!hasValidOrigin(req)){json(res,403,{error:'Origen de petición no permitido.'});return false}return true};
export const readBody=async(req,maxBytes=200_000)=>{const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>maxBytes)throw Error('Solicitud demasiado grande');chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Error('JSON no válido')}};
export const failure=(res,e)=>{console.error('[seguimiento-cronograma]',e.message);json(res,e.message.includes('demasiado grande')?413:500,{error:'No se pudo completar la operación. Revisa la configuración del servidor.'})};
