/** CONSTRUCTOR AI — bounded, read-only, deterministic context selection.
 * No LLM calls, model routing, source modification, filesystem execution or remote transfer.
 * Selected source is UNTRUSTED DATA; static secret detection is heuristic, not DLP.
 */
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat, opendir, open, realpath} from 'node:fs/promises';
import {join, relative, resolve, sep} from 'node:path';

const sha256 = input => createHash('sha256').update(input).digest('hex');
const textDecoder = new TextDecoder('utf-8', {fatal:true});
const VALID_EXT = /\.(?:[cm]?js|[cm]?ts|tsx|jsx|json|css|html|md|py|go|rs|java|sql|yaml|yml)$/i;
const DENY_DIR = new Set(['.git','.github','node_modules','vendor','dist','build','coverage','artifacts','tmp','temp','.next','.cache','.venv','venv','private','secrets','credentials']);
const DENY_FILE = /(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.gitignore|\.dockerconfigjson|id_rsa(?:\.pub)?|id_ed25519(?:\.pub)?|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|.*\.(?:pem|key|p12|pfx|crt|cer|sqlite|db)|credentials(?:\..*)?|secrets(?:\..*)?)$/i;
const SECRET = [
  /-----BEGIN (?:[A-Z ]* )?PRIVATE KEY-----/i,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /\b(?:gsk_|sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{16,}\b/,
  /\b(?:api[_-]?key|secret|password|auth[_-]?token|access[_-]?token)\b\s*[:=]\s*['"][A-Za-z0-9+/_=.\-]{12,}['"]/i,
];
const MAX_SCAN_FILES=250, MAX_SCAN_BYTES=4_000_000, MAX_FILE_BYTES=64_000;
const MAX_DEPTH=7, MAX_ITEMS=12;
const STOPWORDS=new Set(['the','and','for','with','from','into','this','that','your','would','should','create','make','build','fix','please','code','file','files','project','app','src','test','tests','need','our','are','is','of','to','on','a','in','an','как','для','это','чтобы','кода','сделай','нужно','проект','файл']);

export class ContextShieldDenied extends Error {
  constructor(code){super(code);this.name='ContextShieldDenied';this.code=code;}
}
function assert(condition,code){if(!condition)throw new ContextShieldDenied(code);}
function keywords(objective){
  const raw=objective.normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{N}]{3,32}/gu)??[];
  return [...new Set(raw.filter(word=>!STOPWORDS.has(word)))].slice(0,24);
}
function safeSegment(name){
  return typeof name==='string' && name.length>0 && name.length<=150 &&
    !/[\x00-\x1f\x7f\\:]/.test(name) && name!=='.' && name!=='..';
}
function ignored(path){
  if(DENY_FILE.test(path))return true;
  return path.split('/').some(s=>s.startsWith('.')||!safeSegment(s));
}
function plausibleSecret(text){return SECRET.some(re=>re.test(text));}
function rank(path,content,terms){
  const location=path.toLocaleLowerCase('en'), body=content.toLocaleLowerCase('en');
  return terms.reduce((score,term)=>{
    const inPath=location.includes(term), inBody=body.includes(term);
    return score+(inPath?12:0)+(inBody?2:0);
  },0);
}

/** Returns complete immutable source snapshots, never generated directives or permission claims.
 * Source byte budget is exact; it is NOT an exact model token or API cost estimate.
 */
