import {verifySession,issueSession,cookie,json,readBody,hasValidOrigin} from '../lib/core.js';
import {timingSafeEqual} from 'node:crypto';
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
export default async function handler(req,res){
 if(req.method==='GET')return json(res,200,{authenticated:verifySession(req)});
 if(req.method==='DELETE'){if(!hasValidOrigin(req))return json(res,403,{error:'Origen no válido'});res.setHeader('Set-Cookie',cookie('',0));return json(res,200,{ok:true})}
 if(req.method!=='POST')return json(res,405,{error:'Método no permitido'});
 if(!hasValidOrigin(req))return json(res,403,{error:'Origen no válido'});
 if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<12||!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)return json(res,503,{error:'Falta configurar credenciales seguras en Vercel'});
 try{const body=await readBody(req,4096);if(typeof body.password!=='string'||!equal(body.password,process.env.ADMIN_PASSWORD))return json(res,401,{error:'Contraseña incorrecta'});res.setHeader('Set-Cookie',cookie(issueSession()));return json(res,200,{ok:true})}catch{return json(res,400,{error:'Solicitud no válida'})}
}
