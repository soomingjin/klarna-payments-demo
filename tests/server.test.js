const request = require('supertest');
const app = require('../server');

describe('Health check', () => {
  it('GET /health returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('klarna_api');
    expect(res.body).toHaveProperty('credentials_configured');
  });
});

describe('POST /api/session', () => {
  it('rejects invalid purchase_country', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ purchase_country: 'XX', purchase_currency: 'USD', order_amount: 10000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid purchase_country')])
    );
  });

  it('rejects invalid purchase_currency', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ purchase_country: 'US', purchase_currency: 'ZZZ', order_amount: 10000 });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid purchase_currency')])
    );
  });

  it('rejects negative order_amount', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ order_amount: -100 });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('order_amount must be a positive integer')])
    );
  });

  it('rejects non-integer order_amount', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ order_amount: 99.5 });
    expect(res.status).toBe(400);
  });

  it('rejects order_lines that is not an array', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ order_lines: 'not-an-array' });
    expect(res.status).toBe(400);
  });

  it('accepts valid payload (returns 500 without real credentials)', async () => {
    const res = await request(app)
      .post('/api/session')
      .send({ purchase_country: 'US', purchase_currency: 'USD', order_amount: 10000 });
    // Without real Klarna credentials, the server returns 500
    expect([200, 500]).toContain(res.status);
    if (res.status === 500) {
      expect(res.body.error).toBeDefined();
    }
  });
});

describe('POST /api/create_order', () => {
  it('rejects missing authorization_token', async () => {
    const res = await request(app).post('/api/create_order').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/authorization_token/i);
  });

  it('rejects invalid authorization_token', async () => {
    const res = await request(app)
      .post('/api/create_order')
      .send({ authorization_token: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });
});

describe('Order management validation', () => {
  it('GET /api/orders/:id rejects invalid order ID', async () => {
    const res = await request(app).get('/api/orders/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid order id/i);
  });

  it('POST /api/orders/:id/captures rejects invalid order ID', async () => {
    const res = await request(app).post('/api/orders/bad-id/captures');
    expect(res.status).toBe(400);
  });

  it('POST /api/orders/:id/cancel rejects invalid order ID', async () => {
    const res = await request(app).post('/api/orders/bad-id/cancel');
    expect(res.status).toBe(400);
  });

  it('POST /api/orders/:id/refunds rejects invalid order ID', async () => {
    const res = await request(app).post('/api/orders/bad-id/refunds');
    expect(res.status).toBe(400);
  });
});

describe('Webhooks', () => {
  it('POST /api/webhooks/klarna acknowledges notification', async () => {
    const res = await request(app)
      .post('/api/webhooks/klarna')
      .send({ event_type: 'order.updated', order_id: 'test-123' });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

describe('Static files', () => {
  it('GET / serves index.html', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Klarna Payments Demo');
  });
});
