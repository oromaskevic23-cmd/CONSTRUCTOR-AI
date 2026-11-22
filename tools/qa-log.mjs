// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Unauthenticated TAP observation; never evidence of sandbox origin or release authority.
export function assertIndependentQaLog(log){
  if(typeof log!=='string'||log.length>80000)throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  // Reject terminal controls that could mislead a reviewer.
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(log))
    throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  const counts={tests:3,suites:0,pass:3,fail:0,cancelled:0,skipped:0,todo:0};
  for(const [name,expected] of Object.entries(counts)){
    const lines=[...log.matchAll(new RegExp('^# '+name+' (\\d+)\\r?$','gm'))];
    if(lines.length!==1||Number(lines[0][1])!==expected)throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  }
  // Require exactly three successful top-level TAP results in their declared order.
  // Summary lines alone are not proof of a passing test run.
  const expected=[
    'model generated real task creation contract',
    'completion is immutable and independently observable',
    'filterOpen is nonmutating with realistic case variation',
  ];
  const lines=log.split(/\r?\n/);
  if(lines.filter(line=>line==='TAP version 13').length!==1||lines[0]!=='TAP version 13')
    throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  if(lines.some(line=>/^not ok(?:\s|$)/.test(line)||/^\s*(?:ok|not ok)\s+\d+.*#\s*(?:SKIP|TODO)\b/i.test(line)))
    throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  // A TAP bailout or embedded error report must never be accepted as clean QA.
  if(lines.some(line=>/^\s*(?:Bail out!|TAP version (?!13$)|#\s*(?:error|failure|uncaughtException)\b)/i.test(line)))
    throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  const results=lines.filter(line=>/^(?:ok|not ok)\s+\d+\s+-\s+/.test(line));
  if(results.length!==expected.length||
     results.some((line,i)=>line!==`ok ${i+1} - ${expected[i]}`))
    throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  const plans=lines.filter(line=>/^1\.\.\d+\r?$/.test(line));
  if(plans.length!==1||plans[0]!=='1..3')
    throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  for(const name of ['model generated real task creation contract','completion is immutable and independently observable','filterOpen is nonmutating with realistic case variation']){
    const lines=log.split(/\r?\n/).filter(line=>/^ok \d+ - /.test(line)&&line.replace(/^ok \d+ - /,'')===name);
    if(lines.length!==1)throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  }
}
