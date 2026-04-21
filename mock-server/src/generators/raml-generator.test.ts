import * as fs from 'fs';
import { RamlMockGenerator } from '../generators/raml-generator';

jest.mock('fs');

describe('RamlMockGenerator', () => {
  let generator: RamlMockGenerator;

  beforeEach(() => {
    generator = new RamlMockGenerator();
    jest.clearAllMocks();
  });

  describe('loadSpec', () => {
    it('should load RAML spec from file', () => {
      const mockRamlText = `
#%RAML 1.0
title: Test API
/users:
  get:
    description: Get all users
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockRamlText);

      generator.loadSpec('/test/api.raml');

      expect(fs.readFileSync).toHaveBeenCalledWith('/test/api.raml', 'utf-8');
    });
  });

  describe('getEndpoints', () => {
    it('should parse RAML endpoints correctly', () => {
      const mockRamlText = `
#%RAML 1.0
title: Test API
/users:
  get:
    description: Get all users
  post:
    description: Create a user
/users/{id}:
  get:
    description: Get user by ID
  put:
    description: Update user
  delete:
    description: Delete user
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockRamlText);
      generator.loadSpec('/test/api.raml');

      const endpoints = generator.getEndpoints();

      expect(endpoints).toHaveLength(5);
      expect(endpoints[0]).toMatchObject({
        path: '/users',
        method: 'GET',
        description: 'Get all users',
      });
      expect(endpoints[1]).toMatchObject({
        path: '/users',
        method: 'POST',
        description: 'Create a user',
      });
      expect(endpoints[2]).toMatchObject({
        path: '/users/{id}',
        method: 'GET',
        description: 'Get user by ID',
      });
    });

    it('should return empty array when no endpoints exist', () => {
      const mockRamlText = `
#%RAML 1.0
title: Test API
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockRamlText);
      generator.loadSpec('/test/api.raml');

      const endpoints = generator.getEndpoints();

      expect(endpoints).toEqual([]);
    });

    it('should handle endpoints without descriptions', () => {
      const mockRamlText = `
#%RAML 1.0
title: Test API
/users:
  get:
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockRamlText);
      generator.loadSpec('/test/api.raml');

      const endpoints = generator.getEndpoints();

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].description).toBe('');
    });

    it('should handle all HTTP methods', () => {
      const mockRamlText = `
#%RAML 1.0
title: Test API
/test:
  get:
  post:
  put:
  patch:
  delete:
  head:
  options:
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockRamlText);
      generator.loadSpec('/test/api.raml');

      const endpoints = generator.getEndpoints();

      expect(endpoints).toHaveLength(7);
      const methods = endpoints.map(e => e.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('PATCH');
      expect(methods).toContain('DELETE');
      expect(methods).toContain('HEAD');
      expect(methods).toContain('OPTIONS');
    });

    it('should handle nested resource paths', () => {
      const mockRamlText = `
#%RAML 1.0
title: Test API
/users:
  get:
/users/{userId}/orders:
  get:
    description: Get user orders
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockRamlText);
      generator.loadSpec('/test/api.raml');

      const endpoints = generator.getEndpoints();

      expect(endpoints).toHaveLength(2);
      expect(endpoints[1]).toMatchObject({
        path: '/users/{userId}/orders',
        method: 'GET',
        description: 'Get user orders',
      });
    });
  });

  describe('generateMockResponse', () => {
    it('should generate mock response with status 200', () => {
      const response = generator.generateMockResponse();

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('message');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('data');
    });

    it('should generate different data on each call', () => {
      const response1 = generator.generateMockResponse();
      const response2 = generator.generateMockResponse();

      expect(response1.data.id).not.toBe(response2.data.id);
    });
  });

  describe('getApiInfo', () => {
    it('should extract title from RAML spec', () => {
      const mockRamlText = `
#%RAML 1.0
title: My Awesome API
/users:
  get:
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockRamlText);
      generator.loadSpec('/test/api.raml');

      const info = generator.getApiInfo();

      expect(info.title).toBe('My Awesome API');
    });

    it('should extract description from RAML spec', () => {
      const mockRamlText = `
#%RAML 1.0
title: My API
description: This is a test API
/users:
  get:
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockRamlText);
      generator.loadSpec('/test/api.raml');

      const info = generator.getApiInfo();

      expect(info.description).toBe('This is a test API');
    });

    it('should extract version from RAML spec', () => {
      const mockRamlText = `
#%RAML 1.0
title: My API
version: v2.0
/users:
  get:
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockRamlText);
      generator.loadSpec('/test/api.raml');

      const info = generator.getApiInfo();

      expect(info.version).toBe('v2.0');
    });

    it('should return default title when no RAML is loaded', () => {
      const info = generator.getApiInfo();

      expect(info.title).toBe('RAML API');
    });
  });
});
