import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function phaseSnapshot(name){');
const end=html.indexOf('function renderPhases(){',start);
assert.ok(start>=0&&end>start,'No se encontró la función de estados por fase');
const code=html.slice(start,end);

const activities=[
 {id:'a',phase:'Preparación'},
 {id:'b',phase:'Preparación'},
 {id:'c',phase:'Ejecución',is_on_demand:true},
 {id:'d',phase:'Ejecución'},
 {id:'e',phase:'Ejecución'},
 {id:'f',phase:'Validación'},
 {id:'g',phase:'Monitoreo y cierre',is_continuous:true},
];
const states={
 a:{status:'Completada',evidence_count:1},
 b:{status:'Completada',evidence_count:0},
 c:{status:'En curso',evidence_count:0},
 d:{status:'Bloqueada',evidence_count:0},
 e:{status:'No aplica',evidence_count:0},
 f:{status:'Sin confirmar',evidence_count:0},
 g:{status:'En curso',evidence_count:0},
};
const ctx={
 PLAN:{activities},
 stateFor:id=>states[id],
 evCount:id=>Number(states[id]?.evidence_count||0),
};
vm.runInNewContext(code+'\nthis.snapshot=phaseSnapshot;',ctx);

test('Diferencia completadas con evidencia de completas sin evidencia',()=>{
 const p=ctx.snapshot('Preparación');
 assert.equal(p.total,2);
 assert.equal(p.complete,1);
 assert.equal(p.undocumented,1);
 assert.equal(p.active,0);
});
test('Incluye actividades a demanda y continuas en distribución de estados',()=>{
 const e=ctx.snapshot('Ejecución');
 assert.equal(e.total,3);
 assert.equal(e.active,1);
 assert.equal(e.blocked,1);
 assert.equal(e.notApplicable,1);
 const m=ctx.snapshot('Monitoreo y cierre');
 assert.equal(m.total,1);
 assert.equal(m.active,1);
});
test('Cada actividad se contabiliza exactamente en un estado por fase',()=>{
 for(const name of ['Preparación','Ejecución','Validación','Monitoreo y cierre']){
  const p=ctx.snapshot(name);
  assert.equal(p.complete+p.active+p.undocumented+p.blocked+p.unconfirmed+p.notApplicable,p.total);
 }
});
test('El panel muestra barras segmentadas y recuentos explícitos por fase',()=>{
 assert.match(html,/Estado de actividades por fase/);
 assert.match(html,/function renderPhases\(\)/);
 assert.match(html,/class="phase-counts"/);
 assert.match(html,/x\.complete/);
 assert.match(html,/x\.active/);
 assert.match(html,/El indicador superior «Avance sustentado» solo considera actividades medibles/);
 assert.doesNotThrow(()=>new Function('async function moduleValidation(){\n'+html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]+'\n}'));
});
