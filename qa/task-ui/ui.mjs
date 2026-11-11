// Review-only UI shell. Candidate execution belongs in the isolated QA runner.
const MAX_TASKS=250, MAX_TITLE=120, KEY='constructor-task-pilot-v1';
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=64&&!/[^A-Za-z0-9_-]/.test(id);
const validTask=task=>!!task&&typeof task==='object'&&!Array.isArray(task)&&
  Object.keys(task).sort().join('|')==='done|id|title'&&validId(task.id)&&
  typeof task.title==='string'&&task.title.trim()===task.title&&task.title.length>0&&
  task.title.length<=MAX_TITLE&&!/[\u0000-\u001f\u007f]/.test(task.title)&&typeof task.done==='boolean';
const copy=task=>({id:task.id,title:task.title,done:task.done});

export function mountTaskUi(root,domain,{storage,idGenerator}={}){
  if(!root||!['createTask','completeTask','filterOpen'].every(name=>typeof domain?.[name]==='function'))
    throw Error('TASK_UI_CONFIGURATION_INVALID');
  const doc=root.ownerDocument,win=doc.defaultView;
  const get=id=>{const el=root.querySelector('#'+id);if(!el)throw Error('TASK_UI_MARKUP_INVALID');return el;};
  const form=get('task-form'),title=get('task-title'),list=get('task-list'),filters=get('filters'),
    notice=get('notice'),warning=get('storage-warning'),counts={all:get('count-all'),open:get('count-open'),done:get('count-done')};
  const newId=idGenerator??(()=>win.crypto.randomUUID());
  let records=[],active='all',snapshot=null,canSave=true,store=storage;
  const warn=text=>{warning.textContent=text;warning.hidden=false;};
  try{
    if(store===undefined)store=win.localStorage;
    snapshot=store.getItem(KEY);
    if(snapshot!==null){
      const data=JSON.parse(snapshot);
      if(!Array.isArray(data)||data.length>MAX_TASKS||data.some(task=>!validTask(task))||
         new Set(data.map(task=>task.id)).size!==data.length)throw Error('INVALID_STORED_TASKS');
      records=data.map(copy);
    }
  }catch{canSave=false;warn('Saved data could not be opened. New changes are kept only for this session; existing data was not replaced.');}
  function save(next){
    records=next.map(copy);
    if(canSave){
      try{
        if(store.getItem(KEY)!==snapshot){canSave=false;warn('This workspace changed in another tab. New changes are kept only for this session.');}
        else{snapshot=JSON.stringify(records);store.setItem(KEY,snapshot);}
      }catch{canSave=false;warn('Browser storage is unavailable. New changes are kept only for this session.');}
    }
    render();
  }
  function button(label,action,id){
    const el=doc.createElement('button');el.type='button';el.textContent=label;
    el.dataset.action=action;el.dataset.id=id;return el;
  }
  function render(){
    counts.all.textContent=String(records.length);
    counts.open.textContent=String(records.filter(task=>!task.done).length);
    counts.done.textContent=String(records.filter(task=>task.done).length);
    for(const el of filters.querySelectorAll('button[data-filter]'))el.setAttribute('aria-pressed',String(el.dataset.filter===active));
    let visible;
    try{
      visible=active==='open'?domain.filterOpen(records.map(copy)):records.filter(task=>active==='all'||task.done).map(copy);
      const expected=records.filter(task=>active==='all'||(active==='open'?!task.done:task.done));
      if(!Array.isArray(visible)||visible.length!==expected.length||visible.some((task,i)=>!validTask(task)||
        task.id!==expected[i].id||task.title!==expected[i].title||task.done!==expected[i].done))throw Error('BAD_FILTER_RESULT');
    }catch{visible=[];notice.textContent='Tasks could not be displayed. Your saved data has not been changed.';}
    list.replaceChildren();
    if(!visible.length){const empty=doc.createElement('li');empty.className='empty';empty.textContent=records.length?'No tasks in this view.':'A clear workspace. Add your first task above.';list.append(empty);return;}
    for(const task of visible){
      const row=doc.createElement('li');row.className='task-row';row.dataset.done=String(task.done);
      const heading=doc.createElement('p');heading.className='task-title';heading.textContent=task.title;
      const actions=doc.createElement('div');actions.className='task-actions';
      const toggle=button(task.done?'Reopen':'Complete','toggle',task.id);
      toggle.setAttribute('aria-label',(task.done?'Reopen: ':'Complete: ')+task.title);
      const del=button('Delete','delete',task.id);del.setAttribute('aria-label','Delete: '+task.title);
      actions.append(toggle,del);row.append(heading,actions);list.append(row);
    }
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    try{
      if(records.length>=MAX_TASKS)throw Error('LIMIT');
      const value=title.value.trim(),id=newId();
      if(!value||value.length>MAX_TITLE||/[\u0000-\u001f\u007f]/.test(value)||!validId(id)||records.some(task=>task.id===id))throw Error('INPUT');
      const task=domain.createTask(id,value);
      if(!validTask(task)||task.id!==id||task.title!==value||task.done)throw Error('BAD_CREATE_RESULT');
      save([copy(task),...records]);title.value='';notice.textContent='Task added.';title.focus();
    }catch{notice.textContent='Unable to add the task. Check the title and try again.';}
  });
  filters.addEventListener('click',event=>{
    const target=event.target.closest('button[data-filter]');
    if(!target||!filters.contains(target)||!['all','open','done'].includes(target.dataset.filter))return;
    active=target.dataset.filter;render();
  });
  list.addEventListener('click',event=>{
    const target=event.target.closest('button[data-action]');if(!target||!list.contains(target))return;
    const task=records.find(item=>item.id===target.dataset.id);if(!task)return;
    try{
      if(target.dataset.action==='delete'){
        if(!win.confirm('Delete this task from this browser?'))return;
        save(records.filter(item=>item.id!==task.id));notice.textContent='Task deleted.';
      }else if(target.dataset.action==='toggle'){
        const next=task.done?domain.createTask(task.id,task.title):domain.completeTask(copy(task));
        if(!validTask(next)||next.id!==task.id||next.title!==task.title||next.done===task.done)throw Error('BAD_STATUS_RESULT');
        save(records.map(item=>item.id===task.id?copy(next):item));notice.textContent=next.done?'Task completed.':'Task reopened.';
      }
    }catch{notice.textContent='The task could not be updated. Your data has not been changed.';}
  });
  render();
}
