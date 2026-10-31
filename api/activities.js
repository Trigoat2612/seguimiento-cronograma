import {getSql,json,guard,readBody,STATUSES,failure} from '../lib/core.js';
export default async function handler(req,res){
 if(req.method==='GET'){
  if(!guard(req,res))return;
  try{const sql=getSql();const rows=await sql`SELECT id,extract(day from plan_date)::integer AS day,start_minute AS start,end_minute AS "end",title,category AS cat,owner,dependencies AS deps,description AS details,expected_result AS output,(end_minute-start_minute) AS duration,action_icon AS icon,contingency,status,notes AS note,version,updated_at AS updated,completed_at AS completed FROM seguimiento_cronograma.activities ORDER BY plan_date,start_minute,sort_order`;return json(res,200,{activities:rows})}catch(e){return failure(res,e)}
 }
 if(req.method!=='PATCH')return json(res,405,{error:'Método no permitido'});
 if(!guard(req,res,true))return;
 try{
  const body=await readBody(req,25000);const {id,status,note,version}=body;
  if(typeof id!=='string'||!/^([A-Z]\d{2})$/.test(id)||!Number.isSafeInteger(version)||version<1)return json(res,400,{error:'Identificador o versión no válida'});
  if(status!==undefined&&!STATUSES.includes(status))return json(res,400,{error:'Estado no válido'});
  if(note!==undefined&&(typeof note!=='string'||note.length>20000))return json(res,400,{error:'Observación no válida'});
  if(status===undefined&&note===undefined)return json(res,400,{error:'No hay cambios'});
  const sql=getSql(),nextStatus=status??null,nextNote=note??null;
  const rows=await sql`WITH changed AS (
   UPDATE seguimiento_cronograma.activities SET
     status=COALESCE(${nextStatus},status),
     notes=COALESCE(${nextNote},notes),
     completed_at=CASE WHEN COALESCE(${nextStatus},status)='Completada' THEN COALESCE(completed_at,now()) ELSE NULL END,
     started_at=CASE WHEN COALESCE(${nextStatus},status)='En curso' THEN COALESCE(started_at,now()) ELSE started_at END,
     version=version+1,updated_at=now(),updated_by='administrador'
   WHERE id=${id} AND version=${version} AND (status IS DISTINCT FROM COALESCE(${nextStatus},status) OR notes IS DISTINCT FROM COALESCE(${nextNote},notes))
   RETURNING id,status,notes,version,updated_at,completed_at
  ),logged AS (INSERT INTO seguimiento_cronograma.activity_history(activity_id,status,notes,version,changed_by)
      SELECT id,status,notes,version,'administrador' FROM changed RETURNING activity_id)
  SELECT c.id,c.status,c.notes AS note,c.version,c.updated_at AS updated,c.completed_at AS completed FROM changed c`;
  if(rows.length)return json(res,200,{activity:rows[0]});
  const existing=await sql`SELECT id,status,notes AS note,version,updated_at AS updated,completed_at AS completed FROM seguimiento_cronograma.activities WHERE id=${id}`;
  if(!existing.length)return json(res,404,{error:'Actividad no encontrada'});
  if(existing[0].version!==version)return json(res,409,{error:'La actividad fue modificada desde otra sesión. Actualiza los datos antes de guardar.',activity:existing[0]});
  return json(res,200,{activity:existing[0]});
 }catch(e){return failure(res,e)}
}
