// Docker-isolation reference: bounded Node test execution, no shell and no agent authority.
// Docker containers share the host kernel. This is NOT a hardened multi-tenant VM sandbox.
import {createHash,randomBytes} from "node:crypto";
import {spawn} from "node:child_process";
import {chmod,mkdtemp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {evaluateIntentProofGraph,PROOF_GRAPH_SCHEMA} from "./intent-proof-graph.mjs";

const MISSION=/^[A-Za-z0-9_-]{6,72}$/;
const REQUIREMENT=/^[A-Z][A-Z0-9_-]{2,39}$/;
const IMAGE_ID=/^sha256:[a-f0-9]{64}$/;
const MAX_SOURCE=32768,MAX_OUTPUT=16384;
const hash=x=>createHash("sha256").update(x).digest("hex");
export class IsolationError extends Error {
  constructor(code){super(code);this.name="IsolationError";this.code=code;}
}
function validate({missionId,requirementId,acceptance,source,imageId,timeoutMs}){
  if(!MISSION.test(missionId??"") || !REQUIREMENT.test(requirementId??"") ||
     typeof acceptance!=="string" || acceptance.length<12 || acceptance.length>300 ||
     /[\u0000-\u001f\u007f]/.test(acceptance))
    throw new IsolationError("INVALID_INTENT_CONTRACT");
  if(typeof source!=="string" || Buffer.byteLength(source,"utf8")<1 ||
     Buffer.byteLength(source,"utf8")>MAX_SOURCE)
    throw new IsolationError("INVALID_SOURCE_BYTES");
  if(!IMAGE_ID.test(imageId??""))throw new IsolationError("CONTENT_ADDRESSED_IMAGE_REQUIRED");
  if(!Number.isSafeInteger(timeoutMs) || timeoutMs<1000 || timeoutMs>20000)
    throw new IsolationError("EXECUTION_TIMEOUT_OUT_OF_BOUNDS");
}
export function dockerIsolationArgs({workspace,imageId,containerName}){
  if(typeof workspace!=="string" || !workspace.startsWith("/tmp/constructor-isolated-") ||
     /[,\r\n]/.test(workspace) || workspace.includes("..") ||
     !IMAGE_ID.test(imageId??"") || !/^constructor-test-[a-f0-9]{24}$/.test(containerName??""))
    throw new IsolationError("UNSAFE_DOCKER_LAUNCH_ARGUMENT");
  return [
    "run","--rm","--name",containerName,
    "--network","none","--read-only","--cap-drop","ALL",
    "--security-opt","no-new-privileges","--pids-limit","48",
    "--memory","256m","--memory-swap","256m","--cpus","0.5",
    "--ipc","none","--user","65534:65534",
    "--ulimit","nofile=64:64","--tmpfs","/tmp:rw,noexec,nosuid,nodev,size=16m",
    "--mount","type=bind,source="+workspace+",target=/work,readonly",
    "--workdir","/work","--entrypoint","node",
    imageId,"--test","--test-reporter=tap","/work/test.mjs"
  ];
}
export async function localDockerCommand({args,timeoutMs}){
  if(!Array.isArray(args) || args[0]!=="run")throw new IsolationError("BAD_DOCKER_COMMAND");
  const env={PATH:process.env.PATH??"/usr/bin:/bin",
    HOME:"/nonexistent",DOCKER_CONFIG:"/nonexistent",
    DOCKER_HOST:"unix:///var/run/docker.sock"};
  const child=spawn("docker",args,{shell:false,stdio:["ignore","pipe","pipe"],env});
  let stdout=[],stderr=[],outBytes=0,errBytes=0,overLimit=false;
  const collect=(arr,kind,chunk)=>{
    const len=kind==="out"?(outBytes+=chunk.length):(errBytes+=chunk.length);
    if(len>MAX_OUTPUT){overLimit=true;child.kill("SIGKILL");return;}
    arr.push(chunk);
  };
  child.stdout.on("data",b=>collect(stdout,"out",b));
  child.stderr.on("data",b=>collect(stderr,"err",b));
  const done=new Promise((resolve,reject)=>{
    child.once("error",reject);
    child.once("close",(code,signal)=>resolve({code,signal}));
  });
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill("SIGKILL");},timeoutMs);
  timer.unref();
  try{
    const status=await done;
    return {exitCode:status.code,signal:status.signal,timedOut,overLimit,
      stdout:Buffer.concat(stdout).toString("utf8"),
      stderr:Buffer.concat(stderr).toString("utf8")};
  }finally{
    clearTimeout(timer);
    // Fail-safe remove named container if the CLI was killed before daemon cleanup.
    const name=args[args.indexOf("--name")+1];
    if(/^constructor-test-[a-f0-9]{24}$/.test(name??"")){
      const cleaner=spawn("docker",["rm","-f",name],{shell:false,stdio:"ignore",env});
      await new Promise(resolve=>{cleaner.once("error",resolve);
        cleaner.once("close",resolve);});
    }
  }
}
/**
 * Runs JavaScript test bytes in a bounded Docker container; never evaluates them
 * inside the host or executes arbitrary shell commands. Returns actual stdout
 * and exit-code bytes as a ProofGraph TEST record. QA stays NOT_RUN.
 *
 * Caller MUST obtain an immutable image ID from trusted local Docker inspection.
 * No registry signature, image provenance or VM attestation is claimed.
 */
