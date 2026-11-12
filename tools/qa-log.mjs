// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Unauthenticated TAP observation; never evidence of sandbox origin or release authority.
export function assertIndependentQaLog(log){
  if(typeof log!=='string'||log.length>80000)throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  const counts={tests:3,pass:3,fail:0,cancelled:0,skipped:0,todo:0};
  for(const [name,expected] of Object.entries(counts)){
    const lines=[...log.matchAll(new RegExp('^# '+name+' (\\d+)\\r?$','gm'))];
    if(lines.length!==1||Number(lines[0][1])!==expected)throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  }
  for(const name of ['model generated real task creation contract','completion is immutable and independently observable','filterOpen is nonmutating with realistic case variation']){
    const lines=log.split(/\r?\n/).filter(line=>/^ok \d+ - /.test(line)&&line.replace(/^ok \d+ - /,'')===name);
    if(lines.length!==1)throw Error('INDEPENDENT_QA_LOG_NOT_ACCEPTABLE');
  }
}
