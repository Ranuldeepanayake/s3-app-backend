// Covers CORS origin parsing, browser request enforcement, and preflight limits.
const { describe, it, expect } = require('@jest/globals');
const express = require('express');
const request = require('supertest');

jest.mock('../src/config/logger.js', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}));

const { parseAllowedOrigins, createCorsMiddleware } = require('../src/config/cors.js');

describe('CORS enforcement', () => {
  const createApp = (origins) => {
    const app = express();
    app.use(createCorsMiddleware(origins));
    app.get('/resource', (req, res) => res.json({ status: 'ok' }));
    return app;
  };

  it('parses comma-separated origins and uses local development defaults', () => {
    expect(parseAllowedOrigins(' https://app.example.com/,http://localhost:3300 ')).toEqual([
      'https://app.example.com',
      'http://localhost:3300'
    ]);
    expect(parseAllowedOrigins(undefined)).toEqual([
      'http://localhost:3000',
      'http://localhost:3300'
    ]);
  });

  it('returns the requesting allowed origin and varies caches by origin', async () => {
    const response = await request(createApp(['https://app.example.com']))
      .get('/resource')
      .set('Origin', 'https://app.example.com');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect(response.headers['access-control-expose-headers']).toBe('X-Request-Id');
    expect(response.headers.vary).toContain('Origin');
  });

  it('rejects an unlisted origin', async () => {
    const response = await request(createApp(['https://app.example.com']))
      .get('/resource')
      .set('Origin', 'https://attacker.example');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Origin is not allowed.');
  });

  it('allows only supported methods and request headers in preflight', async () => {
    const app = createApp(['https://app.example.com']);
    const allowed = await request(app)
      .options('/resource')
      .set('Origin', 'https://app.example.com')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    const denied = await request(app)
      .options('/resource')
      .set('Origin', 'https://app.example.com')
      .set('Access-Control-Request-Method', 'TRACE');

    expect(allowed.status).toBe(204);
    expect(denied.status).toBe(403);
  });

  it('allows requests without Origin to continue through API controls', async () => {
    const response = await request(createApp(['https://app.example.com'])).get('/resource');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
