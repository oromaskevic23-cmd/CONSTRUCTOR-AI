// This bootstrap is only staged with a candidate inside an isolated runner.
// app.mjs is deliberately absent from the repository's UI directory.
import {createTask, completeTask, filterOpen} from './app.mjs';
import {mountTaskUi} from './ui.mjs';
mountTaskUi(document.getElementById('task-workspace'), {createTask, completeTask, filterOpen});
