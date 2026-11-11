// Synthetic test fixture, not a model-generated implementation.
export const createTask=(id,title)=>({id,title,done:false});
export const completeTask=task=>({...task,done:true});
export const filterOpen=tasks=>tasks.filter(task=>!task.done);
