// Trusted adapter inside Docker. vm adds defense in depth; it is NOT a security
// boundary and MUST NOT replace the separate restricted Docker container.
// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
import {readFileSync} from 'node:fs';
import {createContext,runInContext,SourceTextModule} from 'node:vm';

const context=createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
// Capture the assertion adapter's intrinsics before loading candidate code.
const run=runInContext(`(()=>{
  const stringify=JSON.stringify.bind(JSON),parse=JSON.parse.bind(JSON),Type=TypeError;
  const clone=value=>parse(stringify(value));
  const errorType=fn=>{try{fn();return 'NO_ERROR';}catch(error){return error instanceof Type?'TypeError':'OTHER_ERROR';}};
  return (app,challenge)=>{
    const first=app.createTask(challenge.idA,challenge.titleA);
    const second=app.createTask(challenge.idB,challenge.titleB);
    const before=clone(first),completed=app.completeTask(first);
    const originalAfter=clone(first),completedBeforeFilter=clone(completed);
    const source=[first,completed],filtered=app.filterOpen(source);
    return stringify({schema:'constructor.task_probe.v1',first:before,second,before,
      completed:completedBeforeFilter,originalAfter,sameTask:first===completed,
      invalidId:errorType(()=>app.createTask('../escape','Bad')),
      invalidTitle:errorType(()=>app.createTask('c','   ')),
      invalidTask:errorType(()=>app.completeTask({})),
      filtered,sameArray:filtered===source,sourceLength:source.length});
  };
})()`,context,{timeout:2000});
const source=readFileSync('/work/app.mjs','utf8');
const module=new SourceTextModule(source,{context});
await module.link(()=>{throw Error('CANDIDATE_IMPORTS_DENIED');});
await module.evaluate({timeout:2000});
const challenge=runInContext(`JSON.parse(${JSON.stringify(process.argv[2])})`,context,{timeout:2000});
Object.defineProperty(context,'__taskProbeRun',{value:run});
Object.defineProperty(context,'__taskProbeExports',{value:module.namespace});
Object.defineProperty(context,'__taskProbeChallenge',{value:challenge});
const result=runInContext('__taskProbeRun(__taskProbeExports,__taskProbeChallenge)',context,{timeout:2000});
process.stdout.write(result+'\n');