export async function buildVerifiedContext({workspaceRoot, objective, maxSourceBytes=8192}={}){
  assert(typeof workspaceRoot==='string' && workspaceRoot.length>0 && workspaceRoot.length<=2048,
    'WORKSPACE_ROOT_REQUIRED');
  assert(typeof objective==='string' && objective.trim().length>=3 && objective.length<=1000 &&
    !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(objective), 'OBJECTIVE_INVALID');
  assert(Number.isSafeInteger(maxSourceBytes)&&maxSourceBytes>=512&&maxSourceBytes<=32768,
    'INVALID_CONTEXT_BUDGET');
  const root=resolve(workspaceRoot);
  const rootInfo=await lstat(root);
  assert(rootInfo.isDirectory()&&!rootInfo.isSymbolicLink(),'UNSAFE_WORKSPACE_ROOT');
  const canonicalRoot=await realpath(root);
  const terms=keywords(objective);
  assert(terms.length>0,'NO_MEANINGFUL_OBJECTIVE_TERMS');
  const candidates=[];
  let inspected=0, scannedBytes=0, ignoredFiles=0, blockedForSecrets=0;

  async function visit(folder,depth){
    assert(depth<=MAX_DEPTH,'CONTEXT_DIRECTORY_DEPTH_LIMIT');
    const entries=[];
    const stream=await opendir(folder);
    for await (const entry of stream) entries.push(entry);
    entries.sort((a,b)=>a.name.localeCompare(b.name,'en'));
    for(const entry of entries){
      const full=join(folder,entry.name);
      const name=relative(canonicalRoot,full).split(sep).join('/');
      assert(name && !name.startsWith('../') && !name.startsWith('/'),'PATH_ESCAPES_ROOT');
      if(!safeSegment(entry.name)||entry.isSymbolicLink()){ignoredFiles++;continue;}
      if(entry.isDirectory()){
        if(DENY_DIR.has(entry.name.toLowerCase())||entry.name.startsWith('.'))continue;
        // Directory identity is still subject to TOCTOU; no hostile-workspace security claim.
        const st=await lstat(full);
        if(!st.isDirectory()||st.isSymbolicLink()){ignoredFiles++;continue;}
        await visit(full,depth+1);
      }else if(entry.isFile()){
        if(ignored(name)||!VALID_EXT.test(name)){ignoredFiles++;continue;}
        inspected++;
        assert(inspected<=MAX_SCAN_FILES,'CONTEXT_FILE_COUNT_LIMIT');
        const handle=await open(full,constants.O_RDONLY|constants.O_NOFOLLOW);
        try{
          const info=await handle.stat();
          if(!info.isFile()||info.size>MAX_FILE_BYTES){ignoredFiles++;continue;}
          scannedBytes+=info.size;
          assert(scannedBytes<=MAX_SCAN_BYTES,'CONTEXT_SCAN_BYTE_LIMIT');
          const buffer=await handle.readFile();
          assert(buffer.length<=MAX_FILE_BYTES,'CONTEXT_FILE_CHANGED_DURING_READ');
          let content;
          try{content=textDecoder.decode(buffer);}catch{ignoredFiles++;continue;}
          if(content.includes('\x00')){ignoredFiles++;continue;}
          if(plausibleSecret(content)){blockedForSecrets++;continue;}
          const score=rank(name,content,terms);
          if(score>0) candidates.push({path:name,sha256:sha256(buffer),bytes:buffer.length,
            score,content});
        }finally{await handle.close();}
      }else ignoredFiles++;
    }
  }
  await visit(canonicalRoot,0);
  candidates.sort((a,b)=>b.score-a.score || a.path.localeCompare(b.path,'en'));
  const selected=[];
  let used=0;
  for(const item of candidates){
    if(selected.length===MAX_ITEMS)break;
    if(used+item.bytes>maxSourceBytes)continue;
    selected.push(item);used+=item.bytes;
  }
  assert(selected.length>0,'NO_RELEVANT_CONTEXT_WITHIN_BUDGET');
  const packItems=selected.map(({path,sha256,bytes,score,content})=>
    Object.freeze({path,sha256,bytes,score,content,trust:'UNTRUSTED_REPOSITORY_DATA'}));
  const packDigest=sha256(JSON.stringify({objective,entries:packItems}));
  return Object.freeze({
    schema:'constructor.ai.verified_context.v1',
    objective, entries:Object.freeze(packItems), packSha256:packDigest,
    selectedFiles:packItems.length,selectedSourceBytes:used,
    maxSourceBytes, scannedSourceBytes:scannedBytes,
    candidateFiles:candidates.length, scannedFiles:inspected,
    ignoredFiles, blockedForSecrets,
    selectionMethod:'DETERMINISTIC_KEYWORD_RELEVANCE_NOT_SEMANTIC_SEARCH',
    promptInjectionDefense:'SOURCE_TEXT_IS_UNTRUSTED_DATA',
    modelTokenCount:'NOT_MEASURED', inferenceCostUsd:'NOT_MEASURED',
    networkCalls:0,modelCalls:0,filesModified:0,
    verifiedSecurityIsolation:false,privateCodeUploaded:false,
    release:'DENIED',productionAuthority:false
  });
}

