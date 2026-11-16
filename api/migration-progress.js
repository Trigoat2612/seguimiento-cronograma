import {getSql,json,readBody,failure} from '../lib/core.js';
import {requireEditor} from '../lib/editor-auth.js';

const MAX_TARGET=10_000_000;
const validCount=x=>Number.isSafeInteger(x)&&x>=0&&x<=MAX_TARGET;
const asDate=x=>{
 if(typeof x!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(x))return null;
 const ms=Date.parse(x);
 return Number.isFinite(ms)&&ms>=Date.parse('2026-01-01T00:00:00Z')&&ms<=Date.now()+5*60*1000?new Date(ms).toISOString():null;
};

export default async function handler(req,res){
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Método no permitido.'});
 const editor=req.method==='POST'?await requireEditor(req,res):null;
 if(req.method==='POST'&&!editor)return;
 try{
  const sql=getSql();
  if(req.method==='GET'){
   const rows=await sql`SELECT event_id,target_count,migrated_count,validated_count,
     reported_at,source_description,evidence_url,updated_by,created_at
     FROM seguimiento_cronograma.migration_progress_updates
     ORDER BY reported_at DESC,event_id DESC LIMIT 30`;
   return json(res,200,{
    latest:rows[0]||null,history:rows,
    reference:{carta331:15277,emd:15278,
      note:'Cifras referenciales del Plan de Operaciones de Salida v4.0, págs. 5–6. El denominador requiere confirmación con la línea base de producción SIJ.'}
   });
  }
  const body=await readBody(req,7000);
  const {targetCount,migratedCount,validatedCount,reportedAt,sourceDescription,evidenceUrl}=body;
  if(!validCount(targetCount)||targetCount<1||!validCount(migratedCount)||migratedCount>targetCount)
   return json(res,400,{error:'El universo confirmado debe ser positivo y los migrados no deben superarlo.'});
  if(validatedCount!==null&&validatedCount!==undefined&&(!validCount(validatedCount)||validatedCount>migratedCount))
   return json(res,400,{error:'Los expedientes validados no pueden superar los migrados.'});
  const when=asDate(reportedAt);
  if(!when)return json(res,400,{error:'La fecha del corte debe ser válida y no puede estar en el futuro.'});
  const description=typeof sourceDescription==='string'?sourceDescription.trim():'';
  if(description.length<5||description.length>500)
   return json(res,400,{error:'Indica la fuente del corte (5 a 500 caracteres).'});
  const evidence=typeof evidenceUrl==='string'?evidenceUrl.trim():null;
  if(evidence&&(!/^https:\/\//i.test(evidence)||evidence.length>2000))
   return json(res,400,{error:'El enlace de evidencia debe ser HTTPS válido.'});
  if(evidence){
   try{const u=new URL(evidence);if(u.protocol!=='https:'||!u.hostname)throw Error('invalid')}
   catch{return json(res,400,{error:'El enlace de evidencia debe ser HTTPS válido.'})}
  }
  const validated=validatedCount===null||validatedCount===undefined?null:validatedCount;
  const rows=await sql`INSERT INTO seguimiento_cronograma.migration_progress_updates(
    target_count,migrated_count,validated_count,reported_at,source_description,evidence_url,updated_by
   ) VALUES (${targetCount},${migratedCount},${validated},${when},${description},${evidence||null},${editor.email})
   RETURNING event_id,target_count,migrated_count,validated_count,reported_at,
     source_description,evidence_url,updated_by,created_at`;
  return json(res,201,{update:rows[0]});
 }catch(e){return failure(res,e)}
}
