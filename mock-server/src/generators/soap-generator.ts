import * as fs from 'fs';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { faker } from '@faker-js/faker';

export interface SoapOperation {
  name: string;
  description?: string;
}

export class SoapMockGenerator {
  private wsdlData?: any;
  private operations: SoapOperation[] = [];

  loadSpec(filePath: string): void {
    const wsdlText = fs.readFileSync(filePath, 'utf-8');
    const parser = new XMLParser({ ignoreAttributes: false });
    this.wsdlData = parser.parse(wsdlText);
    this.parseWsdl();
  }

  private parseWsdl(): void {
    if (!this.wsdlData || !this.wsdlData.definitions) return;

    const portType = this.wsdlData.definitions.portType;
    if (!portType || !portType.operation) return;

    const operations = Array.isArray(portType.operation)
      ? portType.operation
      : [portType.operation];

    for (const op of operations) {
      this.operations.push({
        name: op['@_name'] || 'Unknown',
        description: op.documentation || ''
      });
    }
  }

  getOperations(): SoapOperation[] {
    return this.operations;
  }

  generateMockResponse(operationName: string): string {
    // Generate a SOAP envelope response
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true
    });

    const soapResponse = {
      'soap:Envelope': {
        '@_xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/',
        'soap:Body': {
          [`${operationName}Response`]: {
            result: {
              success: true,
              id: faker.string.uuid(),
              message: 'Operation completed successfully',
              timestamp: faker.date.recent().toISOString(),
              data: faker.lorem.sentence()
            }
          }
        }
      }
    };

    return builder.build(soapResponse);
  }

  getApiInfo(): { title: string; description?: string } {
    let title = 'SOAP API';
    let description: string | undefined;

    if (this.wsdlData?.definitions?.documentation) {
      description = this.wsdlData.definitions.documentation;
    }

    if (this.wsdlData?.definitions?.service?.['@_name']) {
      title = this.wsdlData.definitions.service['@_name'];
    }

    return { title, description };
  }

  getWsdlContent(): string {
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true
    });

    return builder.build(this.wsdlData);
  }
}
