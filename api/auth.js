import {json, guard, readBody} from '../lib/core.js';
import {editorClientId, verifyEditorCredential, EditorAuthError} from '../lib/editor-auth.js';
export default async function handler(req,res) {
  if(req.method==='GET'){
    const clientId=editorClientId();
    return json(res,200,{configured:!!clientId,clientId});
  }
  if(req.method!=='POST')return json(res,405,{error:'Método no permitido.'});
  if(!guard(req,res,true))return;
  try {
    const body=await readBody(req,10000);
    const verified=await verifyEditorCredential(body.credential);
    return json(res,200,{authorized:true,email:verified.email,expiresAt:verified.expiresAt});
  }catch(e){
    if(e instanceof EditorAuthError)return json(res,e.status,{error:e.message,code:e.code});
    return json(res,400,{error:'No se pudo validar la solicitud.',code:'BAD_REQUEST'});
  }
}
