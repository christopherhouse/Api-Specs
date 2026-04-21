import * as fs from 'fs';
import * as path from 'path';

export interface SpecFile {
  domain: string;
  format: 'openapi' | 'graphql' | 'soap' | 'raml' | 'wadl';
  subFormat?: 'json' | 'yaml';
  filePath: string;
  fileName: string;
  apiName: string;
}

export class SpecDiscovery {
  private scenariosPath: string;

  constructor(scenariosPath: string) {
    this.scenariosPath = scenariosPath;
  }

  /**
   * Discover all spec files in the scenarios directory
   */
  discoverSpecs(): SpecFile[] {
    const specs: SpecFile[] = [];

    if (!fs.existsSync(this.scenariosPath)) {
      console.warn(`Scenarios path not found: ${this.scenariosPath}`);
      return specs;
    }

    const domains = fs.readdirSync(this.scenariosPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const domain of domains) {
      const domainPath = path.join(this.scenariosPath, domain);

      // Check for GraphQL specs
      const graphqlPath = path.join(domainPath, 'graphql');
      if (fs.existsSync(graphqlPath)) {
        const graphqlFiles = fs.readdirSync(graphqlPath)
          .filter(f => f.endsWith('.graphql'));

        for (const file of graphqlFiles) {
          specs.push({
            domain,
            format: 'graphql',
            filePath: path.join(graphqlPath, file),
            fileName: file,
            apiName: this.extractApiName(file)
          });
        }
      }

      // Check for SOAP/WSDL specs
      const soapPath = path.join(domainPath, 'soap');
      if (fs.existsSync(soapPath)) {
        const wsdlFiles = fs.readdirSync(soapPath)
          .filter(f => f.endsWith('.wsdl'));

        for (const file of wsdlFiles) {
          specs.push({
            domain,
            format: 'soap',
            filePath: path.join(soapPath, file),
            fileName: file,
            apiName: this.extractApiName(file)
          });
        }
      }

      // Check for REST specs
      const restPath = path.join(domainPath, 'rest');
      if (fs.existsSync(restPath)) {

        // OpenAPI specs (JSON and YAML)
        const openapiPath = path.join(restPath, 'openapi');
        if (fs.existsSync(openapiPath)) {
          // JSON OpenAPI specs
          const jsonPath = path.join(openapiPath, 'json');
          if (fs.existsSync(jsonPath)) {
            const jsonFiles = fs.readdirSync(jsonPath)
              .filter(f => f.endsWith('.json'));

            for (const file of jsonFiles) {
              specs.push({
                domain,
                format: 'openapi',
                subFormat: 'json',
                filePath: path.join(jsonPath, file),
                fileName: file,
                apiName: this.extractApiName(file)
              });
            }
          }

          // YAML OpenAPI specs
          const yamlPath = path.join(openapiPath, 'yaml');
          if (fs.existsSync(yamlPath)) {
            const yamlFiles = fs.readdirSync(yamlPath)
              .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

            for (const file of yamlFiles) {
              specs.push({
                domain,
                format: 'openapi',
                subFormat: 'yaml',
                filePath: path.join(yamlPath, file),
                fileName: file,
                apiName: this.extractApiName(file)
              });
            }
          }
        }

        // WADL specs
        const wadlPath = path.join(restPath, 'wadl');
        if (fs.existsSync(wadlPath)) {
          const wadlFiles = fs.readdirSync(wadlPath)
            .filter(f => f.endsWith('.wadl'));

          for (const file of wadlFiles) {
            specs.push({
              domain,
              format: 'wadl',
              filePath: path.join(wadlPath, file),
              fileName: file,
              apiName: this.extractApiName(file)
            });
          }
        }

        // RAML specs
        const ramlPath = path.join(restPath, 'raml');
        if (fs.existsSync(ramlPath)) {
          const ramlFiles = fs.readdirSync(ramlPath)
            .filter(f => f.endsWith('.raml'));

          for (const file of ramlFiles) {
            specs.push({
              domain,
              format: 'raml',
              filePath: path.join(ramlPath, file),
              fileName: file,
              apiName: this.extractApiName(file)
            });
          }
        }
      }
    }

    return specs;
  }

  private extractApiName(fileName: string): string {
    // Remove extension
    const withoutExt = fileName.replace(/\.(json|yaml|yml|graphql|wsdl|wadl|raml)$/, '');
    // Remove date suffix (e.g., -2026-04-18)
    return withoutExt.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  }
}
