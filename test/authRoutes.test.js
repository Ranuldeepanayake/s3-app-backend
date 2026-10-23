const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const http = require('http');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/postgres.js', () => ({
  query: jest.fn()
}));

const { router, authenticateToken } = require('../src/routes/authRoutes.js');
const postgres = require('../src/config/postgres.js');

const requestJson = (server, path, options = {}) => new Promise((resolve, reject) => {
  const requestOptions = {
    hostname: '127.0.0.1',
    port: server.address().port,
    path,
    method: options.method || 'GET',
    headers: {}
  };

  if (options.body) {
    requestOptions.headers['Content-Type'] = 'application/json';
  }

  const req = http.request(requestOptions, (res) => {
    let data = '';

    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      const body = data ? JSON.parse(data) : null;
      resolve({ statusCode: res.statusCode, body });
    });
  });

  req.on('error', reject);

  if (options.body) {
    req.write(JSON.stringify(options.body));
  }

  req.end();
});

describe('auth routes', () => {
  let server;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';

    const express = require('express');
    const app = express();

    app.use(express.json());
    app.use('/api/auth', router);

    server = http.createServer(app);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  beforeEach(() => {
    postgres.query.mockResolvedValue({
      rows: [{ user_id: 7, user_name: 'admin', first_name: 'Admin' }]
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('accepts valid credentials and returns a JWT', async () => {
    const response = await requestJson(server, '/api/auth/login', {
      method: 'POST',
      body: {
        username: 'admin',
        password: 'admin123'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(typeof response.body.token).toBe('string');
    expect(postgres.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM public.app_users'),
      ['admin', 'admin123']
    );
  });

  it('rejects invalid credentials', async () => {
    postgres.query.mockResolvedValue({ rows: [] });
    const response = await requestJson(server, '/api/auth/login', {
      method: 'POST',
      body: {
        username: 'wrong',
        password: 'password'
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Invalid credentials.');
  });

  it('returns service unavailable when PostgreSQL cannot be queried', async () => {
    postgres.query.mockRejectedValue(new Error('RDS unavailable'));

    const response = await requestJson(server, '/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'admin123' }
    });

    expect(response.statusCode).toBe(503);
    expect(response.body.message).toBe('Authentication service is unavailable. Please try again later.');
  });

  it('allows requests with a valid bearer token', () => {
    const req = { headers: {} };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      }
    };

    const token = jwt.sign({ username: 'admin' }, 'test-secret', { expiresIn: '1h' });
    req.headers.authorization = `Bearer ${token}`;

    let nextCalled = false;
    authenticateToken(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.user).toMatchObject({ username: 'admin' });
  });

  it('rejects requests without a bearer token', () => {
    const req = { headers: {} };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      }
    };

    let nextCalled = false;
    authenticateToken(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ message: 'Authentication token is required.' });
  });
});
