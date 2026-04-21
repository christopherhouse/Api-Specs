import * as fs from 'fs';
import { faker } from '@faker-js/faker';

export interface RamlEndpoint {
  path: string;
  method: string;
  description?: string;
}

export class RamlMockGenerator {
  private ramlText?: string;
  private endpoints: RamlEndpoint[] = [];

  loadSpec(filePath: string): void {
    this.ramlText = fs.readFileSync(filePath, 'utf-8');
    this.parseRaml();
  }

  private parseRaml(): void {
    if (!this.ramlText) return;

    const lines = this.ramlText.split('\n');
    let currentPath = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match resource paths (starts with /)
      const pathMatch = line.match(/^(\/[\w\-\/{}]*):$/);
      if (pathMatch) {
        currentPath = pathMatch[1];
        continue;
      }

      // Match HTTP methods
      const methodMatch = line.match(/^\s+(get|post|put|patch|delete|head|options):/);
      if (methodMatch && currentPath) {
        const method = methodMatch[1].toUpperCase();
        let description = '';

        // Try to find description in next few lines
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const descLine = lines[j];
          const descMatch = descLine.match(/^\s+description:\s*(.+)$/);
          if (descMatch) {
            description = descMatch[1];
            break;
          }
        }

        this.endpoints.push({
          path: currentPath,
          method,
          description
        });
      }
    }
  }

  getEndpoints(): RamlEndpoint[] {
    return this.endpoints;
  }

  generateMockResponse(): any {
    return {
      statusCode: 200,
      data: {
        id: faker.string.uuid(),
        message: 'Success',
        timestamp: faker.date.recent().toISOString(),
        data: faker.lorem.sentence()
      }
    };
  }

  getApiInfo(): { title: string; description?: string; version?: string } {
    if (!this.ramlText) {
      return { title: 'RAML API' };
    }

    let title = 'RAML API';
    let description: string | undefined;
    let version: string | undefined;

    const lines = this.ramlText.split('\n');
    for (const line of lines) {
      const titleMatch = line.match(/^title:\s*(.+)$/);
      if (titleMatch) {
        title = titleMatch[1];
      }

      const descMatch = line.match(/^description:\s*(.+)$/);
      if (descMatch) {
        description = descMatch[1];
      }

      const versionMatch = line.match(/^version:\s*(.+)$/);
      if (versionMatch) {
        version = versionMatch[1];
      }
    }

    return { title, description, version };
  }
}
