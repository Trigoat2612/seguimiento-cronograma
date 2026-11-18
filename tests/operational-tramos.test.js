import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ACTIVITY_IDS,SOURCE_ACTIVITY_IDS,OPERATIONAL_TRAMO_IDS} from '../lib/drive-upload.js';

const plan=JSON.parse(await readFile(new URL('../data/plan-operaciones.json',import.meta.url),'utf8'));
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const parents=plan.activities;
const pieces=parents.flatMap(a=>a.subtasks||[]);
const get=id=>parents.find(a=>a.id===id);

test('El plan original conserva sus 23 registros y los 48 tramos son identificables',()=>{
 assert.equal(parents.length,23);
 assert.equal(pieces.length,48);
 assert.equal(parents.filter(a=>a.subtasks.length>0).length,12);
 assert.equal(SOURCE_ACTIVITY_IDS.size,23);
 assert.equal(OPERATIONAL_TRAMO_IDS.size,48);
 assert.equal(ACTIVITY_IDS.size,71);
 assert.deepEqual(new Set(pieces.map(a=>a.id)),OPERATIONAL_TRAMO_IDS);
 assert.equal(new Set([...parents.map(a=>a.id),...pieces.map(a=>a.id)]).size,71);
});
test('Los tramos cubren los horarios originales sin solapamientos ni huecos',()=>{
 for(const parent of parents.filter(a=>a.segments?.length>0&&a.subtasks.length>0)){
  for(const window of parent.segments){
   const start=Date.parse(window.start_at),end=Date.parse(window.end_at);
   const sections=parent.subtasks.filter(t=>t.start_at&&t.end_at&&Date.parse(t.start_at)<end&&Date.parse(t.end_at)>start)
    .sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at));
   assert.ok(sections.length>0,parent.id+' sin tramos');
   assert.equal(Date.parse(sections[0].start_at),start,parent.id+' inicio');
   assert.equal(Date.parse(sections.at(-1).end_at),end,parent.id+' fin');
   for(let i=1;i<sections.length;i++)
    assert.equal(Date.parse(sections[i-1].end_at),Date.parse(sections[i].start_at),parent.id+' brecha');
  }
 }
});
test('Calendario a demanda, validaciones y monitoreo tiene todas las jornadas del rango',()=>{
 const dates=(id)=>get(id).subtasks.map(a=>a.date_label);
 assert.deepEqual(dates('b6-b7-b8'),['16/11/2026','17/11/2026','18/11/2026']);
 assert.deepEqual(dates('c4'),['18/11/2026','19/11/2026','20/11/2026']);
 assert.deepEqual(dates('c4-r'),['18/11/2026','19/11/2026','20/11/2026']);
 assert.deepEqual(dates('c5-1'),['18/11/2026','19/11/2026','20/11/2026']);
 assert.deepEqual(dates('c5-2'),['23/11/2026','24/11/2026','25/11/2026','26/11/2026']);
 assert.equal(get('d2').subtasks.length,11);
 assert.ok(get('d2').subtasks.every(t=>t.is_continuous&&!t.start_at&&!t.end_at));
 assert.ok(get('c4').subtasks.every(t=>t.is_on_demand&&!t.start_at&&!t.end_at));
});
test('No se presume ejecución, no se heredan estados ni se inventan horas',()=>{
 for(const sub of pieces){
  const parent=get(sub.parent_id);
  assert.ok(parent,'tramo sin actividad principal '+sub.id);
  assert.equal(sub.owner,parent.owner);
  assert.equal(sub.page,parent.page);
  assert.equal(sub.is_subtask,true);
  assert.ok(!('status' in sub),'tramo no debe traer estado precargado');
  assert.ok(!('notes' in sub),'tramo no debe traer observaciones precargadas');
  if(sub.is_on_demand)assert.equal(sub.start_at,null);
 }
});
test('Visualización permite abrir tramos y mantiene KPIs basados en 23 actividades',()=>{
 assert.match(html,/function renderTramosRows\(\)/);
 assert.match(html,/renderTramosRows\(\);/);
 assert.match(html,/function findActivity\(id\)/);
 assert.match(html,/data-open="\$\{esc\(t\.id\)\}"/);
 assert.match(html,/const all=PLAN\.activities\.flatMap/);
 assert.match(html,/const activities=PLAN\.activities;const elig=/);
 assert.match(html,/showActivity\(id\)\{const a=findActivity\(id\)/);
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Function('async function validate(){\n'+script+'\n}'));
});
