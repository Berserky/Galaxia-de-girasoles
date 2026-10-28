import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java', import.meta.url),
  'utf8'
);
const exportStart = source.indexOf('if(requestCode==REQ_BACKUP_EXPORT){');
const importStart = source.indexOf('if(requestCode==REQ_BACKUP_IMPORT){', exportStart);
assert.ok(exportStart !== -1 && importStart > exportStart, 'Expected Android backup picker handlers');
const handler = source.slice(exportStart, importStart);

test('Android backup export catches checked JSONException when creating success payload', () => {
  assert.match(
    handler,
    /try\s*\{\s*resolve\(request,new JSONObject\(\)\.put\("saved",true\)\);\s*\}\s*catch\(org\.json\.JSONException\s+\w+\)\s*\{[^}]*reject\(request,/s
  );
});

test('Android backup export confirms success only after stream closes and session is rechecked', () => {
  const closeGuard = handler.indexOf('if(!sessionToken.equals(store.token()))');
  const write = handler.indexOf('out.write(bytes);');
  const confirm = handler.indexOf('resolve(request,new JSONObject().put("saved",true))');
  assert.ok(handler.includes('try(OutputStream out=getContentResolver().openOutputStream(uri,"w"))'));
  assert.ok(handler.includes('if(sessionToken==null||!sessionToken.equals(store.token()))'));
  assert.ok(write >= 0 && closeGuard > write && confirm > closeGuard);
});
