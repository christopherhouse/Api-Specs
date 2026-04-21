import * as fs from 'fs';
import { buildSchema, GraphQLSchema, GraphQLObjectType, GraphQLFieldMap } from 'graphql';
import { faker } from '@faker-js/faker';

export class GraphQLMockGenerator {
  private schema?: GraphQLSchema;
  private schemaText?: string;

  loadSpec(filePath: string): void {
    this.schemaText = fs.readFileSync(filePath, 'utf-8');
    this.schema = buildSchema(this.schemaText);
  }

  getSchema(): GraphQLSchema | undefined {
    return this.schema;
  }

  getSchemaText(): string | undefined {
    return this.schemaText;
  }

  /**
   * Create a mock resolver that generates random data based on field type
   */
  createMockResolvers(): any {
    if (!this.schema) {
      return {};
    }

    const resolvers: any = {};

    // Mock Query type
    const queryType = this.schema.getQueryType();
    if (queryType) {
      resolvers.Query = this.createResolversForType(queryType);
    }

    // Mock Mutation type
    const mutationType = this.schema.getMutationType();
    if (mutationType) {
      resolvers.Mutation = this.createResolversForType(mutationType);
    }

    return resolvers;
  }

  private createResolversForType(type: GraphQLObjectType): any {
    const resolvers: any = {};
    const fields: GraphQLFieldMap<any, any> = type.getFields();

    for (const [fieldName, field] of Object.entries(fields)) {
      resolvers[fieldName] = () => {
        return this.generateMockData(field.type);
      };
    }

    return resolvers;
  }

  private generateMockData(type: any, depth: number = 0): any {
    // Prevent infinite recursion
    if (depth > 5) {
      return null;
    }

    const typeName = type.toString();

    // Handle Non-Null types
    if (typeName.endsWith('!')) {
      const innerType = type.ofType;
      return this.generateMockData(innerType, depth);
    }

    // Handle List types
    if (typeName.startsWith('[')) {
      const innerType = type.ofType;
      const itemCount = faker.number.int({ min: 1, max: 5 });
      return Array.from({ length: itemCount }, () => this.generateMockData(innerType, depth + 1));
    }

    // Handle scalar types
    switch (typeName) {
      case 'String':
        return faker.lorem.words(3);
      case 'Int':
        return faker.number.int({ min: 1, max: 1000 });
      case 'Float':
        return faker.number.float({ min: 0, max: 1000, fractionDigits: 2 });
      case 'Boolean':
        return faker.datatype.boolean();
      case 'ID':
        return faker.string.uuid();
      case 'DateTime':
        return faker.date.recent().toISOString();
      case 'Date':
        return faker.date.recent().toISOString().split('T')[0];
      case 'UUID':
        return faker.string.uuid();
      case 'Email':
        return faker.internet.email();
      case 'URL':
        return faker.internet.url();
      case 'JSON':
        return { data: faker.lorem.words(5) };
    }

    // Handle object types
    if (type.getFields) {
      const obj: any = {};
      const fields = type.getFields();

      for (const [fieldName, field] of Object.entries(fields)) {
        obj[fieldName] = this.generateMockData((field as any).type, depth + 1);
      }

      return obj;
    }

    // Default fallback
    return null;
  }

  getApiInfo(): { title: string; description?: string } {
    // Try to extract info from schema description or comments
    const lines = this.schemaText?.split('\n') || [];
    let title = 'GraphQL API';
    let description: string | undefined;

    for (const line of lines) {
      if (line.includes('"""') || line.includes('#')) {
        const content = line.replace(/"""|#/g, '').trim();
        if (content && !title) {
          title = content;
        } else if (content) {
          description = content;
          break;
        }
      }
    }

    return { title, description };
  }
}