/** Revalidate the in-memory pack against a trusted local working tree before use.
 * Detects changed source bytes and tampered context metadata; not a signature.
 */
export async function verifyContextSnapshot({workspaceRoot, pack}={}){
  assert(typeof workspaceRoot==='string'&&workspaceRoot.length>0, 'WORKSPACE_ROOT_REQUIRED');
  assert(pack && typeof pack==='object' && !Array.isArray(pack) &&
    pack.schema==='constructor.ai.verified_context.v1' &&
    typeof pack.objective==='string' && Array.isArray(pack.entries) &&
    pack.entries.length>0 && pack.entries.length<=MAX_ITEMS &&
    typeof pack.packSha256==='string' && /^[0-9a-f]{64}$/.test(pack.packSha256),
    'CONTEXT_PACK_SCHEMA_INVALID');
  const root=resolve(workspaceRoot);
  const stat=await lstat(root);
  assert(stat.isDirectory()&&!stat.isSymbolicLink(),'UNSAFE_WORKSPACE_ROOT');
  const real=await realpath(root);
  const seen=new Set();
  let size=0;
  for(const entry of pack.entries){
    assert(entry&&typeof entry==='object' && !Array.isArray(entry) &&
      Object.keys(entry).sort().join(',')==='bytes,content,path,score,sha256,trust' &&
      typeof entry.path==='string' && entry.path.length<=900 &&
      !entry.path.startsWith('/') && !ignored(entry.path) &&
      entry.path.split('/').every(s=>safeSegment(s)&&s!=='.'&&s!=='..') &&
      VALID_EXT.test(entry.path) && !seen.has(entry.path) &&
      typeof entry.content==='string' && typeof entry.sha256==='string' &&
      /^[0-9a-f]{64}$/.test(entry.sha256) && Number.isSafeInteger(entry.bytes) &&
      Number.isSafeInteger(entry.score) && entry.score>0 &&
      entry.trust==='UNTRUSTED_REPOSITORY_DATA', 'CONTEXT_ENTRY_INVALID');
    seen.add(entry.path);
    const bytes=Buffer.from(entry.content,'utf8');
    assert(entry.bytes===bytes.length && entry.sha256===sha256(bytes),
      'CONTEXT_ENTRY_TAMPERED');
    size+=entry.bytes;
    const file=join(real,...entry.path.split('/'));
    // Every parent component must remain a real directory, not a symlink.
    const dirs=entry.path.split('/').slice(0,-1);
    let current=real;
    for(const name of dirs){
      current=join(current,name);
      const info=await lstat(current);
      assert(info.isDirectory()&&!info.isSymbolicLink(),'CONTEXT_PATH_LINK_DENIED');
    }
    const st=await lstat(file);
    assert(st.isFile()&&!st.isSymbolicLink(),'CONTEXT_PATH_LINK_DENIED');
    const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
    try{
      const disk=await handle.readFile();
      assert(disk.length===bytes.length && sha256(disk)===entry.sha256,
        'CONTEXT_SOURCE_DRIFT');
    }finally{await handle.close();}
  }
  assert(Number.isSafeInteger(pack.maxSourceBytes) &&
    pack.maxSourceBytes>=512&&pack.maxSourceBytes<=32768 &&
    size===pack.selectedSourceBytes && size<=pack.maxSourceBytes &&
    pack.selectedFiles===pack.entries.length, 'CONTEXT_BUDGET_INCONSISTENT');
  assert(pack.packSha256===sha256(JSON.stringify({objective:pack.objective,
    entries:pack.entries})), 'CONTEXT_PACK_DIGEST_MISMATCH');
  return Object.freeze({status:'LOCAL_BYTES_REVERIFIED_NOT_SIGNED',
    packSha256:pack.packSha256,filesVerified:pack.entries.length,
    sourceBytesVerified:size,networkCalls:0,modelCalls:0,
    independentQa:'NOT_RUN',release:'DENIED'});
}