export async function runIsolatedProofTest({missionId,requirementId,acceptance,
  source,imageId,timeoutMs=15000,dockerRun=localDockerCommand}={}){
  validate({missionId,requirementId,acceptance,source,imageId,timeoutMs});
  if(typeof dockerRun!=="function")throw new IsolationError("RUNNER_REQUIRED");
  const root=await mkdtemp(join(tmpdir(),"constructor-isolated-"));
  const name="constructor-test-"+randomBytes(12).toString("hex");
  try{
    const bytes=Buffer.from(source,"utf8");
    await mkdir(join(root,"input"),{mode:0o755});
    await writeFile(join(root,"input","test.mjs"),bytes,{flag:"wx",mode:0o444});
    await chmod(join(root,"input","test.mjs"),0o444);
    await chmod(root,0o755);
    await chmod(join(root,"input"),0o755);
    const workspace=join(root,"input");
    const args=dockerIsolationArgs({workspace,imageId,containerName:name});
    const fileBytes=await readFile(join(workspace,"test.mjs"));
    if(hash(fileBytes)!==hash(bytes))throw new IsolationError("SOURCE_CHANGED_BEFORE_EXECUTION");
    const run=await dockerRun({args,timeoutMs});
    if(!run || !Number.isSafeInteger(run.exitCode) && run.exitCode!==null ||
       typeof run.stdout!=="string" || typeof run.stderr!=="string" ||
       typeof run.timedOut!=="boolean" || typeof run.overLimit!=="boolean")
      throw new IsolationError("RUNNER_RESULT_MALFORMED");
    if(run.timedOut || run.overLimit || run.exitCode===null ||
       [125,126,127].includes(run.exitCode) ||
       Buffer.byteLength(run.stdout)>MAX_OUTPUT || Buffer.byteLength(run.stderr)>MAX_OUTPUT)
      throw new IsolationError("ISOLATION_EXECUTION_INCOMPLETE");
    const status=run.exitCode===0?"PASS":"FAIL";
    const receipt={
      schema:"constructor_isolated_execution_receipt_v1",
      mission_id:missionId,requirement_id:requirementId,
      runner:dockerRun===localDockerCommand?"LOCAL_DOCKER_NODE_TEST":"INJECTED_TEST_ADAPTER",container_image_id:imageId,
      executable:"node",arguments:["--test","--test-reporter=tap","/work/test.mjs"],
      isolation:{network:"none",read_only_root:true,source_mount:"read_only",
        caps:"ALL_DROPPED",user:"65534:65534",pids_max:48,memory_mb:256,
        no_new_privileges:true,ipc:"none",cpu_limit:0.5},
      source_sha256:hash(fileBytes),exit_code:run.exitCode,
      stdout:run.stdout,stderr:run.stderr,
      stdout_sha256:hash(Buffer.from(run.stdout)),stderr_sha256:hash(Buffer.from(run.stderr)),
      status,untrusted_code_execution:dockerRun===localDockerCommand?
        "CONTAINER_EXECUTED_NOT_VM_ATTESTED":"NOT_EXECUTED_TEST_ADAPTER",
      independent_qa:"NOT_RUN",release:"DENIED"
    };
    const receiptBytes=Buffer.from(JSON.stringify(receipt),"utf8");
    const graph={schema:PROOF_GRAPH_SCHEMA,mission_id:missionId,
      requirements:[{id:requirementId,acceptance}],
      evidence:[
        {id:"EVID_SOURCE",requirement_id:requirementId,kind:"SOURCE",status:"PASS",sha256:hash(fileBytes)},
        {id:"EVID_TEST",requirement_id:requirementId,kind:"TEST",status,sha256:hash(receiptBytes)}
      ]};
    const evaluation=evaluateIntentProofGraph(graph);
    return Object.freeze({receipt,graph,evaluation,
      artifactBytesById:new Map([["EVID_SOURCE",fileBytes],["EVID_TEST",receiptBytes]]),
      release:"DENIED"});
  }finally{await rm(root,{recursive:true,force:true});}
}
