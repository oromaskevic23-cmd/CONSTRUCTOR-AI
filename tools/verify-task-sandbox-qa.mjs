// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// This collector checks data and log shape only; it cannot attest Docker execution.
import {createHash} from 'node:crypto';
import {readFile,lstat,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const hash=x=>createHash('sha256').update(x).digest('hex');
const [,,stagePath,logPath,receiptPath]=process.argv;
if(!stagePath||!logPath||!receiptPath||process.argv.length!==5)throw Error('USAGE: node tools/verify-task-sandbox-qa.mjs STAGE QA_LOG RECEIPT');
const stage=resolve(stagePath);
const manifestBytes=await readFile(join(stage,'stage-manifest.json'));
const m=JSON.parse(manifestBytes.toString('utf8'));
if(m.schema!=='constructor_task_stage_v1'||m.release!=='DENIED'||m.execution!=='NOT_RUN'||
   m.independentQa!=='NOT_RUN'||m.staticReview!=='NO_HEURISTIC_FLAGS_NOT_A_SANDBOX')throw Error('STAGE_MANIFEST_NOT_TRUSTED');
if(!Array.isArray(m.files)||m.files.length!==2||
   m.files.map(f=>f.path).sort().join('|')!=='app.mjs|test/app.test.mjs')throw Error('STAGE_INVENTORY_INVALID');
if((await readdir(stage)).sort().join('|')!=='app.mjs|stage-manifest.json|test'||
   (await readdir(join(stage,'test'))).join('|')!=='app.test.mjs')throw Error('STAGE_ADDITIONAL_FILES');
for(const item of m.files){
 if(typeof item.bytes!=='number'||typeof item.sha256!=='string')throw Error('STAGE_RECORD_INVALID');
 const path=join(stage,item.path),st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink())throw Error('UNSAFE_FILE_TYPE');
 const bytes=await readFile(path);
 if(bytes.length!==item.bytes||hash(bytes)!==item.sha256)throw Error('STAGE_FILE_CHANGED');
}
const log=await readFile(logPath,'utf8');
if(log.length>80000||!/\bpass\s+4\b/.test(log)||!/\bfail\s+0\b/.test(log)||
   !log.includes('completion is immutable'))throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
const evidence={schema:'constructor_task_qa_observation_v1',missionId:m.missionId,
 status:'UNATTESTED_QA_LOG_SHAPE_ONLY',execution:'NOT_ATTESTED_BY_COLLECTOR',
 stageManifestSha256:hash(manifestBytes),qaLogSha256:hash(log),
 acceptance:'FIXED_TASK_MANAGER_V1_NOT_GENERAL_APP',model:m.model,
 verification:'LOG_SHAPE_ONLY_NOT_DOCKER_ORIGIN',approval:'NOT_GRANTED',release:'DENIED',
 limits:'Unsigned observation; requires separate trusted QA attestation and Owner authorization'};
await writeFile(receiptPath,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(evidence));
