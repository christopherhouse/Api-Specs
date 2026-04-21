import SwaggerParser from 'swagger-parser';
import { OpenAPIV3 } from 'swagger-parser';
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
  private api?: OpenAPIV3.Document;

  async loadSpec(filePath: string): Promise<void> {
    this.api = await SwaggerParser.dereference(filePath) as OpenAPIV3.Document;
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
        const operation = pathItem[method] as OpenAPIV3.OperationObject | undefined;
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
    let responseSpec: OpenAPIV3.ResponseObject | undefined;
    let statusCode = 200;

    for (const code of successCodes) {
      if (responses[code]) {
        responseSpec = responses[code] as OpenAPIV3.ResponseObject;
        statusCode = parseInt(code);
        break;
      }
    }

    if (!responseSpec) {
      // Fall back to first response
      const firstCode = Object.keys(responses)[0];
      if (firstCode) {
        responseSpec = responses[firstCode] as OpenAPIV3.ResponseObject;
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

    const schema = jsonContent.schema as OpenAPIV3.SchemaObject;
    const mockData = this.generateFromSchema(schema);

    return { statusCode, data: mockData };
  }

  private generateFromSchema(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject, depth: number = 0): any {
    // Prevent infinite recursion
    if (depth > 5) {
      return null;
    }

    // Handle schema object (should already be dereferenced)
    const s = schema as OpenAPIV3.SchemaObject;

    if (s.type === 'object') {
      const obj: any = {};

      if (s.properties) {
        for (const [key, prop] of Object.entries(s.properties)) {
          obj[key] = this.generateFromSchema(prop as OpenAPIV3.SchemaObject, depth + 1);
        }
      }

      return obj;
    }

    if (s.type === 'array') {
      const itemCount = faker.number.int({ min: 1, max: 5 });
      const items = s.items as OpenAPIV3.SchemaObject;
      return Array.from({ length: itemCount }, () => this.generateFromSchema(items, depth + 1));
    }

    if (s.type === 'string') {
      if (s.enum) {
        return faker.helpers.arrayElement(s.enum);
      }
      if (s.format === 'date-time') {
        return faker.date.recent().toISOString();
      }
      if (s.format === 'date') {
        return faker.date.recent().toISOString().split('T')[0];
      }
      if (s.format === 'email') {
        return faker.internet.email();
      }
      if (s.format === 'uri' || s.format === 'url') {
        return faker.internet.url();
      }
      if (s.format === 'uuid') {
        return faker.string.uuid();
      }
      return faker.lorem.words(3);
    }

    if (s.type === 'number' || s.type === 'integer') {
      const min = s.minimum ?? 0;
      const max = s.maximum ?? 1000;
      return s.type === 'integer'
        ? faker.number.int({ min, max })
        : faker.number.float({ min, max, fractionDigits: 2 });
    }

    if (s.type === 'boolean') {
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
