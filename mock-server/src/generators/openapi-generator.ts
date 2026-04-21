import SwaggerParser from '@apidevtools/swagger-parser';
import { faker } from '@faker-js/faker';

interface OpenApiParameter {
  name: string;
  in: string;
  required?: boolean;
}

interface SchemaObject {
  type?: string;
  format?: string;
  enum?: string[];
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  minimum?: number;
  maximum?: number;
}

interface OpenApiResponseSpec {
  description?: string;
  content?: Record<string, { schema?: SchemaObject }>;
}

interface ParsedOpenApiDoc {
  info?: {
    title?: string;
    description?: string;
    version?: string;
  };
  paths?: Record<string, Record<string, {
    operationId?: string;
    summary?: string;
    description?: string;
    parameters?: OpenApiParameter[];
    responses?: Record<string, OpenApiResponseSpec>;
  }>>;
}

export interface MockEndpoint {
  path: string;
  method: string;
  operationId?: string;
  description?: string;
  parameters: OpenApiParameter[];
  responses: Record<string, OpenApiResponseSpec>;
}

export interface MockResponse {
  statusCode: number;
  data: unknown;
}

export class OpenAPIMockGenerator {
  private api?: ParsedOpenApiDoc;

  async loadSpec(filePath: string): Promise<void> {
    this.api = await SwaggerParser.dereference(filePath) as ParsedOpenApiDoc;
  }

  getEndpoints(): MockEndpoint[] {
    if (!this.api || !this.api.paths) {
      return [];
    }

    const endpoints: MockEndpoint[] = [];

    for (const [path, pathItem] of Object.entries(this.api.paths)) {
      if (!pathItem) continue;

      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

      for (const method of methods) {
        const operation = pathItem[method];
        if (operation) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            description: operation.summary || operation.description,
            parameters: operation.parameters || [],
            responses: operation.responses || {}
          });
        }
      }
    }

    return endpoints;
  }

  generateMockResponse(endpoint: MockEndpoint): MockResponse {
    const responses = endpoint.responses;

    // Try to find a success response (200, 201, etc.)
    const successCodes = ['200', '201', '202', '204'];
    let responseSpec: OpenApiResponseSpec | undefined;
    let statusCode = 200;

    for (const code of successCodes) {
      if (responses[code]) {
        responseSpec = responses[code];
        statusCode = parseInt(code);
        break;
      }
    }

    if (!responseSpec) {
      // Fall back to first response
      const firstCode = Object.keys(responses)[0];
      if (firstCode) {
        responseSpec = responses[firstCode];
        statusCode = parseInt(firstCode) || 200;
      }
    }

    if (!responseSpec || !responseSpec.content) {
      return { statusCode, data: { message: 'Success' } };
    }

    const jsonContent = responseSpec.content['application/json'];
    if (!jsonContent || !jsonContent.schema) {
      return { statusCode, data: { message: 'Success' } };
    }

    const schema = jsonContent.schema;
    const mockData = this.generateFromSchema(schema);

    return { statusCode, data: mockData };
  }

  private generateFromSchema(schema: SchemaObject, depth: number = 0): unknown {
    // Prevent infinite recursion
    if (depth > 5) {
      return null;
    }

    if (schema.type === 'object') {
      const obj: Record<string, unknown> = {};

      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = this.generateFromSchema(prop, depth + 1);
        }
      }

      return obj;
    }

    if (schema.type === 'array') {
      const itemCount = faker.number.int({ min: 1, max: 5 });
      const items = schema.items;
      if (!items) {
        return [];
      }
      return Array.from({ length: itemCount }, () => this.generateFromSchema(items, depth + 1));
    }

    if (schema.type === 'string') {
      if (schema.enum) {
        return faker.helpers.arrayElement(schema.enum);
      }
      if (schema.format === 'date-time') {
        return faker.date.recent().toISOString();
      }
      if (schema.format === 'date') {
        return faker.date.recent().toISOString().split('T')[0];
      }
      if (schema.format === 'email') {
        return faker.internet.email();
      }
      if (schema.format === 'uri' || schema.format === 'url') {
        return faker.internet.url();
      }
      if (schema.format === 'uuid') {
        return faker.string.uuid();
      }
      return faker.lorem.words(3);
    }

    if (schema.type === 'number' || schema.type === 'integer') {
      const min = schema.minimum ?? 0;
      const max = schema.maximum ?? 1000;
      return schema.type === 'integer'
        ? faker.number.int({ min, max })
        : faker.number.float({ min, max, fractionDigits: 2 });
    }

    if (schema.type === 'boolean') {
      return faker.datatype.boolean();
    }

    // Default fallback
    return null;
  }

  getApiInfo(): { title: string; description?: string; version: string } {
    return {
      title: this.api?.info?.title || 'Unknown API',
      description: this.api?.info?.description,
      version: this.api?.info?.version || '1.0.0'
    };
  }
}
