// Servidor de desarrollo local sin Vercel CLI. Requiere npm install + variables .env exportadas.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('.',import.meta.url)));
const routes={activities:'./api/activities.js',history:'./api/history.js',evidence:'./api/evidence.js',import:'./api/import.js',operaciones:'./api/operaciones.js','drive-upload':'./api/drive-upload.js'};
http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost:3000');const route=url.pathname.slice(5);if(url.pathname.startsWith('/api/')&&routes[route]){const mod=await import(routes[route]);req.query=Object.fromEntries(url.searchParams.entries());try{await mod.default(req,res)}catch(e){res.writeHead(500);res.end('Server error')}return}if(url.pathname==='/favicon.png'){const body=await readFile(join(root,'favicon.png'));res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'});return res.end(body)}if(url.pathname==='/data/plan-operaciones.json'){const body=await readFile(join(root,'data/plan-operaciones.json'));res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});return res.end(body)}if(url.pathname==='/'||url.pathname==='/index.html'){const body=await readFile(join(root,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(body)}res.writeHead(404);res.end('Not found')}).listen(3000,()=>console.log('http://localhost:3000'));
