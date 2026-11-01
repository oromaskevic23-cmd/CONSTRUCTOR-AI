// Reproducible, dependency-free acceptance ZIP assembly for all three reviewed templates.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildProject, SOURCE_PATHS} from '../src/project-export.mjs';
import {createZip} from '../src/zip.mjs';
import {TEMPLATE_IDS} from '../src/project-domain.mjs';
const output = process.argv[2];
if (!output) throw Error('Usage: node tools/build-acceptance.mjs NEW_EMPTY_DIRECTORY');
const dir = resolve(output);
await mkdir(dir, {recursive:false}); // Never silently overwrite prior acceptance evidence.
const sources = Object.fromEntries(await Promise.all(SOURCE_PATHS.map(async p =>
  [p, await readFile(new URL('../src/'+p, import.meta.url), 'utf8')])));
const artifacts = [];
for (const template of TEMPLATE_IDS) {
  const project = await buildProject({template, name:'Independent '+template+' verification'}, sources);
  if (!project.files.some(f => f.path === 'project-backup.mjs') ||
      !project.files.some(f => f.path === 'test/backup.test.mjs') ||
      !project.files.some(f => f.path === 'manifest.json')) throw Error('Incomplete portable export');
  const zip = createZip(project.files);
  const filename = template + '-local-app.zip';
  await writeFile(join(dir, filename), zip, {flag:'wx'});
  artifacts.push({template, filename, bytes:zip.byteLength,
    sha256:createHash('sha256').update(zip).digest('hex')});
}
const record = {
  schema:'constructor-flagship-acceptance-v1',
  sourceCommit:process.env.GITHUB_SHA || null,
  verification:'BUILT_FROM_REVIEWED_TEMPLATES_NOT_AN_EXTERNAL_SECURITY_AUDIT',
  artifacts
};
await writeFile(join(dir,'acceptance-manifest.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log('Built '+artifacts.length+' local application ZIPs; see '+join(dir,'acceptance-manifest.json'));
