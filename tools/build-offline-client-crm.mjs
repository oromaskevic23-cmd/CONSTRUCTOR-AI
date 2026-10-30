/** Offline Client Pipeline CRM — reproducible product assembler.
 * Executes only the existing, reviewed CONSTRUCTOR AI Template Studio exporter.
 * No AI model, network, payment, install, remote access, deployment or repository mutation.
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildProject,SOURCE_PATHS} from '../src/project-export.mjs';

const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=process.argv[2];
if (!target || process.argv.length!==3) throw Error('Usage: node tools/build-offline-client-crm.mjs NEW_OUTPUT_DIRECTORY');
const destination=resolve(target);
if (destination===appRoot || destination.startsWith(appRoot+sep)) throw Error('SOURCE_TREE_OUTPUT_DENIED');
const sources=Object.fromEntries(await Promise.all(SOURCE_PATHS.map(async path=>[
  path,await readFile(resolve(appRoot,'src',path),'utf8')
])));
const product=await buildProject({
  template:'crm',
  name:'Offline Client Pipeline',
  accent:'#3469db'
},sources);
if (product.config.template!=='crm'||product.files.length!==11) throw Error('UNEXPECTED_TEMPLATE_CONTRACT');
await mkdir(destination,{recursive:false,mode:0o755});
for(const file of product.files){
  if(!/^(test\/app\.test\.mjs|[A-Za-z0-9-]+\.(?:mjs|json|html|css|md))$/.test(file.path))throw Error('OUTPUT_PATH_DENIED');
  const dest=resolve(destination,file.path);
  if(!(dest.startsWith(destination+sep)))throw Error('OUTPUT_ESCAPE_DENIED');
  await mkdir(dirname(dest),{recursive:true});
  await writeFile(dest,file.content,{flag:'wx',mode:0o644});
}
const manifestBytes=await readFile(resolve(destination,'manifest.json'));
const proof={
  schema:'imperial.constructor.offline_product.v1',
  product:'OFFLINE_CLIENT_PIPELINE_CRM',
  productType:'reviewed_builtin_template',
  rolesPlanned:['NCA-ARCHITECT','NCA-BUILDER','NCA-TESTER','NCA-REVIEWER','NCA-RELEASE_CURATOR'],
  actualAutonomousAgentExecutions:0,
  executedInDocker:process.env.IMPERIAL_ISOLATED_TEST==='yes',
  sourceAuthority:'CONSTRUCTOR_AI_GIT_COMMIT_CHECKOUT',
  template:'crm',
  exportFileCount:product.files.length,
  manifestSha256:createHash('sha256').update(manifestBytes).digest('hex'),
  independentQA:'PENDING',
  browserE2E:'NOT_RUN',
  productionDeployment:'NOT_PERFORMED',
  release:'NOT_AUTHORIZED',
  payments:0,
  modelInference:'NOT_PERFORMED',
  generatedBy:'REVIEWED_DETERMINISTIC_EXPORTER'
};
const proofPath=resolve(dirname(destination),'build-proof.json');
await writeFile(proofPath,JSON.stringify(proof,null,2)+'\n',{flag:'wx',mode:0o644});
console.log(JSON.stringify({event:'PRODUCT_BUILT',product:proof.product,files:product.files.length,manifestSha256:proof.manifestSha256,productionDeployment:false}));
