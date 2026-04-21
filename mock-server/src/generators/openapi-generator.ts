import SwaggerParser from '@apidevtools/swagger-parser';
import { faker } from '@faker-js/faker';

export interface MockEndpoint {
  path: string;
  method: string;
  operationId?: string;
  description?: string;
  parameters: any[];
  responses: any;
}

export class OpenAPIMockGenerator {
  private api?: any;

  async loadSpec(filePath: string): Promise<void> {
    this.api = await SwaggerParser.dereference(filePath) as any;
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
        const operation = (pathItem as any)[method];
        if (operation) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            description: operation.summary || operation.description,
            parameters: operation.parameters || [],
            responses: operation.responses
          });
        }
      }
    }

    return endpoints;
  }

  generateMockResponse(endpoint: MockEndpoint): any {
    const responses = endpoint.responses;

    // Try to find a success response (200, 201, etc.)
    const successCodes = ['200', '201', '202', '204'];
    let responseSpec: any;
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

  private generateFromSchema(schema: any, depth: number = 0): any {
    // Prevent infinite recursion
    if (depth > 5) {
      return null;
    }

    if (schema.type === 'object') {
      const obj: any = {};

      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = this.generateFromSchema(prop as any, depth + 1);
        }
      }

      return obj;
    }

    if (schema.type === 'array') {
      const itemCount = faker.number.int({ min: 1, max: 5 });
      const items = schema.items;
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
