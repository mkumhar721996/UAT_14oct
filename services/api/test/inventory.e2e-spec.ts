import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp, tokenFor } from './support/create-test-app';

const node = (type: string, id: string) => ({ type: `node--${type}`, id, attributes: { title: id } });

describe('Inventory (e2e)', () => {
  let app: INestApplication;
  const auth = `Bearer ${tokenFor({ sub: 'e-1', role: 'employee' })}`;
  const customer = `Bearer ${tokenFor({ sub: 'c-1', role: 'customer' })}`;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.DRUPAL_BASE_URL = 'https://drupal.test';
    process.env.DRUPAL_ACCESS_TOKEN = 'fake-token';
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeAll(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: string) => {
      const type = new URL(url).pathname.split('/').pop();
      const data = type === 'home_page' ? [node('home_page', 'page-1')] : type === 'partner' ? [node('partner', 'page-2')] : [];
      return { ok: true, status: 200, json: async () => ({ data }) };
    }) as any);
  });

  const entry = async (id: string) => (await http().get('/inventory').set('Authorization', auth)).body.find((e: any) => e.pageId === id);

  it('AC2/AC3: lists every published page with its template', async () => {
    const res = await http().get('/inventory').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((e: any) => [e.pageId, e.templateType])).toEqual([['page-1', 'HomePage'], ['page-2', 'Partner']]);
  });

  it('refuses customers', async () => {
    expect((await http().get('/inventory').set('Authorization', customer)).status).toBe(403);
  });

  it.each([['reviewerName'], ['reviewDate']])('AC9: missing %s is not saved', async (field) => {
    const body: any = { reviewerName: 'Pat', reviewDate: '2026-10-19', result: 'pass' };
    delete body[field];
    const res = await http().post('/inventory/page-1/results').set('Authorization', auth).send(body);
    expect(res.status).toBe(400);
    expect((await entry('page-1')).status).toBeNull();
  });

  it('AC4-AC8: records a pass then shows it in the inventory', async () => {
    const res = await http().post('/inventory/page-2/results').set('Authorization', auth).send({ reviewerName: 'Pat', reviewDate: '2026-10-19', result: 'fail' });
    expect(res.status).toBe(201);
    expect(await entry('page-2')).toMatchObject({ reviewerName: 'Pat', reviewDate: '2026-10-19', status: 'fail' });
  });
});
