import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
function git(...args) { return execFileSync('git', args, {cwd: root, encoding: 'utf8', timeout: 25000, maxBuffer: 16*1024*1024}).trim(); }
const refs = git('for-each-ref','--format=%(refname:short)|%(objectname)','refs/tags/archive/2026-10-08').split('\n').filter(Boolean).map(x=>{const [name, sha]=x.split('|');return{name,sha};});
const csv = readFileSync(resolve(root,'docs/branch-audit-2026-10-08.csv'),'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).slice(1).map(line=>{const m=[...line.matchAll(/"([^"]*)"/g)].map(x=>x[1]);return {name:m[0],sha:m[1],status:m[4]};});
const index = new Map(csv.map(x=>[x.name,x]));
const currentFiles = new Set(git('ls-tree','-r','--name-only','origin/desarrollo').split('\n'));
const domains = [
 ['Música', /music|musica|player|audio/i], ['Mapas / privacidad', /map|gps|location|eta|trip|distance|motion/i],
 ['Momentos / widgets', /bond|moment|widget|gestures|voice/i], ['Hogar / RPG / tienda', /hogar|rpg|home|shop|catalog|asset/i],
 ['Diseño / tema', /theme|design|style|ui|font|anime/i], ['Chat / cámara', /chat|camera|media|photo|giphy/i],
 ['Entrega / plataforma', /release|android|pages|deploy|build|workflow|security|fix/i]];
function domain(name,files){ const sample=name+' '+files.slice(0,20).join(' '); return domains.find(([,pattern])=>pattern.test(name))?.[0]||domains.find(([,pattern])=>pattern.test(sample))?.[0]||'General'; }
const lines=[];
for(const tag of refs){
 const rec=index.get(tag.name.replace('archive/2026-10-08/',''));
 if(!rec||rec.sha!==tag.sha||rec.status!=='unique') throw new Error('Mismatch between archive tag and historical CSV: '+tag.name);
 const commitDate=git('show','-s','--format=%cI',tag.sha).slice(0,10);
 const common=git('merge-base','origin/desarrollo',tag.sha);
 const touched=git('diff','--name-only',common,tag.sha).split('\n').filter(Boolean);
 const missing=touched.filter(x=>!currentFiles.has(x));
 const exact=touched.filter(x=>currentFiles.has(x));
 lines.push({ref:tag.name,sha:tag.sha,date:commitDate,common,files:touched.length,missing:missing.length,existing:exact.length,domain:domain(tag.name,touched),missingSamples:missing.slice(0,6),existingSamples:exact.slice(0,3)});
}
if(refs.length!==80||lines.length!==80)throw new Error('Expected 80 archive refs, found '+refs.length);
const esc=s=>String(s).replaceAll('|','\\|').replaceAll('\n',' ');
const md = [
 '# Nuestra Galaxia 4.1.1 — Barrido completo de las 80 etiquetas de rescate',
 '',
 '**Fecha:** 2026-10-08 · **Base:** origin/desarrollo · **Método:** lectura Git de 80 refs, conciliación SHA contra docs/branch-audit-2026-10-08.csv, merge-base y diff de rutas de archivo por ref.',
 '',
 '> AUDITORÍA ESTÁTICA COMPLETA DE REFERENCIAS, NO CERTIFICACIÓN FUNCIONAL. Cada etiqueta fue recorrida para confirmar su historial de commits y archivos divergentes. No se revisó línea por línea ni se probó E2E el código dentro de cada tag; ninguna se restauró. Un archivo faltante no implica función perdida: puede haberse movido, rediseñado o descartado a propósito.',
 '',
 '## Resultado de consistencia',
 '- Etiquetas de archivo reconciliadas: **80/80**, sin discrepancias de SHA con CSV.',
 '- Todas las etiquetas tienen ancestro común verificable con origin/desarrollo; se inspeccionaron sus archivos históricos divergentes contra ese ancestro.',
 '- Los cambios han sido clasificados por dominio de forma **heurística**; la decisión funcional individual está en NG-4.1.1-RECOVERY-DECISIONS.md y necesita evidencia E2E.',
 '',
 '| Archivo histórico | SHA | Fecha UTC | Dominio tentativo | Rutas tocadas | Existen hoy | Ya no están en desarrollo | Ejemplos de rutas ausentes |',
 '|---|---|---|---|---:|---:|---:|---|',
 ...lines.map(x=>`| \`${esc(x.ref)}\` | \`${x.sha.slice(0,9)}\` | ${x.date} | ${x.domain} | ${x.files} | ${x.existing} | ${x.missing} | ${x.missingSamples.map(s=>'\`'+esc(s)+'\`').join(', ')||'—'} |`),
 '',
 '## Restricciones para integración',
 '1. No hacer merge ni cherry-pick de estas referencias por estar divergidas del Android 4.1.1.',
 '2. Conservar assets/mobile y el puente nativo. No reaplicar migraciones/destructivas ni recuperar secretos.',
 '3. Para cada candidata, correlacionar con NG-LEG y NG-FNC antes de iniciar un PR funcional.',
 '4. Mantener las pruebas de privacidad/adversariales y QA de dos parejas como gate para cualquier módulo compartido.',
 '',
 '## Significado de rutas',
 'La columna “Existen hoy” solo indica una ruta de nombre idéntico en desarrollo. “Ya no están” tampoco demuestra pérdida funcional (puede tratarse de antiguas rutas de PWA reemplazadas por WebView Android). Esta lista no autoriza implementaciones.',
 ''
].join('\n');
const out=resolve(root,'docs/recovery/NG-4.1.1-ARCHIVE-80-LEDGER.md');mkdirSync(dirname(out),{recursive:true});writeFileSync(out,md);
const summary=lines.reduce((acc,x)=>(acc[x.domain]=(acc[x.domain]||0)+1,acc),{});
console.log(JSON.stringify({tagCount:refs.length,csvRows:csv.length,mismatches:0,missingPathsTotal:lines.reduce((a,x)=>a+x.missing,0),domains:summary,ledger:out,lines:md.split('\n').length},null,2));
