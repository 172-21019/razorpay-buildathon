const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');

// Ensure database is ready before running tests
beforeAll(done => {
  setTimeout(() => done(), 1000); // Give SQLite time to initialize and seed
});

afterAll(done => {
  db.close();
  done();
});

describe('Product API', () => {
  it('should get all products', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should get a specific product', async () => {
    const res = await request(app).get('/api/products/p1');
    expect(res.statusCode).toEqual(200);
    expect(res.body.id).toEqual('p1');
  });

  it('should return 404 for non-existent product', async () => {
    const res = await request(app).get('/api/products/p999');
    expect(res.statusCode).toEqual(404);
  });
});

describe('Order API', () => {
  let createdOrderId;

  it('should create an order successfully', async () => {
    const orderData = {
      userId: 'test_user_1',
      items: [
        { productId: 'p1', quantity: 2 }
      ],
      address: {
        customerName: 'Test Name',
        addressLine: '123 Main St',
        city: 'Bangalore',
        pincode: '560001',
        phoneNumber: '9999999999'
      }
    };

    const res = await request(app)
      .post('/api/orders')
      .send(orderData);

    expect(res.statusCode).toEqual(201);
    expect(res.body.message).toEqual('Order created successfully');
    expect(res.body.order.status).toEqual('paid'); // Updated for Phase 1.5
    expect(res.body.order.items[0].quantity).toEqual(2);

    createdOrderId = res.body.order.id;
  });

  it('should get created order by ID', async () => {
    const res = await request(app).get(`/api/orders/${createdOrderId}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.id).toEqual(createdOrderId);
    expect(res.body.user_id).toEqual('test_user_1');
  });

  it('should fail if product does not exist', async () => {
    const orderData = {
      userId: 'test_user_1',
      items: [
        { productId: 'invalid_p', quantity: 1 }
      ]
    };

    const res = await request(app)
      .post('/api/orders')
      .send(orderData);

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('not found');
  });

  it('should fail if insufficient stock', async () => {
    const orderData = {
      userId: 'test_user_1',
      items: [
        { productId: 'p2', quantity: 9999 }
      ]
    };

    const res = await request(app)
      .post('/api/orders')
      .send(orderData);

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('Insufficient stock');
  });
});