import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { dirname } from 'path';
import { promises as fs } from 'fs';

export type Task = {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

const DEFAULT_DB_PATH = process.env.DATABASE_PATH || './data/db.sqlite';

let dbInstance: any = null;

export async function ensureDataDirExists(dbPath: string) {
  const dir = dirname(dbPath);
  await fs.mkdir(dir, { recursive: true });
}

export async function getDb(dbPath = DEFAULT_DB_PATH) {
  if (dbInstance && dbInstance.config && dbInstance.config.filename === dbPath) return dbInstance;
  await ensureDataDirExists(dbPath);
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  dbInstance = db;
  return db;
}

export async function initDb(dbPath = DEFAULT_DB_PATH) {
  const db = await getDb(dbPath);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function rowToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    completed: row.completed === 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function createTask(title: string, description: string, dbPath = DEFAULT_DB_PATH): Promise<Task> {
  const db = await getDb(dbPath);
  const now = new Date().toISOString();
  const res = await db.run(
    `INSERT INTO tasks (title, description, completed, created_at, updated_at) VALUES (?, ?, 0, ?, ?);`,
    [title, description, now, now]
  );
  const id = res.lastID;
  const row = await db.get(`SELECT * FROM tasks WHERE id = ?`, [id]);
  return rowToTask(row);
}

export async function getTaskById(id: number, dbPath = DEFAULT_DB_PATH): Promise<Task | null> {
  const db = await getDb(dbPath);
  const row = await db.get(`SELECT * FROM tasks WHERE id = ?`, [id]);
  return row ? rowToTask(row) : null;
}

export async function getAllTasks(dbPath = DEFAULT_DB_PATH): Promise<Task[]> {
  const db = await getDb(dbPath);
  const rows = await db.all(`SELECT * FROM tasks ORDER BY id ASC`);
  return rows.map(rowToTask);
}

export async function updateTask(id: number, title?: string, description?: string, completed?: boolean, dbPath = DEFAULT_DB_PATH): Promise<Task | null> {
  const db = await getDb(dbPath);
  const existing = await getTaskById(id, dbPath);
  if (!existing) return null;
  const nextTitle = title ?? existing.title;
  const nextDescription = description ?? existing.description;
  const nextCompleted = completed ?? existing.completed;
  const now = new Date().toISOString();
  const res = await db.run(
    `UPDATE tasks SET title = ?, description = ?, completed = ?, updated_at = ? WHERE id = ?`,
    [nextTitle, nextDescription, nextCompleted ? 1 : 0, now, id]
  );
  if (res.changes === 0) return null;
  return getTaskById(id, dbPath);
}

export async function deleteTask(id: number, dbPath = DEFAULT_DB_PATH): Promise<boolean> {
  const db = await getDb(dbPath);
  const res = await db.run(`DELETE FROM tasks WHERE id = ?`, [id]);
  return res.changes > 0;
}

export async function completeTask(id: number, dbPath = DEFAULT_DB_PATH): Promise<Task | null> {
  return updateTask(id, undefined, undefined, true, dbPath);
}

export async function resetDbForTests(dbPath = DEFAULT_DB_PATH) {
  const db = await getDb(dbPath);
  await db.exec(`DELETE FROM tasks;`);
}
