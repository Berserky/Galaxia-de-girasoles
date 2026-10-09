import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';

const manifest=JSON.parse(readFileSync('tests/production-migration-manifest.json','utf8'));
const dir='supabase/migrations';
const files=readdirSync(dir).filter(x=>/^\d{14}_.+\.sql$/.test(x)).sort();
const normalizedMd5=text=>createHash('md5').update(text.replace(/\r\n/g,'\n').trimEnd()).digest('hex');

test('NG-QA-004 checked-in history exactly preserves current production migrations',()=>{
  assert.ok(files.length>=manifest.migrations.length,'canonical production migrations were removed');
  const canonical=manifest.migrations.map(x=>x.version+'_'+x.name+'.sql');
  assert.deepEqual(files.slice(0,canonical.length),canonical,'production migration prefix changed');
  for(const expected of manifest.migrations){
    const filename=expected.version+'_'+expected.name+'.sql';
    assert.ok(files.includes(filename),'missing canonical migration '+filename);
    const sql=readFileSync(dir+'/'+filename,'utf8');
    assert.equal(normalizedMd5(sql),expected.normalized_md5,'production SQL drifted for '+filename);
  }
  const expectedNames=new Set(manifest.migrations.map(x=>x.version+'_'+x.name+'.sql'));
  const additions=files.filter(x=>!expectedNames.has(x));
  const lastVersion=manifest.migrations.at(-1).version;
  for(const name of additions){
    assert.ok(name.slice(0,14)>lastVersion,'new migration predates immutable production history: '+name);
  }
  // Future migrations are append-only; the captured production hashes stay immutable.
});

test('NG-QA-004 superseded local timestamps are gone',()=>{
  for(const old of [
    '20261002183012_couple_moments.sql',
    '20261003220000_mega_update_3_release.sql',
    '20261003214500_mega_update_3_fk_indexes.sql',
    '20261004023000_galaxy_chat_core_320.sql',
    '20261004060000_galaxy_chat_premium_340.sql',
    '20261004173000_galaxy_chat_universe_350.sql',
    '20261004212500_qa_phase0_privacy_firewall.sql'
  ]) assert.equal(files.includes(old),false,'obsolete duplicate survived: '+old);
});
