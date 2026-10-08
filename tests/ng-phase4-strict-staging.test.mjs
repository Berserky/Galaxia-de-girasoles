import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const script=new URL('../scripts/qa-phase4-strict-staging.mjs',import.meta.url);
const child=new URL('../scripts/qa-phase5-staging.mjs',import.meta.url);
const qa='https://vwtcncvmwjfywrzjmskw.supabase.co/functions/v1/android-companion';
const base={...process.env,QA_STAGING_EDGE_URL:qa,QA_STAGING_PUBLISHABLE_KEY:'public-test-key',QA_STAGING_TOKEN_0:'QA-0',QA_STAGING_TOKEN_1:'QA-1'};
const run=(file,overrides={})=>spawnSync(process.execPath,[fileURL(file)],{
  env:{...base,...overrides},
  encoding:'utf8',
  timeout:5000
});
function fileURL(value){return value.pathname;}

test('Strict QA remote gate fails closed when tokens and endpoint are absent',()=>{
 const result=run(script,{QA_STAGING_EDGE_URL:'',QA_STAGING_PUBLISHABLE_KEY:'',QA_STAGING_TOKEN_0:'',QA_STAGING_TOKEN_1:''});
 assert.equal(result.status,1);
 assert.match(result.stderr,/NOT_EXECUTED/);
});

test('Informational child continues reporting absence with explicit status 78',()=>{
 const result=run(child,{QA_STAGING_EDGE_URL:'',QA_STAGING_PUBLISHABLE_KEY:'',QA_STAGING_TOKEN_0:'',QA_STAGING_TOKEN_1:''});
 assert.equal(result.status,78);
 assert.match(result.stdout,/NOT_EXECUTED/);
});

test('Do not send tokens to the production project',()=>{
 const result=run(script,{QA_STAGING_EDGE_URL:'https://zqiknzivfahvvadmxrvt.supabase.co/functions/v1/android-companion'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/FAILED/);
});

test('Do not send QA tokens to an unexpected host',()=>{
 const result=run(child,{QA_STAGING_EDGE_URL:'https://example.org/functions/v1/android-companion'});
 assert.equal(result.status,2);
 assert.match(result.stderr,/exact QA Supabase Edge endpoint/);
});

test('A malicious look-alike QA host is rejected before any HTTP call',()=>{
 const result=run(child,{QA_STAGING_EDGE_URL:'https://vwtcncvmwjfywrzjmskw.supabase.co.evil.example/functions/v1/android-companion'});
 assert.equal(result.status,2);
});

test('QA person 0 and 1 cannot reuse identical tokens',()=>{
 const result=run(child,{QA_STAGING_TOKEN_1:'QA-0'});
 assert.equal(result.status,2);
 assert.match(result.stderr,/must be distinct/);
});

test('Fail-closed entrypoint is the one selected by Fase 4 release workflow',()=>{
 const yaml=readFileSync(new URL('../.github/workflows/ng-phase4-qa-gate.yml',import.meta.url),'utf8');
 assert.match(yaml,/node scripts\/qa-phase4-strict-staging\.mjs/);
 assert.match(yaml,/QA_STAGING_TOKEN_1/);
 assert.match(yaml,/QA_STAGING_REQUIRED/);
});
