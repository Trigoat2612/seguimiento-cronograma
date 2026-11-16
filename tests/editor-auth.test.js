import test from 'node:test';
import assert from 'node:assert/strict';
import {createSign,generateKeyPairSync} from 'node:crypto';
import {EDITOR_EMAILS,verifyEditorCredential,requireEditor} from '../lib/editor-auth.js';

const previousId=process.env.GOOGLE_EDITOR_CLIENT_ID;
process.env.GOOGLE_EDITOR_CLIENT_ID='editor-test.apps.googleusercontent.com';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const publicJwk=publicKey.export({format:'jwk'});
const previousFetch=globalThis.fetch;
globalThis.fetch=async url=>{
 assert.equal(url,'https://www.googleapis.com/oauth2/v3/certs');
 return {ok:true,json:async()=>({keys:[{...publicJwk,kid:'editor-test-key',use:'sig',alg:'RS256'}]})};
};
function tokenFor(overrides={}){
 const now=Math.floor(Date.now()/1000);
 const claims={
  iss:'https://accounts.google.com',aud:process.env.GOOGLE_EDITOR_CLIENT_ID,
  sub:'google-user-subject',email:'mtrigosoq@gmail.com',
  email_verified:true,iat:now,exp:now+3600,...overrides
 };
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const message=encode({alg:'RS256',kid:'editor-test-key',typ:'JWT'})+'.'+encode(claims);
 const sign=createSign('RSA-SHA256');
 sign.update(message);sign.end();
 return message+'.'+sign.sign(privateKey).toString('base64url');
}
test('solo ocho correos exactos pueden escribir',()=>{
 assert.equal(EDITOR_EMAILS.size,8);
 assert.ok(EDITOR_EMAILS.has('liz.yupanqui.pj@gmail.com'));
 assert.ok(EDITOR_EMAILS.has('lizyupanquipj@gmail.com'));
 assert.ok(!EDITOR_EMAILS.has('cualquier@gmail.com'));
});
test('acepta firma válida, audiencia correcta y correo autorizado',async()=>{
 const user=await verifyEditorCredential(tokenFor({email:'MTRIGOSOQ@gmail.com'}));
 assert.equal(user.email,'mtrigosoq@gmail.com');
 assert.ok(user.expiresAt>Date.now());
});
test('deniega cuentas externas aun con token auténtico',async()=>{
 await assert.rejects(()=>verifyEditorCredential(tokenFor({email:'externo@gmail.com'})),e=>e.code==='EDITOR_NOT_ALLOWED'&&e.status===403);
});
test('deniega correo no verificado, token vencido o audiencia falsa',async()=>{
 const now=Math.floor(Date.now()/1000);
 for(const override of [{email_verified:false},{exp:now-5},{aud:'otra-app.apps.googleusercontent.com'},{iss:'https://ejemplo.com'}]){
  await assert.rejects(()=>verifyEditorCredential(tokenFor(override)),e=>e.code==='INVALID_CREDENTIAL');
 }
});
test('deniega firma alterada o alg none',async()=>{
 const token=tokenFor();
 await assert.rejects(()=>verifyEditorCredential(token.slice(0,-4)+'AAAB'),e=>e.code==='INVALID_CREDENTIAL');
 const parts=token.split('.');
 const header=Buffer.from(JSON.stringify({alg:'none',kid:'editor-test-key'})).toString('base64url');
 await assert.rejects(()=>verifyEditorCredential(header+'.'+parts[1]+'.'+parts[2]),e=>e.code==='INVALID_CREDENTIAL');
});
test('ruta de escritura rechaza petición sin autenticación, incluso con Origin válido',async()=>{
 const req={headers:{origin:'https://seguimiento-cronograma-2qnh.vercel.app',host:'seguimiento-cronograma-2qnh.vercel.app',authorization:''}};
 const res={statusCode:null,headers:{},setHeader(k,v){this.headers[k]=v},end(value){this.body=JSON.parse(value)}};
 const account=await requireEditor(req,res);
 assert.equal(account,null);
 assert.equal(res.statusCode,401);
 assert.equal(res.body.code,'LOGIN_REQUIRED');
});
test.after(()=>{
 globalThis.fetch=previousFetch;
 if(previousId===undefined)delete process.env.GOOGLE_EDITOR_CLIENT_ID;
 else process.env.GOOGLE_EDITOR_CLIENT_ID=previousId;
});
