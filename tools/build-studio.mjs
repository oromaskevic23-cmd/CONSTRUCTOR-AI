import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination=process.argv[2];
if(!destination)throw new Error('Usage: node tools/build-studio.mjs NEW_OUTPUT_DIRECTORY');
const out=resolve(destination);
await mkdir(out,{recursive:false});
const paths=['studio.html','studio.css','src/studio.mjs','src/project-domain.mjs','src/project-runtime.mjs','src/project-export.mjs','src/project.css','src/zip.mjs'];
const records=[];
for(const path of paths){const bytes=await readFile(resolve(root,path));await mkdir(dirname(resolve(out,path)),{recursive:true});await writeFile(resolve(out,path),bytes,{flag:'wx'});records.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await writeFile(resolve(out,'deployment-manifest.json'),JSON.stringify({schema:'constructor-studio-deployment-v1',files:records},null,2)+'\n',{flag:'wx'});
console.log('Built '+paths.length+' reviewed static files in '+out);
