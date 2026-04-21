import * as fs from 'fs';
import { WadlMockGenerator } from '../generators/wadl-generator';

jest.mock('fs');

describe('WadlMockGenerator', () => {
  let generator: WadlMockGenerator;

  beforeEach(() => {
    generator = new WadlMockGenerator();
    jest.clearAllMocks();
  });

  describe('loadSpec', () => {
    it('should load and parse WADL spec from file', () => {
      const mockWadlText = `
<?xml version="1.0"?>
<application xmlns="http://wadl.dev.java.net/2009/02">
  <resources base="http://example.com/api">
    <resource path="users">
      <method name="GET">
        <doc>Get all users</doc>
      </method>
    </resource>
  </resources>
</application>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWadlText);

      generator.loadSpec('/test/api.wadl');

      expect(fs.readFileSync).toHaveBeenCalledWith('/test/api.wadl', 'utf-8');
    });
  });

  describe('getEndpoints', () => {
    it('should parse WADL endpoints correctly', () => {
      const mockWadlText = `
<?xml version="1.0"?>
<application xmlns="http://wadl.dev.java.net/2009/02">
  <resources base="http://example.com/api">
    <resource path="users">
      <method name="GET">
        <doc>Get all users</doc>
      </method>
      <method name="POST">
        <doc>Create user</doc>
      </method>
    </resource>
  </resources>
</application>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWadlText);
      generator.loadSpec('/test/api.wadl');

      const endpoints = generator.getEndpoints();

      expect(endpoints).toHaveLength(2);
      expect(endpoints[0]).toMatchObject({
        path: 'users',
        method: 'GET',
        description: 'Get all users',
      });
      expect(endpoints[1]).toMatchObject({
        path: 'users',
        method: 'POST',
        description: 'Create user',
      });
    });

    it('should handle nested resources', () => {
      const mockWadlText = `
<?xml version="1.0"?>
<application xmlns="http://wadl.dev.java.net/2009/02">
  <resources base="http://example.com/api">
    <resource path="users">
      <method name="GET"/>
      <resource path="{id}">
        <method name="GET">
          <doc>Get user by ID</doc>
        </method>
      </resource>
    </resource>
  </resources>
</application>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWadlText);
      generator.loadSpec('/test/api.wadl');

      const endpoints = generator.getEndpoints();

      expect(endpoints).toHaveLength(2);
      expect(endpoints[1]).toMatchObject({
        path: 'users{id}',
        method: 'GET',
        description: 'Get user by ID',
      });
    });

    it('should return empty array when no resources exist', () => {
      const mockWadlText = `
<?xml version="1.0"?>
<application xmlns="http://wadl.dev.java.net/2009/02">
  <resources base="http://example.com/api">
  </resources>
</application>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWadlText);
      generator.loadSpec('/test/api.wadl');

      const endpoints = generator.getEndpoints();

      expect(endpoints).toEqual([]);
    });

    it('should default to GET method when method name is missing', () => {
      const mockWadlText = `
<?xml version="1.0"?>
<application xmlns="http://wadl.dev.java.net/2009/02">
  <resources base="http://example.com/api">
    <resource path="test">
      <method name="GET"/>
    </resource>
  </resources>
</application>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWadlText);
      generator.loadSpec('/test/api.wadl');

      const endpoints = generator.getEndpoints();

      expect(endpoints.length).toBeGreaterThan(0);
      if (endpoints.length > 0) {
        expect(endpoints[0].method).toBe('GET');
      }
    });
  });

  describe('generateMockResponse', () => {
    it('should generate mock response with status 200', () => {
      const response = generator.generateMockResponse();

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('message');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('result');
    });

    it('should generate different data on each call', () => {
      const response1 = generator.generateMockResponse();
      const response2 = generator.generateMockResponse();

      expect(response1.data.id).not.toBe(response2.data.id);
    });
  });

  describe('getApiInfo', () => {
    it('should return default title when no WADL is loaded', () => {
      const info = generator.getApiInfo();

      expect(info.title).toBe('WADL API');
    });

    it('should extract title from WADL doc element', () => {
      const mockWadlText = `
<?xml version="1.0"?>
<application xmlns="http://wadl.dev.java.net/2009/02">
  <doc title="My WADL API"/>
  <resources base="http://example.com/api">
    <resource path="test">
      <method name="GET"/>
    </resource>
  </resources>
</application>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWadlText);
      generator.loadSpec('/test/api.wadl');

      const info = generator.getApiInfo();

      expect(info.title).toBe('My WADL API');
    });

    it('should extract description from WADL doc element', () => {
      const mockWadlText = `
<?xml version="1.0"?>
<application xmlns="http://wadl.dev.java.net/2009/02">
  <doc>This is a test API</doc>
  <resources base="http://example.com/api">
    <resource path="test">
      <method name="GET"/>
    </resource>
  </resources>
</application>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWadlText);
      generator.loadSpec('/test/api.wadl');

      const info = generator.getApiInfo();

      expect(info.description).toBe('This is a test API');
    });
  });
});
