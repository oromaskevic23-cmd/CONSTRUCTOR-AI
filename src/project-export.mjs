import {normalizeProject} from './project-domain.mjs';
const escapeHTML = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const SOURCE_PATHS = Object.freeze(['project-domain.mjs','project-runtime.mjs','project.css']);
export async function buildProject(input, sources) {
  const config=normalizeProject(input);
  if(!sources || Object.keys(sources).sort().join(',')!==[...SOURCE_PATHS].sort().join(',')) throw new TypeError('Reviewed template sources are required');
  for(const name of SOURCE_PATHS) if(typeof sources[name]!=='string'||!sources[name]||new TextEncoder().encode(sources[name]).length>100000) throw new RangeError('Invalid template source');
  const files=[
    {path:'index.html',content:`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${escapeHTML(config.name)}</title><link rel="stylesheet" href="styles.css"><script type="module" src="app.mjs"></script></head><body><main id="app"></main></body></html>\n`},
    {path:'app.mjs',content:`import {mountApplication} from './project-runtime.mjs';\nconst config=${JSON.stringify(config)};\nmountApplication(document.querySelector('#app'),config);\n`},
    {path:'project-domain.mjs',content:sources['project-domain.mjs']},
    {path:'project-runtime.mjs',content:sources['project-runtime.mjs']},
    {path:'styles.css',content:sources['project.css']+`\n:root{--accent:${config.accent}}\n`},
    {path:'package.json',content:JSON.stringify({name:'constructor-exported-app',version:'1.0.0',private:true,type:'module',engines:{node:'>=22'},scripts:{start:'node serve.mjs',test:'node --test test/*.test.mjs',verify:'node verify.mjs'}},null,2)+'\n'},
    {path:'serve.mjs',content:SERVER},
    {path:'verify.mjs',content:VERIFIER},
    {path:'test/app.test.mjs',content:`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {saveRecord,changeStatus,removeRecord,summarizeRecords,templateDefinition} from '../project-domain.mjs';\nconst kind=${JSON.stringify(config.template)};\ntest('workspace records complete the create-edit-status-delete flow',()=>{const r={id:'first',title:'Example',detail:'',value:25,status:templateDefinition(kind).statuses[0]};const initial=saveRecord([],r,kind);const edited=saveRecord(initial,{...r,title:'Edited'},kind);assert.equal(initial[0].title,'Example');assert.equal(edited[0].title,'Edited');assert.notEqual(changeStatus(edited,r.id,kind)[0].status,r.status);assert.equal(summarizeRecords(edited,kind)[0][1],1);assert.deepEqual(removeRecord(edited,r.id,kind),[]);});\n`},
    {path:'README.md',content:`# Exported application\n\nCreated with CONSTRUCTOR AI Template Studio from the ${config.template} built-in template. This is a local single-user application; data stays in this browser's localStorage. Use Export data for a JSON backup.\n\nRequires Node.js 22 or later. No dependency installation or model key is needed.\n\n1. Run \`npm run verify\` to check file integrity. Hashes do not authenticate the author.\n2. Run \`npm test\` to test the record operations. These are not browser tests.\n3. Run \`npm start\`, then open http://127.0.0.1:4174.\n\nSource files are editable. Changes invalidate the original integrity manifest. This export is not a multi-user hosted service and has no customer authentication, cloud backup, payment processing or arbitrary AI code execution. Source-license and contributor rights require separate review before redistribution or sale.\n\nCONSTRUCTOR AI · IMPERIAL Core · Alexander Romaskevich / RomaskevicH\n`}
  ];
  const digests=[];
  for(const file of files){const bytes=new TextEncoder().encode(file.content); const hash=await crypto.subtle.digest('SHA-256',bytes);digests.push({path:file.path,bytes:bytes.length,sha256:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')});}
  files.push({path:'manifest.json',content:JSON.stringify({schema:'constructor-template-export-v1',generator:'CONSTRUCTOR AI',template:config.template,method:'reviewed-built-in-template',verification:'INTEGRITY_ONLY_NOT_AUTHORSHIP_OR_PRODUCTION',files:digests},null,2)+'\n'});
  return {config,files};
}
const SERVER=`import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const routes={'/':'index.html','/index.html':'index.html','/app.mjs':'app.mjs','/project-domain.mjs':'project-domain.mjs','/project-runtime.mjs':'project-runtime.mjs','/styles.css':'styles.css'};
createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'");if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}const path=new URL(req.url,'http://localhost').pathname;if(!Object.hasOwn(routes,path)){res.writeHead(404);return res.end();}const name=routes[path];try{const data=await readFile(new URL(name,import.meta.url));res.writeHead(200,{'Content-Type':name.endsWith('.mjs')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(500);res.end('File unavailable');}}).listen(4174,'127.0.0.1',()=>console.log('Open http://127.0.0.1:4174'));\n`;
const VERIFIER=`import {readFile,lstat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const expected=['index.html','app.mjs','project-domain.mjs','project-runtime.mjs','styles.css','package.json','serve.mjs','verify.mjs','test/app.test.mjs','README.md'].sort();
const root=new URL('./',import.meta.url);const manifestURL=new URL('manifest.json',root);
if(!(await lstat(manifestURL)).isFile())throw Error('Manifest must be a regular file');
const manifest=JSON.parse(await readFile(manifestURL,'utf8'));
if(manifest.schema!=='constructor-template-export-v1'||!Array.isArray(manifest.files)||manifest.files.map(f=>f.path).sort().join('|')!==expected.join('|'))throw Error('Invalid manifest inventory');
for(const f of manifest.files){const path=new URL(f.path,root),st=await lstat(path);if(!st.isFile()||st.isSymbolicLink())throw Error('Unexpected file type');const b=await readFile(path);if(b.length!==f.bytes||createHash('sha256').update(b).digest('hex')!==f.sha256)throw Error('Integrity mismatch: '+f.path);}
async function list(url,prefix=''){let paths=[];for(const e of await readdir(url,{withFileTypes:true})){const p=prefix+e.name;if(e.isDirectory())paths.push(...await list(new URL(e.name+'/',url),p+'/'));else paths.push(p);}return paths;}
if((await list(root)).sort().join('|')!==[...expected,'manifest.json'].sort().join('|'))throw Error('Unexpected files');
console.log('PASS: '+expected.length+' file hashes match. Integrity only; not authorship or production certification.');\n`;
