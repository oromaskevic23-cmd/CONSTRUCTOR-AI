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
    const declarations=test.body.filter(node=>node.type==='ImportDeclaration');
    const imports=declarations.map(node=>node.source.value);
    if(!imports.includes('node:test'))issues.push('TEST_NODE_TEST_IMPORT_MISSING');
    if(!imports.includes('node:assert/strict'))issues.push('TEST_ASSERT_STRICT_IMPORT_MISSING');
    if(!imports.includes('../app.mjs'))issues.push('TEST_APP_IMPORT_MISSING');
    const names=new Set(),registrars=new Set();
    for(const node of declarations){
      if(node.source.value==='../app.mjs')for(const spec of node.specifiers)
        if(spec.type==='ImportSpecifier')names.add(spec.imported.name??spec.imported.value);
      if(node.source.value==='node:test')for(const spec of node.specifiers)
        if(spec.type==='ImportDefaultSpecifier'||
          (spec.type==='ImportSpecifier'&&['test','it'].includes(spec.imported.name??spec.imported.value)))
          registrars.add(spec.local.name);
    }
    for(const name of ['createTask','completeTask','filterOpen'])
      if(!names.has(name))issues.push('TEST_TASK_IMPORT_MISSING_'+name.toUpperCase());
    // Require a direct top-level call with a function body. This is a narrow
    // structural check, not proof that a meaningful test will run or pass.
    const registered=test.body.some(node=>{
      const call=node.type==='ExpressionStatement'&&node.expression;
      if(!call||call.type!=='CallExpression'||call.callee.type!=='Identifier'||
         !registrars.has(call.callee.name)||
         !call.arguments.some(arg=>['ArrowFunctionExpression','FunctionExpression'].includes(arg.type)))return false;
      return !call.arguments.some(arg=>arg.type==='ObjectExpression'&&arg.properties.some(prop=>
        prop.type==='Property'&&!prop.computed&&['skip','todo'].includes(prop.key.name??prop.key.value)&&
        !(prop.value.type==='Literal'&&prop.value.value===false)));
    });
    if(!registered)issues.push('TEST_REGISTRATION_MISSING');
  }
  const unique=[...new Set(issues)].sort();
  return Object.freeze({status:unique.length?'FAIL':'PASS',
    scope:'SYNTAX_AND_MODULE_SHAPE_ONLY_NOT_QA',issues:unique});
}

