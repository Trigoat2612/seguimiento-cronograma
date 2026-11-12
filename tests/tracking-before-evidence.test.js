import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const first=html.indexOf('let trackingBaseline=null,formBusy=false;');
const last=html.indexOf('function exportCsv(){',first);
assert.ok(first>0&&last>first,'No se encontró el bloque de guardado');
const operations=html.slice(first,last);

function fixture(){
 const elems={
  'activity-status':{value:'Sin confirmar'},
  'activity-notes':{value:'Nota anterior'},
  'activity-editor':{value:'Operador'},
  'activity-actual':{value:''},
  'evidence-label':{value:'Acta de prueba'},
  'evidence-url':{value:'https://drive.google.com/file/d/ejemplo/view'},
  'drive-file':{files:[{size:55,name:'evidencia.pdf',type:'application/pdf'}]},
  'upload-info':{textContent:''},
  'save-activity':{disabled:false,isConnected:true},
  'add-evidence':{disabled:false,isConnected:true},
  'drive-submit':{disabled:false,isConnected:true}
 };
 const records={a3:{id:'a3',status:'Sin confirmar',notes:'Nota anterior',version:2,
  updated_by:'Operador',actual_at:null,evidence_count:0}};
 const events=[], alerts=[];
 const cfg={failPatch:false,failUpload:false};
 let closed=0,shown=0;
 const ctx={
  $:id=>elems[id], records, demo:false, connected:true,
  stateFor:id=>records[id],
  api:async(url,options)=>{
   const body=JSON.parse(options.body);
   events.push({method:options.method,body});
   if(options.method==='PATCH'){
    if(cfg.failPatch)throw Error('Conflicto de versión');
    return {activity:{
     id:body.id,status:body.status,notes:body.notes,
     version:body.version+1,updated_by:body.changedBy,actual_at:body.actualAt,
     updated_at:'2026-11-11T20:00:00Z'
    }};
   }
   if(options.method==='POST')return {evidence:{evidence_id:'e1'}};
   if(options.method==='DELETE')return {removed:true};
   throw Error('Método inesperado');
  },
  fetch:async(url,options)=>{
   events.push({method:'DRIVE',url,headers:options.headers});
   if(cfg.failUpload)return {ok:false,status:502,json:async()=>({error:'Drive rechazó la carga'})};
   return {ok:true,status:201,json:async()=>({evidence:{evidence_id:'e1'}})};
  },
  render:()=>{}, localWrite:()=>{}, closeDialog:()=>{closed++},
  updateConnection:()=>{}, showActivity:async()=>{shown++},
  alert:m=>alerts.push(m), confirm:()=>true,
  console
 };
 vm.runInNewContext(operations+'\nthis.actions={readTrackingFields,persistTracking,saveActivity,uploadDriveEvidence,addEvidence,removeEvidence,limaDatetime,validActual,capture:()=>{trackingBaseline=readTrackingFields()}}',ctx);
 ctx.actions.capture();
 return {elems,events,alerts,cfg,records,actions:ctx.actions,get closed(){return closed},get shown(){return shown}};
}

test('añadir evidencia guarda estado y nota antes del enlace',async()=>{
 const f=fixture();
 f.elems['activity-notes'].value='Incidencia detectada y acuerdo de subsanación';
 f.elems['activity-status'].value='En curso';
 await f.actions.addEvidence('a3');
 assert.deepEqual(f.events.map(x=>x.method),['PATCH','POST']);
 assert.equal(f.events[0].body.notes,'Incidencia detectada y acuerdo de subsanación');
 assert.equal(f.events[0].body.status,'En curso');
 assert.equal(f.records.a3.notes,'Incidencia detectada y acuerdo de subsanación');
 assert.equal(f.records.a3.evidence_count,1);
 assert.equal(f.shown,1);
 assert.deepEqual(f.alerts,[]);
});
test('sin modificaciones superiores no crea PATCH innecesario',async()=>{
 const f=fixture();
 await f.actions.addEvidence('a3');
 assert.deepEqual(f.events.map(x=>x.method),['POST']);
 assert.equal(f.records.a3.version,2);
});
test('si falla el guardado no registra evidencia ni pierde texto del formulario',async()=>{
 const f=fixture();
 f.cfg.failPatch=true;
 f.elems['activity-notes'].value='Detalle sin guardar';
 await f.actions.addEvidence('a3');
 assert.deepEqual(f.events.map(x=>x.method),['PATCH']);
 assert.match(f.alerts[0],/Evidencia no guardada/);
 assert.equal(f.elems['activity-notes'].value,'Detalle sin guardar');
 assert.equal(f.shown,0);
});
test('Subir a Drive guarda primero la parte superior',async()=>{
 const f=fixture();
 f.elems['activity-notes'].value='Reporte técnico de incidencia';
 f.elems['activity-status'].value='Bloqueada';
 await f.actions.uploadDriveEvidence('a3');
 assert.deepEqual(f.events.map(x=>x.method),['PATCH','DRIVE']);
 assert.equal(f.events[0].body.notes,'Reporte técnico de incidencia');
 assert.equal(f.records.a3.evidence_count,1);
 assert.equal(f.shown,1);
});
test('si falla el PATCH no envía el archivo a Drive',async()=>{
 const f=fixture();
 f.cfg.failPatch=true;
 f.elems['activity-notes'].value='No perder';
 await f.actions.uploadDriveEvidence('a3');
 assert.deepEqual(f.events.map(x=>x.method),['PATCH']);
 assert.match(f.elems['upload-info'].textContent,/archivo no se envió/);
});
test('si falla Drive aclara que el seguimiento sí quedó guardado',async()=>{
 const f=fixture();
 f.cfg.failUpload=true;
 f.elems['activity-notes'].value='Guardado previo válido';
 await f.actions.uploadDriveEvidence('a3');
 assert.deepEqual(f.events.map(x=>x.method),['PATCH','DRIVE']);
 assert.equal(f.records.a3.notes,'Guardado previo válido');
 assert.match(f.elems['upload-info'].textContent,/seguimiento sí se guardaron/);
 assert.equal(f.records.a3.evidence_count,0);
});
test('eliminar evidencia también guarda primero los cambios superiores',async()=>{
 const f=fixture();
 f.elems['activity-notes'].value='Acuerdo antes de eliminar vínculo';
 await f.actions.removeEvidence('a3','e1');
 assert.deepEqual(f.events.map(x=>x.method),['PATCH','DELETE']);
 assert.equal(f.records.a3.notes,'Acuerdo antes de eliminar vínculo');
});
test('Guardar seguimiento sigue funcionando directamente',async()=>{
 const f=fixture();
 f.elems['activity-notes'].value='Validación realizada';
 await f.actions.saveActivity('a3');
 assert.deepEqual(f.events.map(x=>x.method),['PATCH']);
 assert.equal(f.closed,1);
 assert.equal(f.records.a3.notes,'Validación realizada');
});
test('fecha Lima se muestra sin desplazamiento de cinco horas',()=>{
 const f=fixture();
 assert.equal(f.actions.limaDatetime('2026-11-11T19:00:00.000Z'),'2026-11-11T14:00');
 assert.equal(f.actions.validActual('2026-11-11T14:00'),'2026-11-11T19:00:00.000Z');
});
test('no permite doble envío simultáneo',async()=>{
 const f=fixture();
 f.elems['activity-notes'].value='Incidencia';
 await Promise.all([f.actions.addEvidence('a3'),f.actions.addEvidence('a3')]);
 assert.deepEqual(f.events.map(x=>x.method),['PATCH','POST']);
});
