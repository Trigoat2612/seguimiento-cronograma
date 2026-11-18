import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const a=html.indexOf('function forecastMigrationRemaining(');
const b=html.indexOf('function renderProgress(){',a);
assert.ok(a>=0&&b>a,'No se encontró el cálculo de tiempo restante');
const ctx={Date,Number,Math,Intl};
vm.runInNewContext(html.slice(a,b)+'\nthis.forecast=forecastMigrationRemaining;this.duration=migrationDuration;',ctx);
const forecast=(rows,time='2026-11-18T09:45:00Z')=>ctx.forecast(rows,Date.parse(time));
const cut=(m,t,iso='2026-11-18T09:33:00Z')=>({migrated_count:m,target_count:t,reported_at:iso});
const four=[
 cut(453909,580263,'2026-11-18T09:33:00Z'),
 cut(412604,580263,'2026-11-18T08:35:00Z'),
 cut(366049,580263,'2026-11-18T07:34:00Z'),
 cut(315707,580263,'2026-11-18T06:34:00Z')
];

test('La ETA usa los cuatro cortes más recientes, no todo el historial',()=>{
 const x=forecast([...four,cut(160282,580263,'2026-11-18T03:17:00Z')]);
 assert.equal(x.state,'ok');
 assert.equal(x.sampleCount,4);
 assert.equal(x.remaining,126354);
 assert.equal(x.remainingMinutes,164);
 assert.ok(x.ratePerHour>46300&&x.ratePerHour<46350);
 assert.equal(new Date(x.finishAt).toISOString(),'2026-11-18T12:17:00.000Z');
 assert.equal(ctx.duration(x.remainingMinutes),'2 h 44 min');
});

test('No inventa una velocidad sin cuatro cortes',()=>{
 assert.equal(forecast(four.slice(0,2)).state,'insufficient');
 assert.equal(forecast([]).state,'none');
});

test('Rechaza cambios de universo y retrocesos de migración',()=>{
 assert.equal(forecast([four[0],{...four[1],target_count:500000},...four.slice(2)]).state,'insufficient');
 assert.equal(forecast([four[0],{...four[1],migrated_count:470000},...four.slice(2)]).state,'insufficient');
});

test('Identifica falta de crecimiento y no divide entre cero',()=>{
 const zero=four.map(x=>({...x,migrated_count:453909}));
 assert.equal(forecast(zero).state,'stalled');
});

test('Evita mostrar un pronóstico vencido como fin confirmado',()=>{
 const x=forecast(four,'2026-11-18T14:10:00Z');
 assert.equal(x.state,'stale');
 assert.ok(x.reason.includes('2 horas'));
});

test('El 100% reportado se distingue de la validación de cierre',()=>{
 const rows=[{...four[0],migrated_count:580263},...four.slice(1)];
 assert.equal(forecast(rows).state,'completed');
});

test('No extrapola de mediciones demasiado separadas',()=>{
 const x=forecast([four[0],four[1],four[2],cut(315707,580263,'2026-11-17T02:34:00Z')]);
 assert.equal(x.state,'insufficient');
});

test('La interfaz sustituye el indicador de validación por tiempo restante',()=>{
 assert.match(html,/id="progress-eta"/);
 assert.match(html,/Tiempo restante estimado/);
 assert.match(html,/Fin proyectado:/);
 assert.match(html,/Ritmo reciente:/);
 assert.doesNotMatch(html,/id="progress-validated"/);
 assert.match(html,/Proyección orientativa, no una fecha comprometida/);
});
