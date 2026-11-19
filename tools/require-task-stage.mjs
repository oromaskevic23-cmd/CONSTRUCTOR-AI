// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Read-only pre-execution admission. This command never executes generated source.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {assertTaskStagePreflight} from '../engineering/task-stage-preflight.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const HASH=/^[0-9a-f]{64}$/;
async function safeFile(path){
  let handle;
  try{
    handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    const st=await handle.stat();
    if(!st.isFile()||st.size>100000)throw Error('STAGE_UNSAFE_FILE');
    const data=await handle.readFile();
    if(data.length>100000)throw Error('STAGE_UNSAFE_FILE');
    return data;
  }finally{await handle?.close();}
}

export async function requireTaskStageBeforeExecution(stagePath){
  if(typeof stagePath!=='string'||!stagePath)throw Error('STAGE_PATH_REQUIRED');
  const stage=resolve(stagePath);
  const st=await lstat(stage);
  if(!st.isDirectory()||st.isSymbolicLink())throw Error('STAGE_UNSAFE_DIRECTORY');
  const testDir=join(stage,'test');
  const td=await lstat(testDir);
  if(!td.isDirectory()||td.isSymbolicLink())throw Error('STAGE_UNSAFE_DIRECTORY');
  if((await readdir(stage)).sort().join('|')!=='app.mjs|stage-manifest.json|test'||
     (await readdir(testDir)).join('|')!=='app.test.mjs')
    throw Error('STAGE_UNEXPECTED_FILES');
  const raw=await safeFile(join(stage,'stage-manifest.json'));
  let manifest;
  try{manifest=JSON.parse(raw.toString('utf8'));}
  catch{throw Error('STAGE_MANIFEST_INVALID');}
  if(!Array.isArray(manifest?.files)||manifest.files.length!==2||
     manifest.files.map(f=>f.path).sort().join('|')!=='app.mjs|test/app.test.mjs')
    throw Error('STAGE_INVENTORY_INVALID');
  const files=[];
  for(const item of manifest.files){
    if(!item||typeof item.path!=='string'||!Number.isSafeInteger(item.bytes)||
       item.bytes<1||item.bytes>100000||!HASH.test(item.sha256??''))
      throw Error('STAGE_INVENTORY_INVALID');
    const bytes=await safeFile(join(stage,item.path));
    if(bytes.length!==item.bytes||hash(bytes)!==item.sha256)
      throw Error('STAGE_FILE_TAMPERED');
    files.push({path:item.path,content:bytes.toString('utf8')});
  }
  assertTaskStagePreflight(manifest,files);
  return Object.freeze({status:'QUARANTINE_PRE_EXECUTION_VALIDATED',
    scope:'STRUCTURAL_ADMISSION_ONLY_NOT_SANDBOX_QA',
    execution:'NOT_RUN',release:'DENIED'});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+resolve(process.argv[1])).href){
  if(process.argv.length!==3)throw Error('USAGE: node tools/require-task-stage.mjs STAGE');
  const result=await requireTaskStageBeforeExecution(process.argv[2]);
  process.stdout.write(JSON.stringify(result)+'\n');
}
