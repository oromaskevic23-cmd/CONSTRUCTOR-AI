// Local development server only. Not a sandbox for executing untrusted generated code.
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve, dirname, join} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {localTaskServiceFromEnv} from "../engineering/local-task-service.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routes = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/studio", ["studio.html", "text/html; charset=utf-8"]],
  ["/studio.html", ["studio.html", "text/html; charset=utf-8"]],
  ["/studio.css", ["studio.css", "text/css; charset=utf-8"]],
  ["/src/project-domain.mjs", ["src/project-domain.mjs", "text/javascript; charset=utf-8"]],
  ["/src/project-runtime.mjs", ["src/project-runtime.mjs", "text/javascript; charset=utf-8"]],
  ["/src/project-backup.mjs", ["src/project-backup.mjs", "text/javascript; charset=utf-8"]],
  ["/src/project-export.mjs", ["src/project-export.mjs", "text/javascript; charset=utf-8"]],
  ["/src/project.css", ["src/project.css", "text/css; charset=utf-8"]],
  ["/src/zip.mjs", ["src/zip.mjs", "text/javascript; charset=utf-8"]],
  ["/src/studio.mjs", ["src/studio.mjs", "text/javascript; charset=utf-8"]],
  ["/src/local-ai-policy.mjs", ["src/local-ai-policy.mjs", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/src/app.js", ["src/app.js", "text/javascript; charset=utf-8"]],
  ["/src/tasks.js", ["src/tasks.js", "text/javascript; charset=utf-8"]]
]);

const LOCAL_API='/api/local-velion/task-draft';
const MAX_BODY=4096;
function reply(res,status,body){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify(body));}
function readBoundedBody(req){
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0,tooLarge=false;
    req.on('data',chunk=>{size+=chunk.length;if(size>MAX_BODY){tooLarge=true;chunks.length=0;}else if(!tooLarge)chunks.push(chunk);});
    req.on('end',()=>tooLarge?reject(Error('BODY_TOO_LARGE')):resolve(Buffer.concat(chunks)));
    req.on('error',reject);req.on('aborted',()=>reject(Error('REQUEST_ABORTED')));
  });
}
export function createAppServer({localTaskService=null}={}) {
  const server=createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'");
    let pathname;
    try { pathname = new URL(req.url, "http://localhost").pathname; }
    catch { res.writeHead(400); res.end("Bad URL"); return; }
    if(pathname===LOCAL_API){
      if(req.method!=='POST'){res.writeHead(405,{"Allow":"POST"});res.end();return;}
      if(!localTaskService){req.resume();reply(res,503,{code:'LOCAL_AI_DISABLED'});return;}
      const addr=server.address(),remote=req.socket.remoteAddress;
      const authority=addr&&typeof addr==='object'?'127.0.0.1:'+addr.port:'';
      if(!['127.0.0.1','::ffff:127.0.0.1'].includes(remote)||
         req.headers.host!==authority||req.headers.origin!=='http://'+authority){
        req.resume();reply(res,403,{code:'LOCAL_ORIGIN_REQUIRED'});return;
      }
      if(!localTaskService.authenticate(req.headers.authorization)){
        req.resume();reply(res,401,{code:'LOCAL_ACCESS_TOKEN_REQUIRED'});return;
      }
      if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||'')){
        req.resume();reply(res,415,{code:'JSON_REQUIRED'});return;
      }
      if(Number(req.headers['content-length'])>MAX_BODY){req.resume();reply(res,413,{code:'BODY_TOO_LARGE'});return;}
      let input;
      try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedBody(req)));}
      catch(error){reply(res,error.message==='BODY_TOO_LARGE'?413:400,{code:error.message==='BODY_TOO_LARGE'?'BODY_TOO_LARGE':'INVALID_JSON'});return;}
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).join('|')!=='goal'||typeof input.goal!=='string'){
        reply(res,400,{code:'INVALID_REQUEST'});return;
      }
      const controller=new AbortController();
      const onClose=()=>{if(!res.writableEnded)controller.abort();};
      res.once('close',onClose);
      if(res.destroyed)controller.abort();
      try{
        const result=await localTaskService.generate(input.goal,{signal:controller.signal});
        if(!controller.signal.aborted)reply(res,201,result);
      }
      catch(error){
        if(controller.signal.aborted)return;
        const code=error?.code;
        if(code==='LOCAL_GENERATION_BUSY'||code==='LOCAL_MODEL_BUSY'){reply(res,409,{code});return;}
        if(code==='LOCAL_MODEL_FORMAT_DISABLED'){reply(res,503,{code});return;}
        if(code==='ONLY_TASK_MANAGER_V1_SUPPORTED'||error?.name==='DraftContractError'){
          reply(res,422,{code:'INVALID_OR_UNSUPPORTED_TASK_REQUEST'});return;
        }
        if(code==='LOCAL_MODEL_UNAVAILABLE'||code==='LOCAL_MODEL_HTTP_FAILED'||code==='LOCAL_MODEL_RESPONSE_REJECTED'||
           code==='LOCAL_MODEL_RESPONSE_INCOMPLETE'||code==='LOCAL_MODEL_RESPONSE_SCHEMA_INVALID'){
          reply(res,502,{code});return;
        }
        reply(res,422,{code:'MODEL_DRAFT_OR_QUARANTINE_REJECTED'});
      }finally{res.off('close',onClose);}
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, {"Allow": "GET, HEAD"}); res.end("Method not allowed"); return;
    }
    const entry = routes.get(pathname);
    if (!entry) { res.writeHead(404); res.end("Not found"); return; }
    try {
      const [file, contentType] = entry;
      const content = await readFile(join(ROOT, file));
      res.writeHead(200, {"Content-Type": contentType, "Content-Length": content.byteLength});
      res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      res.writeHead(500); res.end("Server error");
    }
  });
  server.headersTimeout=10000;
  server.requestTimeout=15000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError("Invalid PORT");
  const localTaskService=localTaskServiceFromEnv();
  createAppServer({localTaskService}).listen(port, "127.0.0.1", () => {
    process.stdout.write("CONSTRUCTOR AI reference running at http://127.0.0.1:" + port + "\n");
  });
}

