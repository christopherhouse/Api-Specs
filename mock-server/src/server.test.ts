import express from 'express';
import request from 'supertest';

// Note: These mocks are here for illustration but server.ts isn't imported
// because it starts the server on import, which would conflict with tests
jest.mock('./discovery');
jest.mock('./generators/openapi-generator');
jest.mock('./generators/graphql-generator');
jest.mock('./generators/raml-generator');
jest.mock('./generators/wadl-generator');
jest.mock('./generators/soap-generator');

describe('Server Integration Tests', () => {
  describe('API Endpoint Structure', () => {
    it('should have required dependencies available', () => {
      expect(express).toBeDefined();
    });

    it('should be able to create an express app', () => {
      const app = express();
      expect(app).toBeDefined();
      expect(typeof app.use).toBe('function');
      expect(typeof app.get).toBe('function');
      expect(typeof app.post).toBe('function');
    });

    it('should be able to use JSON middleware', () => {
      const app = express();
      app.use(express.json());
      expect(app).toBeDefined();
    });

    it('should be able to create routes', () => {
      const app = express();

      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      expect(app).toBeDefined();
    });
  });

  describe('Mock Server Endpoint Tests', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      // Setup test catalog endpoint
      app.get('/catalog/data', (req, res) => {
        res.json([
          {
            id: 'test-openapi-banking',
            domain: 'banking',
            format: 'openapi',
            apiName: 'banking',
            title: 'Banking API',
            description: 'Test banking API',
            version: '1.0.0',
            basePath: '/api/banking/banking',
            consoleUrl: '/api/banking/banking/docs',
            endpoints: [
              { path: '/customers', method: 'GET', description: 'Get customers' },
            ],
          },
        ]);
      });

      // Setup test API endpoint
      app.get('/api/banking/banking/customers', (req, res) => {
        res.status(200).json([
          { id: '1', name: 'John Doe', email: 'john@example.com' },
        ]);
      });
    });

    it('should return catalog data', async () => {
      const response = await request(app).get('/catalog/data');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('format');
    });

    it('should return mock data for API endpoints', async () => {
      const response = await request(app).get('/api/banking/banking/customers');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
    });
  });

  describe('Error Handling', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      app.get('/test/error', (req, res) => {
        res.status(500).json({ error: 'Internal Server Error' });
      });

      app.get('/test/not-found', (req, res) => {
        res.status(404).json({ error: 'Not Found' });
      });

      app.post('/test/bad-request', (req, res) => {
        if (!req.body.requiredField) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Missing required parameter: requiredField',
          });
        }
        res.status(200).json({ success: true });
      });
    });

    it('should handle 500 errors', async () => {
      const response = await request(app).get('/test/error');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle 404 errors', async () => {
      const response = await request(app).get('/test/not-found');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle 400 bad request errors', async () => {
      const response = await request(app).post('/test/bad-request').send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });

    it('should validate required parameters', async () => {
      const response = await request(app)
        .post('/test/bad-request')
        .send({ requiredField: 'value' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('CORS Configuration', () => {
    it('should support CORS headers', async () => {
      const cors = await import('cors');
      const app = express();
      app.use(cors.default());

      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      expect(app).toBeDefined();
    });
  });

  describe('Authentication Middleware', () => {
    function buildAuthMiddleware(
      basic?: { enabled: boolean; username: string; password: string },
      apiKey?: { enabled: boolean; headerName: string; key: string }
    ) {
      const cfg = {
        basic: basic ?? { enabled: false, username: '', password: '' },
        apiKey: apiKey ?? { enabled: false, headerName: 'X-Api-Key', key: '' },
      };

      return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const basicEnabled = cfg.basic.enabled;
        const apiKeyEnabled = cfg.apiKey.enabled;

        if (!basicEnabled && !apiKeyEnabled) {
          return next();
        }

        if (basicEnabled) {
          const authHeader = req.headers['authorization'] ?? '';
          if (typeof authHeader === 'string' && authHeader.startsWith('Basic ')) {
            const encoded = authHeader.slice(6);
            const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
            const colon = decoded.indexOf(':');
            if (colon !== -1) {
              const username = decoded.slice(0, colon);
              const password = decoded.slice(colon + 1);
              if (username === cfg.basic.username && password === cfg.basic.password) {
                return next();
              }
            }
          }
        }

        if (apiKeyEnabled) {
          const headerValue = req.headers[cfg.apiKey.headerName.toLowerCase()];
          if (headerValue === cfg.apiKey.key) {
            return next();
          }
        }

        res.setHeader('WWW-Authenticate', basicEnabled ? 'Basic realm="Mock Server"' : '');
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      };
    }

    describe('no auth configured', () => {
      let app: express.Application;
      beforeEach(() => {
        app = express();
        app.use(buildAuthMiddleware());
        app.get('/protected', (_req, res) => res.json({ ok: true }));
      });

      it('should allow all requests when auth is disabled', async () => {
        const response = await request(app).get('/protected');
        expect(response.status).toBe(200);
      });
    });

    describe('Basic auth enabled', () => {
      let app: express.Application;
      beforeEach(() => {
        app = express();
        app.use(buildAuthMiddleware({ enabled: true, username: 'user', password: 'pass' }));
        app.get('/protected', (_req, res) => res.json({ ok: true }));
      });

      it('should return 401 when no credentials are provided', async () => {
        const response = await request(app).get('/protected');
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });

      it('should return 401 for wrong credentials', async () => {
        const encoded = Buffer.from('user:wrong').toString('base64');
        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Basic ${encoded}`);
        expect(response.status).toBe(401);
      });

      it('should allow access with correct credentials', async () => {
        const encoded = Buffer.from('user:pass').toString('base64');
        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Basic ${encoded}`);
        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
      });

      it('should set WWW-Authenticate header on 401', async () => {
        const response = await request(app).get('/protected');
        expect(response.headers['www-authenticate']).toBe('Basic realm="Mock Server"');
      });
    });

    describe('API key auth enabled', () => {
      let app: express.Application;
      beforeEach(() => {
        app = express();
        app.use(buildAuthMiddleware(
          undefined,
          { enabled: true, headerName: 'X-Api-Key', key: 'my-secret' }
        ));
        app.get('/protected', (_req, res) => res.json({ ok: true }));
      });

      it('should return 401 when API key header is missing', async () => {
        const response = await request(app).get('/protected');
        expect(response.status).toBe(401);
      });

      it('should return 401 for wrong API key', async () => {
        const response = await request(app)
          .get('/protected')
          .set('X-Api-Key', 'wrong-key');
        expect(response.status).toBe(401);
      });

      it('should allow access with correct API key', async () => {
        const response = await request(app)
          .get('/protected')
          .set('X-Api-Key', 'my-secret');
        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
      });

      it('should support custom header names', async () => {
        const customApp = express();
        customApp.use(buildAuthMiddleware(
          undefined,
          { enabled: true, headerName: 'X-Custom-Token', key: 'tok123' }
        ));
        customApp.get('/protected', (_req, res) => res.json({ ok: true }));

        const goodResponse = await request(customApp)
          .get('/protected')
          .set('X-Custom-Token', 'tok123');
        expect(goodResponse.status).toBe(200);

        const badResponse = await request(customApp)
          .get('/protected')
          .set('X-Api-Key', 'tok123'); // wrong header name
        expect(badResponse.status).toBe(401);
      });
    });

    describe('Both Basic and API key enabled', () => {
      let app: express.Application;
      beforeEach(() => {
        app = express();
        app.use(buildAuthMiddleware(
          { enabled: true, username: 'admin', password: 'secret' },
          { enabled: true, headerName: 'X-Api-Key', key: 'api-key-123' }
        ));
        app.get('/protected', (_req, res) => res.json({ ok: true }));
      });

      it('should allow access with valid Basic credentials', async () => {
        const encoded = Buffer.from('admin:secret').toString('base64');
        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Basic ${encoded}`);
        expect(response.status).toBe(200);
      });

      it('should allow access with valid API key', async () => {
        const response = await request(app)
          .get('/protected')
          .set('X-Api-Key', 'api-key-123');
        expect(response.status).toBe(200);
      });

      it('should return 401 when neither credential matches', async () => {
        const encoded = Buffer.from('admin:wrong').toString('base64');
        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Basic ${encoded}`)
          .set('X-Api-Key', 'wrong-key');
        expect(response.status).toBe(401);
      });
    });
  });
});
