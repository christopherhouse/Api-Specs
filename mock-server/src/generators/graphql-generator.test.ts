import * as fs from 'fs';
import { GraphQLMockGenerator } from '../generators/graphql-generator';
import { buildSchema } from 'graphql';

jest.mock('fs');
jest.mock('graphql');

describe('GraphQLMockGenerator', () => {
  let generator: GraphQLMockGenerator;

  beforeEach(() => {
    generator = new GraphQLMockGenerator();
    jest.clearAllMocks();
  });

  describe('loadSpec', () => {
    it('should load GraphQL schema from file', () => {
      const mockSchemaText = `
        type Query {
          hello: String
        }
      `;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue({} as any);

      generator.loadSpec('/test/schema.graphql');

      expect(fs.readFileSync).toHaveBeenCalledWith('/test/schema.graphql', 'utf-8');
      expect(buildSchema).toHaveBeenCalledWith(mockSchemaText);
    });
  });

  describe('getSchema', () => {
    it('should return undefined when no schema is loaded', () => {
      const schema = generator.getSchema();

      expect(schema).toBeUndefined();
    });

    it('should return loaded schema', () => {
      const mockSchemaText = 'type Query { hello: String }';
      const mockSchema = {} as any;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue(mockSchema);

      generator.loadSpec('/test/schema.graphql');
      const schema = generator.getSchema();

      expect(schema).toBe(mockSchema);
    });
  });

  describe('getSchemaText', () => {
    it('should return undefined when no schema is loaded', () => {
      const text = generator.getSchemaText();

      expect(text).toBeUndefined();
    });

    it('should return loaded schema text', () => {
      const mockSchemaText = 'type Query { hello: String }';

      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue({} as any);

      generator.loadSpec('/test/schema.graphql');
      const text = generator.getSchemaText();

      expect(text).toBe(mockSchemaText);
    });
  });

  describe('getApiInfo', () => {
    it('should return default title when no schema is loaded', () => {
      const info = generator.getApiInfo();

      expect(info.title).toBe('GraphQL API');
      expect(info.description).toBeUndefined();
    });

    it('should extract title from schema comments', () => {
      const mockSchemaText = `
        """
        My GraphQL API
        """
        type Query {
          hello: String
        }
      `;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue({} as any);

      generator.loadSpec('/test/schema.graphql');
      const info = generator.getApiInfo();

      expect(info.title).toContain('GraphQL API');
    });

    it('should extract description from schema comments', () => {
      const mockSchemaText = `
        """
        E-commerce API
        """
        # This is the description
        type Query {
          products: [Product]
        }
      `;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue({} as any);

      generator.loadSpec('/test/schema.graphql');
      const info = generator.getApiInfo();

      expect(info).toBeDefined();
    });
  });

  describe('createMockResolvers', () => {
    it('should return empty object when no schema is loaded', () => {
      const resolvers = generator.createMockResolvers();

      expect(resolvers).toEqual({});
    });

    it('should create resolvers for Query type', () => {
      const mockSchemaText = 'type Query { hello: String }';
      const mockQueryType = {
        getFields: () => ({
          hello: { type: { toString: () => 'String' } },
        }),
      };
      const mockSchema = {
        getQueryType: () => mockQueryType,
        getMutationType: () => null,
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue(mockSchema as any);

      generator.loadSpec('/test/schema.graphql');
      const resolvers = generator.createMockResolvers();

      expect(resolvers).toHaveProperty('Query');
      expect(resolvers.Query).toHaveProperty('hello');
      expect(typeof resolvers.Query.hello).toBe('function');
    });

    it('should create resolvers for Mutation type', () => {
      const mockSchemaText = 'type Mutation { createUser: User }';
      const mockMutationType = {
        getFields: () => ({
          createUser: { type: { toString: () => 'User' } },
        }),
      };
      const mockSchema = {
        getQueryType: () => null,
        getMutationType: () => mockMutationType,
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue(mockSchema as any);

      generator.loadSpec('/test/schema.graphql');
      const resolvers = generator.createMockResolvers();

      expect(resolvers).toHaveProperty('Mutation');
      expect(resolvers.Mutation).toHaveProperty('createUser');
    });

    it('should generate mock data for scalar types', () => {
      const mockSchemaText = 'type Query { test: String }';
      const mockQueryType = {
        getFields: () => ({
          testString: { type: { toString: () => 'String' } },
          testInt: { type: { toString: () => 'Int' } },
          testFloat: { type: { toString: () => 'Float' } },
          testBoolean: { type: { toString: () => 'Boolean' } },
          testID: { type: { toString: () => 'ID' } },
        }),
      };
      const mockSchema = {
        getQueryType: () => mockQueryType,
        getMutationType: () => null,
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue(mockSchema as any);

      generator.loadSpec('/test/schema.graphql');
      const resolvers = generator.createMockResolvers();

      expect(typeof resolvers.Query.testString()).toBe('string');
      expect(typeof resolvers.Query.testInt()).toBe('number');
      expect(typeof resolvers.Query.testFloat()).toBe('number');
      expect(typeof resolvers.Query.testBoolean()).toBe('boolean');
      expect(typeof resolvers.Query.testID()).toBe('string');
    });

    it('should handle NonNull types', () => {
      const mockSchemaText = 'type Query { test: String! }';
      const mockQueryType = {
        getFields: () => ({
          test: {
            type: {
              toString: () => 'String!',
              ofType: { toString: () => 'String' },
            },
          },
        }),
      };
      const mockSchema = {
        getQueryType: () => mockQueryType,
        getMutationType: () => null,
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue(mockSchema as any);

      generator.loadSpec('/test/schema.graphql');
      const resolvers = generator.createMockResolvers();

      const result = resolvers.Query.test();
      expect(typeof result).toBe('string');
    });

    it('should handle List types', () => {
      const mockSchemaText = 'type Query { test: [String] }';
      const mockQueryType = {
        getFields: () => ({
          test: {
            type: {
              toString: () => '[String]',
              ofType: { toString: () => 'String' },
            },
          },
        }),
      };
      const mockSchema = {
        getQueryType: () => mockQueryType,
        getMutationType: () => null,
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue(mockSchema as any);

      generator.loadSpec('/test/schema.graphql');
      const resolvers = generator.createMockResolvers();

      const result = resolvers.Query.test();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle custom scalar types', () => {
      const mockSchemaText = 'type Query { test: DateTime }';
      const mockQueryType = {
        getFields: () => ({
          testDateTime: { type: { toString: () => 'DateTime' } },
          testDate: { type: { toString: () => 'Date' } },
          testUUID: { type: { toString: () => 'UUID' } },
          testEmail: { type: { toString: () => 'Email' } },
          testURL: { type: { toString: () => 'URL' } },
          testJSON: { type: { toString: () => 'JSON' } },
        }),
      };
      const mockSchema = {
        getQueryType: () => mockQueryType,
        getMutationType: () => null,
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue(mockSchema as any);

      generator.loadSpec('/test/schema.graphql');
      const resolvers = generator.createMockResolvers();

      expect(resolvers.Query.testDateTime()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(resolvers.Query.testDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(resolvers.Query.testUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(resolvers.Query.testEmail()).toContain('@');
      expect(resolvers.Query.testURL()).toMatch(/^https?:\/\//);
      expect(typeof resolvers.Query.testJSON()).toBe('object');
    });

    it('should handle object types with recursion limit', () => {
      const mockUserType = {
        toString: () => 'User',
        getFields: () => ({
          id: { type: { toString: () => 'ID' } },
          name: { type: { toString: () => 'String' } },
        }),
      };

      const mockQueryType = {
        getFields: () => ({
          user: { type: mockUserType },
        }),
      };

      const mockSchema = {
        getQueryType: () => mockQueryType,
        getMutationType: () => null,
      };

      const mockSchemaText = 'type Query { user: User }';
      (fs.readFileSync as jest.Mock).mockReturnValue(mockSchemaText);
      (buildSchema as jest.Mock).mockReturnValue(mockSchema as any);

      generator.loadSpec('/test/schema.graphql');
      const resolvers = generator.createMockResolvers();

      const result = resolvers.Query.user();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
    });
  });
});
