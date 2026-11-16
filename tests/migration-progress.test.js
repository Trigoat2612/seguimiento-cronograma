import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import handler from '../api/migration-progress.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const sql=await readFile(new URL('../db/004_migration_progress.sql',import.meta.url),'utf8');
const api=await readFile(new URL('../api/migration-progress.js',import.meta.url),'utf8');

test('El indicador no inventa cifras ni convierte el referencial en universo confirmado',()=>{
 assert.match(html,/id="progress-state"/);
 assert.match(html,/Pendiente de reporte/);
 assert.match(html,/15 277/);
 assert.match(html,/15 278/);
 assert.match(html,/No existe conexión directa automática al SIJ\/EJE/);
 assert.match(api,/latest:rows\[0\]\|\|null/);
});

test('El dashboard solo muestra registro de corte a editores autenticados',()=>{
 assert.match(html,/button\.hidden=!canEdit\(\)/);
 assert.match(html,/if\(!canEdit\(\)\)return/);
 assert.match(html,/api\('\/api\/migration-progress'/);
 assert.match(html,/method:'POST'/);
});

test('La ruta exige identidad autorizada antes de tocar Neon',async()=>{
 const req={method:'POST',headers:{origin:'https://seguimiento-cronograma-2qnh.vercel.app',host:'seguimiento-cronograma-2qnh.vercel.app'}};
 const res={statusCode:null,setHeader(){},end(raw){this.body=JSON.parse(raw)}};
 await handler(req,res);
 assert.equal(res.statusCode,401);
 assert.equal(res.body.code,'LOGIN_REQUIRED');
});

test('El historial es append-only con límites y evita cifras que superan el universo',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS seguimiento_cronograma\.migration_progress_updates/);
 assert.match(sql,/migrated_count <= target_count/);
 assert.match(sql,/validated_count <= migrated_count/);
 assert.doesNotMatch(sql,/\bINSERT INTO\b/i);
 assert.match(api,/INSERT INTO seguimiento_cronograma\.migration_progress_updates/);
 assert.doesNotMatch(api,/\bUPDATE seguimiento_cronograma\.migration_progress_updates\b/);
 assert.doesNotMatch(api,/\bDELETE FROM seguimiento_cronograma\.migration_progress_updates\b/);
 assert.match(api,/requireEditor\(req,res\)/);
});

test('El JS del dashboard es sintácticamente válido',()=>{
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Function('async function probe(){\n'+script+'\n}'));
});
