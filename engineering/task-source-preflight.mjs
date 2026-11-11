// Non-executing syntax and module-shape checks. Not a sandbox or independent QA.
import {parse} from 'acorn';

export function inspectTaskSource(files){
  if(!Array.isArray(files)||files.length!==2||
     files.some(file=>!file||typeof file.path!=='string'||typeof file.content!=='string'||file.content.length>20000)||
     files.map(file=>file.path).sort().join('|')!=='app.mjs|test/app.test.mjs')
    throw Error('TASK_PREFLIGHT_INPUT_INVALID');
  const byPath=new Map(files.map(file=>[file.path,file.content]));
  const issues=[];
  let app,test;
  try{app=parse(byPath.get('app.mjs'),{ecmaVersion:'latest',sourceType:'module'});}
  catch{issues.push('APP_PARSE_ERROR');}
  try{test=parse(byPath.get('test/app.test.mjs'),{ecmaVersion:'latest',sourceType:'module'});}
  catch{issues.push('TEST_PARSE_ERROR');}
  if(app){
    const exported=new Set();
    for(const node of app.body){
      if(node.type==='ImportDeclaration'||node.type==='ExportAllDeclaration'||
         (node.type==='ExportNamedDeclaration'&&node.source))issues.push('APP_IMPORT_OR_REEXPORT');
      if(node.type!=='ExportNamedDeclaration'||node.source)continue;
      const decl=node.declaration;
      if(decl?.id?.name)exported.add(decl.id.name);
      if(decl?.type==='VariableDeclaration')for(const item of decl.declarations)
        if(item.id.type==='Identifier')exported.add(item.id.name);
      for(const item of node.specifiers)exported.add(item.exported.name??item.exported.value);
    }
    for(const name of ['createTask','completeTask','filterOpen'])
      if(!exported.has(name))issues.push('APP_MISSING_EXPORT_'+name.toUpperCase());
    const pending=[app];
    while(pending.length){
      const node=pending.pop();if(!node||typeof node!=='object')continue;
      if(node.type==='ImportExpression'){issues.push('APP_DYNAMIC_IMPORT');break;}
      for(const value of Object.values(node)){
        if(Array.isArray(value))pending.push(...value);
        else if(value&&typeof value==='object')pending.push(value);
      }
    }
  }
  if(test){
    const imports=test.body.filter(node=>node.type==='ImportDeclaration').map(node=>node.source.value);
    if(!imports.includes('node:test'))issues.push('TEST_NODE_TEST_IMPORT_MISSING');
    if(!imports.includes('node:assert/strict'))issues.push('TEST_ASSERT_STRICT_IMPORT_MISSING');
    if(!imports.includes('../app.mjs'))issues.push('TEST_APP_IMPORT_MISSING');
  }
  const unique=[...new Set(issues)].sort();
  return Object.freeze({status:unique.length?'FAIL':'PASS',
    scope:'SYNTAX_AND_MODULE_SHAPE_ONLY_NOT_QA',issues:unique});
}
