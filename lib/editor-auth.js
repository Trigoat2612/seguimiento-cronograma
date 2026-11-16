import {createPublicKey, verify} from 'node:crypto';
import {guard, json} from './core.js';

// Lista cerrada: el correo enviado por el navegador nunca otorga permisos.
export const EDITOR_EMAILS = new Set([
  'liz.yupanqui.pj@gmail.com',
  'lizyupanquipj@gmail.com',
  'eduardo.siguas.pj@gmail.com',
  'mtrigosoq@gmail.com',
  'miguel.trigoso.pj@gmail.com',
  'freddy.ramirez.pj@gmail.com',
  'hernan.inga.pj@gmail.com',
  'jorge.vilca.pj@gmail.com'
]);
export const editorClientId = () => (
  process.env.GOOGLE_EDITOR_CLIENT_ID ||
  process.env.GOOGLE_OIDC_CLIENT_ID ||
  process.env.GOOGLE_OAUTH_CLIENT_ID ||
  ''
).trim();
export class EditorAuthError extends Error {
  constructor(code, message, status = 401) {
    super(message); this.code=code; this.status=status;
  }
}
const deny = (code='INVALID_CREDENTIAL',message='Sesión de Google no válida o vencida.',status=401) => {
  throw new EditorAuthError(code,message,status);
};
let cachedKeys=null,cachedUntil=0;
async function getGoogleKeys() {
  if(cachedKeys&&Date.now()<cachedUntil)return cachedKeys;
  try {
    const response=await fetch('https://www.googleapis.com/oauth2/v3/certs',{
      headers:{Accept:'application/json'},signal:AbortSignal.timeout(6000)
    });
    if(!response.ok)throw Error('JWKS HTTP '+response.status);
    const body=await response.json();
    if(!Array.isArray(body.keys)||!body.keys.length)throw Error('JWKS sin claves');
    cachedKeys=body.keys;cachedUntil=Date.now()+5*60*1000;
    return cachedKeys;
  }catch(e){
    console.error('[editor-auth] claves de Google no disponibles',e?.message);
    throw new EditorAuthError('AUTH_PROVIDER_UNAVAILABLE','No se pudo validar la identidad con Google.',503);
  }
}
export async function verifyEditorCredential(credential) {
  const clientId=editorClientId();
  if(!clientId)deny('AUTH_NOT_CONFIGURED','Acceso de editores pendiente de configuración.',503);
  if(typeof credential!=='string'||credential.length>8192||credential.length<100)deny();
  const parts=credential.split('.');
  if(parts.length!==3)deny();
  let header,claims;
  try {
    header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  }catch{deny()}
  if(!header||header.alg!=='RS256'||typeof header.kid!=='string'||!claims)deny();
  const keys=await getGoogleKeys();
  const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig')&&(!k.alg||k.alg==='RS256'));
  if(!jwk)deny();
  let validSignature=false;
  try {
    const publicKey=createPublicKey({key:jwk,format:'jwk'});
    validSignature=verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),publicKey,Buffer.from(parts[2],'base64url'));
  }catch{deny()}
  if(!validSignature)deny();
  const now=Math.floor(Date.now()/1000);
  const email=typeof claims.email==='string'?claims.email.trim().toLowerCase():'';
  if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||
     claims.aud!==clientId||(claims.azp&&claims.azp!==clientId)||
     typeof claims.exp!=='number'||claims.exp<=now||
     typeof claims.iat!=='number'||claims.iat>now+60||claims.iat<now-7200||
     (claims.nbf&&claims.nbf>now+60)||
     claims.email_verified!==true||
     typeof claims.sub!=='string'||!claims.sub||!email)deny();
  if(!EDITOR_EMAILS.has(email))
    deny('EDITOR_NOT_ALLOWED','La cuenta de Google autenticada no tiene permiso de edición.',403);
  return {email,sub:claims.sub,expiresAt:claims.exp*1000};
}
export async function requireEditor(req,res) {
  if(!guard(req,res,true))return null;
  const match=/^Bearer ([A-Za-z0-9._-]{100,8192})$/.exec(String(req.headers.authorization||''));
  if(!match){
    json(res,401,{error:'Inicia sesión con una cuenta autorizada para editar.',code:'LOGIN_REQUIRED'});
    return null;
  }
  try{return await verifyEditorCredential(match[1])}
  catch(e){
    if(e instanceof EditorAuthError){
      json(res,e.status,{error:e.message,code:e.code});return null;
    }
    console.error('[editor-auth] error inesperado',e?.message);
    json(res,503,{error:'No se pudo verificar la sesión de Google.',code:'AUTH_UNAVAILABLE'});
    return null;
  }
}
