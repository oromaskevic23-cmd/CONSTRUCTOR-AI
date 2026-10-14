import express, { Request, Response, NextFunction } from 'express';
import {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  completeTask,
  initDb,
  resetDbForTests
} from './db';
import { CreateTaskSchema, UpdateTaskSchema, IdParamSchema } from './validators';

const app = express();
const port = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DATABASE_PATH || './data/db.sqlite';

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/tasks', async (_req, res, next) => {
  try {
    const tasks = await getAllTasks(DB_PATH);
    res.json(tasks);
  } catch (err) { next(err); }
});

app.post('/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateTaskSchema.parse(req.body);
    const task = await createTask(parsed.title, parsed.description ?? '', DB_PATH);
    res.status(201).json(task);
  } catch (error: any) {
    if (error?.issues) {
      res.status(400).json({ error: 'INVALID_INPUT', details: error.issues });
    } else next(error);
  }
});

app.get('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = IdParamSchema.parse(req.params);
    const id = Number(params.id);
    const task = await getTaskById(id, DB_PATH);
    if (!task) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
    return res.json(task);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: 'INVALID_ID', details: error.issues });
    }
    next(error);
  }
});

app.put('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = IdParamSchema.parse(req.params);
    const parsed = UpdateTaskSchema.parse(req.body);
    const id = Number(params.id);
    const updated = await updateTask(id, parsed.title, parsed.description, parsed.completed, DB_PATH);
    if (!updated) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
    return res.json(updated);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: 'INVALID_INPUT', details: error.issues });
    }
    next(error);
  }
});

app.post('/tasks/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = IdParamSchema.parse(req.params);
    const id = Number(params.id);
    const task = await completeTask(id, DB_PATH);
    if (!task) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
    return res.json(task);
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ error: 'INVALID_ID', details: error.issues });
    next(error);
  }
});

app.delete('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = IdParamSchema.parse(req.params);
    const id = Number(params.id);
    const deleted = await deleteTask(id, DB_PATH);
    if (!deleted) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
    return res.status(204).send();
  } catch (error: any) {
    if (error?.issues) return res.status(400).json({ error: 'INVALID_ID', details: error.issues });
    next(error);
  }
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
});

export async function startServer() {
  await initDb(DB_PATH);
  return app.listen(port, () => {
    console.log(`Task manager API listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

export default app;
