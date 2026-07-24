const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const http = require('http');
const jwt = require('jsonwebtoken');

const { router, authenticateToken } = require('../src/routes/authRoutes.js');

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
  });

  it('rejects invalid credentials', async () => {
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
