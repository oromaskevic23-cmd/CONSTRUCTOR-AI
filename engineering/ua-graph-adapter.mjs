/** CONSTRUCTOR AI: read-only import of an Understand Anything codebase graph.
 * Graph descriptions are untrusted data. No scripts/models/plugins executed or installed.
 * Based on upstream KnowledgeGraph types.ts, pinned at the revision below.
 */
import {createHash} from 'node:crypto';

export const UA_SOURCE_SHA='4e6d3299017a7432da15957874992837a315c5b4';
const NODE_TYPES=new Set([
  'file','function','class','module','concept','config','document','service','table',
  'endpoint','pipeline','schema','resource','domain','flow','step','article','entity',
  'topic','claim','source','page','screen','component','componentSet','instance','token'
]);
const IMPACT_EDGES=new Set(['imports','depends_on','calls','configures']);
const EDGES=new Set([
 'imports','exports','contains','inherits','implements','calls','subscribes','publishes',
 'middleware','reads_from','writes_to','transforms','validates','depends_on',
 'tested_by','configures','related','similar_to','deploys','serves','provisions','triggers',
 'migrates','documents','routes','defines_schema','contains_flow','flow_step',
 'cross_domain','cites','contradicts','builds_on','exemplifies','categorized_under',
 'authored_by','instance_of','variant_of','uses_token'
]);
const assert=(ok,code)=>{if(!ok)throw Error(code);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const txt=(s,limit=256)=>typeof s==='string'&&s.length>0&&s.length<=limit;
const safePath=s=>txt(s,400)&&!s.startsWith('/')&&!s.includes('\\')&&
  !s.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('.'))&&
  !/[\x00-\x1f\x7f]/.test(s)&&!s.includes(':');

export function inspectUnderstandAnythingGraph(source,{expectedProjectCommit,sourceSha=UA_SOURCE_SHA,changedPaths=[]}={}) {
  assert(sourceSha===UA_SOURCE_SHA,'UNPINNED_GRAPH_TOOL');
  assert(txt(expectedProjectCommit,40)&&/^[0-9a-f]{40}$/.test(expectedProjectCommit),'EXPECTED_PROJECT_COMMIT_REQUIRED');
  assert(typeof source==='string'&&Buffer.byteLength(source,'utf8')<=2_000_000,'GRAPH_INPUT_LIMIT');
  let g;try{g=JSON.parse(source);}catch{throw Error('GRAPH_JSON_INVALID');}
  assert(obj(g)&&txt(g.version,40)&&g.kind==='codebase'&&obj(g.project)&&
    g.project.gitCommitHash===expectedProjectCommit,'GRAPH_PROVENANCE_MISMATCH');
  assert(Array.isArray(g.nodes)&&g.nodes.length>0&&g.nodes.length<=10000&&
    Array.isArray(g.edges)&&g.edges.length<=40000,'GRAPH_SIZE_INVALID');
  const nodes=new Map();
  for(const n of g.nodes){
    assert(obj(n)&&txt(n.id,180)&&txt(n.name,300)&&NODE_TYPES.has(n.type)&&
      txt(n.summary,10000)&&Array.isArray(n.tags)&&
      ['simple','moderate','complex'].includes(n.complexity),'GRAPH_NODE_INVALID');
    assert(n.filePath===undefined||safePath(n.filePath),'GRAPH_PATH_DENIED');
    assert(!nodes.has(n.id),'GRAPH_DUPLICATE_NODE');
    nodes.set(n.id,{id:n.id,type:n.type,filePath:n.filePath||null});
  }
  assert(Array.isArray(changedPaths)&&changedPaths.length<=1000&&
    changedPaths.every(safePath),'CHANGED_PATHS_DENIED');
  const reverse=new Map();
  for(const e of g.edges){
    assert(obj(e)&&txt(e.source,180)&&txt(e.target,180)&&
      nodes.has(e.source)&&nodes.has(e.target)&&EDGES.has(e.type)&&
      ['forward','backward','bidirectional'].includes(e.direction)&&
      typeof e.weight==='number'&&Number.isFinite(e.weight)&&e.weight>=0&&e.weight<=1,
      'GRAPH_EDGE_INVALID');
    if(!IMPACT_EDGES.has(e.type))continue;
    // Upstream source -> target means source depends upon target (for imports/calls).
    // Reverse adjacency finds potentially affected dependents, not proven runtime impact.
    const add=(from,to)=>{
      if(!reverse.has(from))reverse.set(from,new Set());
      reverse.get(from).add(to);
    };
    if(e.direction==='forward'||e.direction==='bidirectional')add(e.target,e.source);
    if(e.direction==='backward'||e.direction==='bidirectional')add(e.source,e.target);
  }
  const seed=[...nodes.values()].filter(n=>n.filePath&&changedPaths.includes(n.filePath)).map(n=>n.id);
  const visited=new Set(seed),queue=[...seed];
  for(let i=0;i<queue.length;i++){
    for(const dependent of reverse.get(queue[i])||[]){
      if(!visited.has(dependent)){visited.add(dependent);queue.push(dependent);}
    }
  }
  const paths=[...new Set([...visited].map(id=>nodes.get(id)?.filePath).filter(Boolean))].sort();
  const digest=createHash('sha256').update(source).digest('hex');
  return Object.freeze({
    schema:'constructor.ai.readonly_graph_impact.v1',
    upstreamSha:UA_SOURCE_SHA,graphSha256:digest,projectCommit:expectedProjectCommit,
    graphNodes:nodes.size,graphEdges:g.edges.length,
    changedFiles:[...new Set(changedPaths)].sort(),
    possiblyAffectedFiles:paths,
    impact:'ADVISORY_ONLY_UNVERIFIED_SEMANTIC_EDGES',
    automaticCodeChanges:false,release:'NOT_AUTHORIZED',
    privateCodeUploaded:false,networkCalls:0,modelCalls:0
  });
}
