import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Android permits signed media from production and isolated release QA only', () => {
  const html = readFileSync(new URL('../android/app/src/main/assets/mobile/index.html', import.meta.url), 'utf8');
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  const directives = new Map(policy.split(';').filter(s => s.trim()).map(s => {
    const [name, ...values] = s.trim().split(/\s+/);
    return [name, values];
  }));
  const projects = ['https://zqiknzivfahvvadmxrvt.supabase.co', 'https://vwtcncvmwjfywrzjmskw.supabase.co'];
  for (const directive of ['img-src', 'media-src']) {
    for (const origin of projects) assert.ok(directives.get(directive).includes(origin), `${directive} blocks signed media from ${origin}`);
    assert.deepEqual(directives.get(directive).filter(s => s.includes('supabase.co')).sort(), [...projects].sort());
    assert.ok(!directives.get(directive).includes('https:'));
    assert.ok(!directives.get(directive).includes('*'));
  }
  assert.deepEqual(directives.get('connect-src'), ["'none'"]);
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
});
