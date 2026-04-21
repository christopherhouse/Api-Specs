import * as fs from 'fs';
import { SpecDiscovery, SpecFile } from './discovery';

jest.mock('fs');

describe('SpecDiscovery', () => {
  const mockScenariosPath = '/test/scenarios';
  let discovery: SpecDiscovery;

  beforeEach(() => {
    jest.clearAllMocks();
    discovery = new SpecDiscovery(mockScenariosPath);
  });

  describe('discoverSpecs', () => {
    it('should return empty array when scenarios path does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const specs = discovery.discoverSpecs();

      expect(specs).toEqual([]);
      expect(fs.existsSync).toHaveBeenCalledWith(mockScenariosPath);
    });

    it('should discover OpenAPI JSON specs', () => {
      const mockDirents = [{ name: 'banking', isDirectory: () => true }];

      (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
        if (pathStr === mockScenariosPath) return true;
        if (pathStr.includes('banking')) {
          if (pathStr.includes('rest')) return true;
          if (pathStr.includes('openapi')) return true;
          if (pathStr.includes('json')) return true;
        }
        return false;
      });

      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath === mockScenariosPath) return mockDirents;
        if (dirPath.includes('rest/openapi/json')) return ['banking-2026-04-18.json'];
        return [];
      });

      const specs = discovery.discoverSpecs();

      expect(specs).toHaveLength(1);
      expect(specs[0]).toMatchObject({
        domain: 'banking',
        format: 'openapi',
        subFormat: 'json',
        fileName: 'banking-2026-04-18.json',
        apiName: 'banking',
      });
    });

    it('should discover OpenAPI YAML specs', () => {
      const mockDirents = [{ name: 'crm', isDirectory: () => true }];

      (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
        if (pathStr === mockScenariosPath) return true;
        if (pathStr.includes('crm')) {
          if (pathStr.includes('rest')) return true;
          if (pathStr.includes('openapi')) return true;
          if (pathStr.includes('yaml')) return true;
        }
        return false;
      });

      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath === mockScenariosPath) return mockDirents;
        if (dirPath.includes('rest/openapi/yaml')) return ['crm-2026-04-18.yaml'];
        return [];
      });

      const specs = discovery.discoverSpecs();

      expect(specs).toHaveLength(1);
      expect(specs[0]).toMatchObject({
        domain: 'crm',
        format: 'openapi',
        subFormat: 'yaml',
        fileName: 'crm-2026-04-18.yaml',
        apiName: 'crm',
      });
    });

    it('should discover GraphQL specs', () => {
      const mockDirents = [{ name: 'ecommerce', isDirectory: () => true }];

      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        if (path === mockScenariosPath) return true;
        if (path.includes('graphql')) return true;
        return false;
      });

      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath === mockScenariosPath) return mockDirents;
        if (dirPath.includes('graphql')) return ['ecommerce-2026-04-18.graphql'];
        return [];
      });

      const specs = discovery.discoverSpecs();

      expect(specs).toHaveLength(1);
      expect(specs[0]).toMatchObject({
        domain: 'ecommerce',
        format: 'graphql',
        fileName: 'ecommerce-2026-04-18.graphql',
        apiName: 'ecommerce',
      });
    });

    it('should discover SOAP/WSDL specs', () => {
      const mockDirents = [{ name: 'hr', isDirectory: () => true }];

      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        if (path === mockScenariosPath) return true;
        if (path.includes('soap')) return true;
        return false;
      });

      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath === mockScenariosPath) return mockDirents;
        if (dirPath.includes('soap')) return ['hr-2026-04-18.wsdl'];
        return [];
      });

      const specs = discovery.discoverSpecs();

      expect(specs).toHaveLength(1);
      expect(specs[0]).toMatchObject({
        domain: 'hr',
        format: 'soap',
        fileName: 'hr-2026-04-18.wsdl',
        apiName: 'hr',
      });
    });

    it('should discover RAML specs', () => {
      const mockDirents = [{ name: 'logistics', isDirectory: () => true }];

      (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
        if (pathStr === mockScenariosPath) return true;
        if (pathStr.includes('logistics')) {
          if (pathStr.includes('rest')) return true;
          if (pathStr.includes('raml')) return true;
        }
        return false;
      });

      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath === mockScenariosPath) return mockDirents;
        if (dirPath.includes('rest/raml')) return ['logistics-2026-04-18.raml'];
        return [];
      });

      const specs = discovery.discoverSpecs();

      expect(specs).toHaveLength(1);
      expect(specs[0]).toMatchObject({
        domain: 'logistics',
        format: 'raml',
        fileName: 'logistics-2026-04-18.raml',
        apiName: 'logistics',
      });
    });

    it('should discover WADL specs', () => {
      const mockDirents = [{ name: 'inventory', isDirectory: () => true }];

      (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
        if (pathStr === mockScenariosPath) return true;
        if (pathStr.includes('inventory')) {
          if (pathStr.includes('rest')) return true;
          if (pathStr.includes('wadl')) return true;
        }
        return false;
      });

      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath === mockScenariosPath) return mockDirents;
        if (dirPath.includes('rest/wadl')) return ['inventory-2026-04-18.wadl'];
        return [];
      });

      const specs = discovery.discoverSpecs();

      expect(specs).toHaveLength(1);
      expect(specs[0]).toMatchObject({
        domain: 'inventory',
        format: 'wadl',
        fileName: 'inventory-2026-04-18.wadl',
        apiName: 'inventory',
      });
    });

    it('should discover multiple specs across different domains and formats', () => {
      const mockDirents = [
        { name: 'banking', isDirectory: () => true },
        { name: 'hr', isDirectory: () => true },
      ];

      (fs.existsSync as jest.Mock).mockImplementation((pathStr: string) => {
        if (pathStr === mockScenariosPath) return true;
        if (pathStr.includes('banking')) {
          if (pathStr.includes('rest')) return true;
          if (pathStr.includes('openapi')) return true;
          if (pathStr.includes('json')) return true;
        }
        if (pathStr.includes('hr') && pathStr.includes('soap')) return true;
        return false;
      });

      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath === mockScenariosPath) return mockDirents;
        if (dirPath.includes('banking') && dirPath.includes('rest/openapi/json')) {
          return ['banking-2026-04-18.json'];
        }
        if (dirPath.includes('hr') && dirPath.includes('soap')) {
          return ['hr-2026-04-18.wsdl'];
        }
        return [];
      });

      const specs = discovery.discoverSpecs();

      expect(specs).toHaveLength(2);
      expect(specs.find((s: SpecFile) => s.domain === 'banking')).toBeDefined();
      expect(specs.find((s: SpecFile) => s.domain === 'hr')).toBeDefined();
    });

    it('should correctly extract API name from file name with date suffix', () => {
      const mockDirents = [{ name: 'test-domain', isDirectory: () => true }];

      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        if (path === mockScenariosPath) return true;
        if (path.includes('graphql')) return true;
        return false;
      });

      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath === mockScenariosPath) return mockDirents;
        if (dirPath.includes('graphql')) return ['my-awesome-api-2026-04-18.graphql'];
        return [];
      });

      const specs = discovery.discoverSpecs();

      expect(specs[0].apiName).toBe('my-awesome-api');
    });

    it('should handle empty domains gracefully', () => {
      const mockDirents = [{ name: 'empty-domain', isDirectory: () => true }];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath === mockScenariosPath) return mockDirents;
        return [];
      });

      const specs = discovery.discoverSpecs();

      expect(specs).toEqual([]);
    });
  });
});
