import { OpenAPIMockGenerator } from '../generators/openapi-generator';
import SwaggerParser from '@apidevtools/swagger-parser';

jest.mock('@apidevtools/swagger-parser');

describe('OpenAPIMockGenerator', () => {
  let generator: OpenAPIMockGenerator;

  beforeEach(() => {
    generator = new OpenAPIMockGenerator();
    jest.clearAllMocks();
  });

  describe('loadSpec', () => {
    it('should load and dereference an OpenAPI spec', async () => {
      const mockSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      };

      (SwaggerParser.dereference as jest.Mock).mockResolvedValue(mockSpec);

      await generator.loadSpec('/test/path/spec.json');

      expect(SwaggerParser.dereference).toHaveBeenCalledWith('/test/path/spec.json');
    });
  });

  describe('getApiInfo', () => {
    it('should return API info from loaded spec', async () => {
      const mockSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Banking API',
          description: 'A banking API',
          version: '2.0.0',
        },
        paths: {},
      };

      (SwaggerParser.dereference as jest.Mock).mockResolvedValue(mockSpec);
      await generator.loadSpec('/test/spec.json');

      const info = generator.getApiInfo();

      expect(info).toEqual({
        title: 'Banking API',
        description: 'A banking API',
        version: '2.0.0',
      });
    });

    it('should return default values when info is missing', () => {
      const info = generator.getApiInfo();

      expect(info).toEqual({
        title: 'Unknown API',
        description: undefined,
        version: '1.0.0',
      });
    });
  });

  describe('getEndpoints', () => {
    it('should return empty array when no spec is loaded', () => {
      const endpoints = generator.getEndpoints();

      expect(endpoints).toEqual([]);
    });

    it('should extract endpoints from OpenAPI paths', async () => {
      const mockSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get all users',
              parameters: [],
              responses: { '200': { description: 'Success' } },
            },
            post: {
              operationId: 'createUser',
              summary: 'Create a user',
              parameters: [],
              responses: { '201': { description: 'Created' } },
            },
          },
          '/users/{id}': {
            get: {
              operationId: 'getUserById',
              description: 'Get user by ID',
              parameters: [{ name: 'id', in: 'path', required: true }],
              responses: { '200': { description: 'Success' } },
            },
          },
        },
      };

      (SwaggerParser.dereference as jest.Mock).mockResolvedValue(mockSpec);
      await generator.loadSpec('/test/spec.json');

      const endpoints = generator.getEndpoints();

      expect(endpoints).toHaveLength(3);
      expect(endpoints[0]).toMatchObject({
        path: '/users',
        method: 'GET',
        operationId: 'getUsers',
        description: 'Get all users',
        parameters: [],
      });
      expect(endpoints[1]).toMatchObject({
        path: '/users',
        method: 'POST',
        operationId: 'createUser',
        description: 'Create a user',
      });
      expect(endpoints[2]).toMatchObject({
        path: '/users/{id}',
        method: 'GET',
        operationId: 'getUserById',
        description: 'Get user by ID',
      });
    });
  });

  describe('generateMockResponse', () => {
    beforeEach(async () => {
      const mockSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      };
      (SwaggerParser.dereference as jest.Mock).mockResolvedValue(mockSpec);
      await generator.loadSpec('/test/spec.json');
    });

    it('should generate mock response for 200 status code', () => {
      const endpoint = {
        path: '/users',
        method: 'GET',
        parameters: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      };

      const response = generator.generateMockResponse(endpoint);

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
    });

    it('should generate mock response for 201 status code', () => {
      const endpoint = {
        path: '/users',
        method: 'POST',
        parameters: [],
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      };

      const response = generator.generateMockResponse(endpoint);

      expect(response.statusCode).toBe(201);
      expect(response.data).toHaveProperty('id');
    });

    it('should handle array responses', () => {
      const endpoint = {
        path: '/users',
        method: 'GET',
        parameters: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const response = generator.generateMockResponse(endpoint);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.data[0]).toHaveProperty('id');
      expect(response.data[0]).toHaveProperty('name');
    });

    it('should generate mock data for string types with formats', () => {
      const endpoint = {
        path: '/test',
        method: 'GET',
        parameters: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    date: { type: 'string', format: 'date' },
                    dateTime: { type: 'string', format: 'date-time' },
                    uuid: { type: 'string', format: 'uuid' },
                    url: { type: 'string', format: 'url' },
                  },
                },
              },
            },
          },
        },
      };

      const response = generator.generateMockResponse(endpoint);

      expect(response.data.email).toContain('@');
      expect(response.data.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(response.data.url).toMatch(/^https?:\/\//);
    });

    it('should generate mock data for enum values', () => {
      const endpoint = {
        path: '/test',
        method: 'GET',
        parameters: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
                  },
                },
              },
            },
          },
        },
      };

      const response = generator.generateMockResponse(endpoint);

      expect(['active', 'inactive', 'pending']).toContain(response.data.status);
    });

    it('should generate mock data for number and integer types', () => {
      const endpoint = {
        path: '/test',
        method: 'GET',
        parameters: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    age: { type: 'integer', minimum: 0, maximum: 100 },
                    price: { type: 'number', minimum: 0.0, maximum: 1000.0 },
                  },
                },
              },
            },
          },
        },
      };

      const response = generator.generateMockResponse(endpoint);

      expect(Number.isInteger(response.data.age)).toBe(true);
      expect(response.data.age).toBeGreaterThanOrEqual(0);
      expect(response.data.age).toBeLessThanOrEqual(100);
      expect(typeof response.data.price).toBe('number');
    });

    it('should generate mock data for boolean types', () => {
      const endpoint = {
        path: '/test',
        method: 'GET',
        parameters: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    isActive: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      };

      const response = generator.generateMockResponse(endpoint);

      expect(typeof response.data.isActive).toBe('boolean');
    });

    it('should return default response when no content is defined', () => {
      const endpoint = {
        path: '/test',
        method: 'GET',
        parameters: [],
        responses: {
          '200': {
            description: 'Success',
          },
        },
      };

      const response = generator.generateMockResponse(endpoint);

      expect(response.statusCode).toBe(200);
      expect(response.data).toEqual({ message: 'Success' });
    });

    it('should handle deeply nested objects with recursion limit', () => {
      const endpoint = {
        path: '/test',
        method: 'GET',
        parameters: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    level1: {
                      type: 'object',
                      properties: {
                        level2: {
                          type: 'object',
                          properties: {
                            level3: {
                              type: 'object',
                              properties: {
                                level4: {
                                  type: 'object',
                                  properties: {
                                    level5: {
                                      type: 'object',
                                      properties: {
                                        level6: {
                                          type: 'object',
                                          properties: {
                                            data: { type: 'string' },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const response = generator.generateMockResponse(endpoint);

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('level1');
      // Deep nesting should be handled with recursion limit
    });
  });
});
