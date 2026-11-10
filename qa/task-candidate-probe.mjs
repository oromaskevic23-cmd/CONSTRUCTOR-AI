// Trusted adapter inside Docker. vm adds defense in depth; it is NOT a security
// boundary and MUST NOT replace the separate restricted Docker container.
// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
import {readFileSync} from 'node:fs';
import {createContext,runInContext,SourceTextModule} from 'node:vm';

const context=createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
// Keep the challenge out of the candidate's global namespace. It is created
// before candidate code can replace JSON or other intrinsics.
const challenge=runInContext(`Object.freeze(JSON.parse(${JSON.stringify(process.argv[2])}))`,context,{timeout:2000});
// Capture the assertion adapter's intrinsics before loading candidate code.
const run=runInContext(`(()=>{
  const stringify=JSON.stringify.bind(JSON),Type=TypeError;
  const ownKeys=Reflect.ownKeys,getOwn=Object.getOwnPropertyDescriptor,getProto=Object.getPrototypeOf;
  const create=Object.create,isArray=Array.isArray,isSafeInteger=Number.isSafeInteger,toString=String;
  const objectProto=Object.prototype,arrayProto=Array.prototype;
  const snapshot=value=>{
    if(!value||typeof value!=='object'||![objectProto,null].includes(getProto(value)))throw new Type();
    const keys=ownKeys(value);
    if(keys.length!==3||!keys.includes('id')||!keys.includes('title')||!keys.includes('done'))throw new Type();
    const id=getOwn(value,'id'),title=getOwn(value,'title'),done=getOwn(value,'done');
    if(!id||!title||!done||!('value' in id)||!('value' in title)||!('value' in done)||
      typeof id.value!=='string'||typeof title.value!=='string'||typeof done.value!=='boolean'||
      value.id!==id.value||value.title!==title.value||value.done!==done.value)throw new Type();
    const copy=create(null);copy.id=id.value;copy.title=title.value;copy.done=done.value;return copy;
  };
  const snapshotArray=value=>{
    if(!isArray(value)||getProto(value)!==arrayProto||!isSafeInteger(value.length)||value.length>32)throw new Type();
    const keys=ownKeys(value);
    if(keys.length!==value.length+1||!keys.includes('length'))throw new Type();
    const copy=[];
    for(let i=0;i<value.length;i++){
      const descriptor=getOwn(value,toString(i));
      if(!descriptor||!('value' in descriptor)||value[i]!==descriptor.value)throw new Type();
      copy[i]=snapshot(descriptor.value);
    }
    return copy;
  };
  const errorType=fn=>{try{fn();return 'NO_ERROR';}catch(error){return error instanceof Type?'TypeError':'OTHER_ERROR';}};
  return (app,challenge)=>{
    const first=app.createTask(challenge.idA,challenge.titleA);
    const second=app.createTask(challenge.idB,challenge.titleB);
    const firstSnapshot=snapshot(first),secondSnapshot=snapshot(second),before=snapshot(first);
    const completed=app.completeTask(first);
    const originalAfter=snapshot(first),completedBeforeFilter=snapshot(completed);
    const source=[first,completed],filtered=app.filterOpen(source);
    const filteredSnapshot=snapshotArray(filtered);
    const originalAfterFilter=snapshot(first),completedAfterFilter=snapshot(completed);
    const result=create(null);
    result.schema='constructor.task_probe.v1';result.first=firstSnapshot;result.second=secondSnapshot;
    result.before=before;result.completed=completedBeforeFilter;result.originalAfter=originalAfter;
    result.sameTask=first===completed;result.invalidId=errorType(()=>app.createTask('../escape','Bad'));
    result.invalidTitle=errorType(()=>app.createTask('c','   '));result.invalidTask=errorType(()=>app.completeTask({}));
    result.filtered=filteredSnapshot;result.sameArray=filtered===source;result.sourceLength=source.length;
    result.sameSourceElements=source[0]===first&&source[1]===completed;
    result.originalAfterFilter=originalAfterFilter;result.completedAfterFilter=completedAfterFilter;
    return stringify(result);
  };
})()`,context,{timeout:2000});
const makeInvoker=runInContext('(run,app,challenge)=>()=>run(app,challenge)',context,{timeout:2000});
// Prevent prototype-wide serialization hooks from tampering with this probe.
// These restrictions are defense in depth, not a security guarantee from vm.
runInContext(`Object.defineProperty(globalThis,'globalThis',{value:globalThis,writable:false,configurable:false});
  for(const value of [Object.prototype,Array.prototype,Function.prototype,
  Error.prototype,TypeError.prototype,Object,Array,Reflect,JSON,TypeError])Object.freeze(value);`,context,{timeout:2000});
const source=readFileSync('/work/app.mjs','utf8');
const module=new SourceTextModule(source,{context});
await module.link(()=>{throw Error('CANDIDATE_IMPORTS_DENIED');});
await module.evaluate({timeout:2000});
const invoke=makeInvoker(run,module.namespace,challenge);
Object.defineProperty(context,'__taskProbeExecute',{value:invoke,configurable:true});
// Remove the hook before invoking candidate functions; it must not expose the
// challenge or an obvious test marker through the candidate's global object.
const result=runInContext('((execute)=>{delete globalThis.__taskProbeExecute;return execute();})(globalThis.__taskProbeExecute)',context,{timeout:2000});
process.stdout.write(result+'\n');
