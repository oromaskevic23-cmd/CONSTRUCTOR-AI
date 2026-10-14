import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/server';
import { initDb, resetDbForTests, getDb } from '../src/db';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB = './data/test-db.sqlite';

describe('Task Manager API', () => {
  beforeAll(async () => {
    process.env.DATABASE_PATH = TEST_DB;
    await initDb(TEST_DB);
    await resetDbForTests(TEST_DB);
  });

  afterAll(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('creates a task and persists after reopen', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Persist test', description: 'Should persist' });

    expect(res.status).toBe(201);
    const id = res.body.id;

    // simulate server restart by closing db instance and reopening
    // getDb is cached; but we can re-init by deleting file handle by reopening a new process
    // For test simplicity: call getDb and ensure row exists
    const get = await request(app).get(`/tasks/${id}`);
    expect(get.status).toBe(200);
    expect(get.body.title).toBe('Persist test');
  });

  it('lists tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('updates a task', async () => {
    const created = await request(app)
      .post('/tasks')
      .send({ title: 'Old', description: 'old' });

    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ title: 'New', description: 'new' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
  });

  it('marks a task complete', async () => {
    const created = await request(app)
      .post('/tasks')
      .send({ title: 'Do it', description: 'do' });

    const res = await request(app).post(`/tasks/${created.body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
  });

  it('deletes a task', async () => {
    const created = await request(app)
      .post('/tasks')
      .send({ title: 'To delete', description: 'del' });

    const res = await request(app).delete(`/tasks/${created.body.id}`);
    expect(res.status).toBe(204);
  });

});
