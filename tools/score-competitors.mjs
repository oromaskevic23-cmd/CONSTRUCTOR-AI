/** Read-only offline scorecard CLI. Author: Alexander Nikolaevich Romaskevich (RomaskevicH). */
import {readFile} from 'node:fs/promises';
import {loadCatalog,evaluateRun,compareRunReports} from '../engineering/competitive-scorecard.mjs';
const [,,catalogPath,firstPath,secondPath] = process.argv;
if (process.argv.length!==4 && process.argv.length!==5)
  throw Error('USAGE: node tools/score-competitors.mjs CATALOG RUN.json [SECOND_RUN.json]');
const suite=await loadCatalog(catalogPath);
const first=JSON.parse(await readFile(firstPath,'utf8'));
const result=secondPath
  ? compareRunReports(first,JSON.parse(await readFile(secondPath,'utf8')),suite)
  : evaluateRun(first,suite);
console.log(JSON.stringify(result,null,2));
