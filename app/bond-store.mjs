import {randomUUID} from 'node:crypto';
import {validateBond,gameQuestions,gardenProgress} from './public/bond-domain.js';
import {fail} from './domain.mjs';
export function bondStore(db){
 db.exec(`CREATE TABLE IF NOT EXISTS bond(id TEXT PRIMARY KEY,type TEXT NOT NULL,author TEXT NOT NULL,version INTEGER NOT NULL,created TEXT NOT NULL,data TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS bond_ritual_week ON bond(author,json_extract(data,'$.week')) WHERE type='ritual';
 CREATE TABLE IF NOT EXISTS bond_config(id INTEGER PRIMARY KEY CHECK(id=1),photo_path TEXT NOT NULL DEFAULT '');
 INSERT OR IGNORE INTO bond_config(id) VALUES(1);
 CREATE TABLE IF NOT EXISTS bond_audio(path TEXT PRIMARY KEY,mime TEXT NOT NULL,author TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bond_participation(day TEXT NOT NULL,person TEXT NOT NULL,PRIMARY KEY(day,person));
 INSERT OR IGNORE INTO bond_participation SELECT date(created,'-5 hours'),author FROM items;
 INSERT OR IGNORE INTO bond_participation SELECT date(created,'-5 hours'),author FROM bond;
 INSERT OR IGNORE INTO bond_participation SELECT day,person FROM daily WHERE mood IS NOT NULL OR answer IS NOT NULL;
 CREATE TRIGGER IF NOT EXISTS bond_items_participation AFTER INSERT ON items BEGIN INSERT OR IGNORE INTO bond_participation VALUES(date(NEW.created,'-5 hours'),NEW.author);END;
 CREATE TRIGGER IF NOT EXISTS bond_daily_participation_insert AFTER INSERT ON daily WHEN NEW.mood IS NOT NULL OR NEW.answer IS NOT NULL BEGIN INSERT OR IGNORE INTO bond_participation VALUES(NEW.day,NEW.person);END;
 CREATE TRIGGER IF NOT EXISTS bond_daily_participation_update AFTER UPDATE ON daily WHEN NEW.mood IS NOT NULL OR NEW.answer IS NOT NULL BEGIN INSERT OR IGNORE INTO bond_participation VALUES(NEW.day,NEW.person);END;`);
 const map=r=>r?{...r,data:JSON.parse(r.data)}:null;
 const day=created=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(created));
 const participation=person=>db.prepare('INSERT OR IGNORE INTO bond_participation VALUES(?,?)').run(day(new Date()),person);
 const get=id=>{const r=map(db.prepare('SELECT * FROM bond WHERE id=?').get(id));if(!r)fail('El momento ya no existe.',404);return r;};
 const view=(r,p)=>{const c=structuredClone(r);if(c.type==='game'&&c.author!==p&&!Object.hasOwn(c.data,'guess'))delete c.data.answer;return c;};
 const validated=(t,d,p)=>{let value;try{value=validateBond(t,d);}catch(e){fail(e.message);}if(t==='voice'){const audio=db.prepare('SELECT * FROM bond_audio WHERE path=? AND author=?').get(value.audioPath,p);if(!audio||audio.mime!==value.mime)fail('El audio no pertenece a tu perfil.');if(value.referenceId){const item=db.prepare('SELECT kind,data FROM items WHERE id=?').get(value.referenceId);if(!item||!['memory','song','capsule'].includes(item.kind))fail('Referencia no válida.');if(item.kind==='capsule'&&JSON.parse(item.data).date>day(new Date()))fail('La cápsula aún está cerrada.');}}return value;};
 const check=(r,p,v,update=false)=>{if(!Number.isInteger(v)||v<1)fail('Falta la versión del momento.');if(r.type!=='sharednote'&&r.author!==p)fail('Solo su autor puede cambiar este momento.',403);if(update&&!['sharednote','ritual'].includes(r.type))fail('Este momento no se puede editar.');if(r.version!==v)fail('Cambió en otro dispositivo. Actualiza antes de guardar.',409);};
 return {
  read(p){const participationRows=[...db.prepare('SELECT day,person FROM bond_participation').all(),...db.prepare("SELECT day,person FROM daily WHERE mood IS NOT NULL OR answer IS NOT NULL").all(),...db.prepare('SELECT author,created FROM items').all().map(i=>({person:i.author,day:day(i.created)}))];const dates=new Map();for(const r of participationRows){if(!dates.has(r.day))dates.set(r.day,new Set());dates.get(r.day).add(r.person);}return {entries:db.prepare('SELECT * FROM bond ORDER BY created DESC,id').all().map(map).map(r=>view(r,p)),garden:gardenProgress([...dates.values()].filter(s=>s.has('0')&&s.has('1')).length),widget:{photoPath:db.prepare('SELECT photo_path FROM bond_config WHERE id=1').get().photo_path}};},
  add(t,d,p){const data=validated(t,d,p),id=randomUUID();if(t==='ritual'&&db.prepare("SELECT id FROM bond WHERE type='ritual' AND author=? AND json_extract(data,'$.week')=?").get(p,data.week))fail('Ya guardaste el ritual de esta semana.',409);if(t==='gesture'&&db.prepare("SELECT count(*) AS n FROM bond WHERE type='gesture' AND author=? AND created>?").get(p,new Date(Date.now()-60000).toISOString()).n>=20)fail('Espera un momento antes de enviar otro gesto.',429);db.prepare('INSERT INTO bond VALUES(?,?,?,?,?,?)').run(id,t,p,1,new Date().toISOString(),JSON.stringify(data));participation(p);return view(get(id),p);},
  update(id,v,d,p){const r=get(id);check(r,p,v,true);const data=validated(r.type,d,p);if(r.type==='ritual'&&data.week!==r.data.week)fail('La semana del ritual no se puede cambiar.');db.prepare('UPDATE bond SET data=?,version=version+1 WHERE id=? AND version=?').run(JSON.stringify(data),id,v);participation(p);return view(get(id),p);},
  remove(id,v,p){const r=get(id);check(r,p,v);db.prepare('DELETE FROM bond WHERE id=? AND version=?').run(id,v);return {ok:true};},
  guess(id,guess,p){const r=get(id);if(r.type!=='game'||r.author===p)fail('Solo tu pareja puede adivinar esta respuesta.',403);if(Object.hasOwn(r.data,'guess'))fail('La respuesta ya fue adivinada.',409);const q=gameQuestions.find(q=>q.id===r.data.questionId);if(typeof guess!=='string'||!q.options.includes(guess))fail('Elige una respuesta válida.');const data={...r.data,guess,correct:guess===r.data.answer};db.prepare('UPDATE bond SET data=?,version=version+1 WHERE id=? AND version=?').run(JSON.stringify(data),id,r.version);participation(p);return view(get(id),p);},
  widget(photoPath){if(typeof photoPath!=='string'||(photoPath&&!db.prepare('SELECT id FROM photos WHERE id=?').get(photoPath)))fail('Elige una foto de su álbum.');db.prepare('UPDATE bond_config SET photo_path=? WHERE id=1').run(photoPath);return {photoPath};}
 };
}
