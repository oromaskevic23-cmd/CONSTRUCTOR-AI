import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/server';
import { initDb, resetDbForTests, closeDb } from '../src/db';
import { unlinkSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const TEST_DB_BASE = './data/test-';

function makeTestDbPath() {
  return `${TEST_DB_BASE}${uuidv4()}.sqlite`;
}

describe('Task Manager API', () => {
  const testDb = makeTestDbPath();

  beforeAll(async () => {
    process.env.DATABASE_PATH = testDb;
    await initDb(testDb);
    await resetDbForTests(testDb);
  });

  afterAll(async () => {
    try { await closeDb(); } catch (e) {}
    if (existsSync(testDb)) unlinkSync(testDb);
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('creates a task and persists after DB reopen', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Persist test', description: 'Should persist' });

    expect(res.status).toBe(201);
    const id = res.body.id;

    // close DB via internal endpoint and reopen
    await request(app).post('/internal/close-db');
    await initDb(testDb);

    const get = await request(app).get(`/tasks/${id}`);
    expect(get.status).toBe(200);
    expect(get.body.title).toBe('Persist test');
  });

  it('performs full CRUD and complete', async () => {
    const created = await request(app)
      .post('/tasks')
      .send({ title: 'Full CRUD', description: 'Test' });

    expect(created.status).toBe(201);
    const id = created.body.id;

    const read = await request(app).get(`/tasks/${id}`);
    expect(read.status).toBe(200);

    const updated = await request(app).put(`/tasks/${id}`).send({ title: 'Updated' });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('Updated');

    const comp = await request(app).post(`/tasks/${id}/complete`);
    expect(comp.status).toBe(200);
    expect(comp.body.completed).toBe(true);

    const del = await request(app).delete(`/tasks/${id}`);
    expect(del.status).toBe(204);

    const notFound = await request(app).get(`/tasks/${id}`);
    expect(notFound.status).toBe(404);
  });

});
