import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { faker } from '@faker-js/faker';

export interface WadlEndpoint {
  path: string;
  method: string;
  description?: string;
}

interface WadlMethod {
  '@_name'?: string;
  doc?: string;
}

interface WadlResource {
  '@_path'?: string;
  method?: WadlMethod | WadlMethod[];
  resource?: WadlResource | WadlResource[];
}

interface WadlParsedData {
  application?: {
    resources?: {
      resource?: WadlResource | WadlResource[];
    };
    doc?: string | { '@_title'?: string };
  };
}

export class WadlMockGenerator {
  private wadlData?: WadlParsedData;
  private endpoints: WadlEndpoint[] = [];

  loadSpec(filePath: string): void {
    const wadlText = fs.readFileSync(filePath, 'utf-8');
    const parser = new XMLParser({ ignoreAttributes: false });
    this.wadlData = parser.parse(wadlText);
    this.parseWadl();
  }

  private parseWadl(): void {
    if (!this.wadlData || !this.wadlData.application) return;

    const resources = this.wadlData.application.resources;
    if (!resources || !resources.resource) return;

    const resourceList = Array.isArray(resources.resource)
      ? resources.resource
      : [resources.resource];

    for (const resource of resourceList) {
      this.parseResource(resource, '');
    }
  }

  private parseResource(resource: WadlResource, basePath: string): void {
    const path = basePath + (resource['@_path'] || '');

    if (resource.method) {
      const methods = Array.isArray(resource.method)
        ? resource.method
        : [resource.method];

      for (const method of methods) {
        this.endpoints.push({
          path,
          method: (method['@_name'] || 'GET').toUpperCase(),
          description: method.doc || ''
        });
      }
    }

    // Handle nested resources
    if (resource.resource) {
      const nested = Array.isArray(resource.resource)
        ? resource.resource
        : [resource.resource];

      for (const nestedResource of nested) {
        this.parseResource(nestedResource, path);
      }
    }
  }

  getEndpoints(): WadlEndpoint[] {
    return this.endpoints;
  }

  generateMockResponse(): { statusCode: number; data: Record<string, unknown> } {
    return {
      statusCode: 200,
      data: {
        id: faker.string.uuid(),
        message: 'Success',
        timestamp: faker.date.recent().toISOString(),
        result: faker.lorem.sentence()
      }
    };
  }

  getApiInfo(): { title: string; description?: string } {
    let title = 'WADL API';
    let description: string | undefined;

    if (this.wadlData?.application?.doc) {
      const doc = this.wadlData.application.doc;
      if (typeof doc === 'string') {
        description = doc;
      } else if (doc['@_title']) {
        title = doc['@_title'];
      }
    }

    return { title, description };
  }
}
