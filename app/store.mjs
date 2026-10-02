import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {fail} from './domain.mjs';
export function openStore(dir) {
 mkdirSync(dir,{recursive:true});
 const db=new DatabaseSync(dir+'/galaxia.sqlite');
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL, author TEXT NOT NULL, created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS daily (day TEXT NOT NULL, person TEXT NOT NULL, mood TEXT, answer TEXT, PRIMARY KEY(day,person));
 CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, tokens TEXT);
 CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, email TEXT NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS oauth (state TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires INTEGER NOT NULL, email TEXT);
 `);
 if(!db.prepare('SELECT id FROM settings WHERE id=1').get()) {
   db.prepare('INSERT INTO settings(id,data) VALUES(1,?)').run(JSON.stringify({names:['Sebas','Adri'],startDate:'',folderId:'',folderName:''}));
   // Solo importa los recuerdos que ya existían en el regalo; no inventa fechas.
   const source=readFileSync(fileURLToPath(new URL('../recuerdos.js',import.meta.url)),'utf8');
   const memories=vm.runInNewContext(source+'; mensajes');
   const insert=db.prepare('INSERT INTO items VALUES(?,?,?,?,?,?)');
   for(const m of memories) insert.run(randomUUID(),'memory',JSON.stringify({kind:'memory',title:m.titulo,body:m.texto,date:'',category:'Nuestra historia',done:false,annual:false}),1,'0',new Date().toISOString());
 }
 const map=r=>({...r,data:JSON.parse(r.data)});
 return {
  db,
  settings(){return map(db.prepare('SELECT * FROM settings WHERE id=1').get());},
  saveSettings(data,version){const r=db.prepare('UPDATE settings SET data=?,version=version+1 WHERE id=1 AND version=?').run(JSON.stringify(data),version);if(!r.changes)fail('Los ajustes cambiaron en otro dispositivo. Actualiza y vuelve a intentar.',409);},
  list(){return db.prepare('SELECT * FROM items ORDER BY created DESC,id').all().map(map);},
  add(data,author){const id=randomUUID();db.prepare('INSERT INTO items VALUES(?,?,?,?,?,?)').run(id,data.kind,JSON.stringify(data),1,author,new Date().toISOString());return id;},
  update(id,data,version){const r=db.prepare('UPDATE items SET data=?,version=version+1 WHERE id=? AND version=? AND kind=?').run(JSON.stringify(data),id,version,data.kind);if(!r.changes)fail('Este contenido cambió. Actualiza antes de guardar otra vez.',409);},
  remove(id,version){const r=db.prepare('DELETE FROM items WHERE id=? AND version=?').run(id,version);if(!r.changes)fail('Este contenido cambió. Actualiza para continuar.',409);},
  daily(day){return db.prepare('SELECT * FROM daily WHERE day=?').all(day);},
  saveDaily(day,person,field,value){if(!['mood','answer'].includes(field))fail('Campo no válido.');db.prepare(`INSERT INTO daily(day,person,${field}) VALUES(?,?,?) ON CONFLICT(day,person) DO UPDATE SET ${field}=excluded.${field}`).run(day,person,value);},
  close(){db.close();}
 };
}
