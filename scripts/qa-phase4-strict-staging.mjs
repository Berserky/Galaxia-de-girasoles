import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Fase 4 GO gate: the existing informational workflow may report NOT_EXECUTED (78)
// as a green job. This entrypoint NEVER treats a missing QA environment as success.
const target=fileURLToPath(new URL('./qa-phase5-staging.mjs',import.meta.url));
const run=spawnSync(process.execPath,[target],{stdio:'inherit',env:process.env});
if(run.error){
  console.error('F4 QA REMOTE GATE: cannot execute remote probe:',run.error.message);
  process.exit(1);
}
if(run.status===78){
  console.error('F4 QA REMOTE GATE: BLOCKED. Staging E2E was NOT_EXECUTED; credentials/URL required.');
  process.exit(1);
}
if(run.status!==0){
  console.error('F4 QA REMOTE GATE: FAILED. QA E2E did not pass.');
  process.exit(1);
}
console.log('F4_QA_REMOTE_GATE=VERIFIED');
