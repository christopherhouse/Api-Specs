import * as fs from 'fs';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { faker } from '@faker-js/faker';

export interface SoapOperation {
  name: string;
  description?: string;
  soapAction?: string;
  inputElement?: string;
}

type WsdlRecord = Record<string, unknown>;

export class SoapMockGenerator {
  private wsdlData?: WsdlRecord;
  private rawWsdlText?: string;
  private operations: SoapOperation[] = [];
  private targetNamespace: string = '';
  private serviceEndpoint: string = '';
  private elementFields: Map<string, { name: string; type: string; required: boolean }[]> = new Map();

  loadSpec(filePath: string): void {
    this.rawWsdlText = fs.readFileSync(filePath, 'utf-8');
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    this.wsdlData = parser.parse(this.rawWsdlText) as WsdlRecord;
    this.parseWsdl();
  }

  private getDefinitions(): WsdlRecord | null {
    if (!this.wsdlData) return null;
    return (this.wsdlData['definitions'] as WsdlRecord) ?? null;
  }

  private parseWsdl(): void {
    const defs = this.getDefinitions();
    if (!defs) return;

    this.targetNamespace = (defs['@_targetNamespace'] as string) || '';

    // Parse service endpoint URL
    const service = defs['service'] as WsdlRecord | undefined;
    if (service) {
      const port = service['port'] as WsdlRecord | undefined;
      if (port) {
        const address = port['address'] as WsdlRecord | undefined;
        this.serviceEndpoint = (address?.['@_location'] as string) || '';
      }
    }

    // Parse XSD elements from types section for request template generation
    this.parseXsdElements(defs);

    // Build mappings needed for operation enrichment
    const messageElementMap = this.buildMessageElementMap(defs);
    const soapActionMap = this.buildSoapActionMap(defs);

    // Parse operations from portType
    const portType = defs['portType'] as WsdlRecord | undefined;
    if (!portType || !portType['operation']) return;

    const ops = Array.isArray(portType['operation'])
      ? (portType['operation'] as WsdlRecord[])
      : [portType['operation'] as WsdlRecord];

    for (const op of ops) {
      const name = (op['@_name'] as string) || 'Unknown';
      const input = op['input'] as WsdlRecord | undefined;
      const inputMessageRef = (input?.['@_message'] as string) || '';
      const inputMessageName = inputMessageRef.split(':').pop() || '';
      const inputElement = messageElementMap.get(inputMessageName) || '';

      this.operations.push({
        name,
        description: (op['documentation'] as string) || '',
        soapAction: soapActionMap.get(name) || '',
        inputElement,
      });
    }
  }

  private buildMessageElementMap(defs: WsdlRecord): Map<string, string> {
    const map = new Map<string, string>();
    const messages = defs['message'];
    if (!messages) return map;

    const msgArray = Array.isArray(messages)
      ? (messages as WsdlRecord[])
      : [messages as WsdlRecord];

    for (const msg of msgArray) {
      const name = (msg['@_name'] as string) || '';
      const part = msg['part'] as WsdlRecord | undefined;
      if (part) {
        const element = (part['@_element'] as string) || '';
        const elementName = element.split(':').pop() || '';
        if (name && elementName) map.set(name, elementName);
      }
    }
    return map;
  }

  private buildSoapActionMap(defs: WsdlRecord): Map<string, string> {
    const map = new Map<string, string>();
    const binding = defs['binding'];
    if (!binding) return map;

    const bindingObj = (Array.isArray(binding) ? (binding as WsdlRecord[])[0] : binding) as WsdlRecord;
    const operations = bindingObj['operation'];
    if (!operations) return map;

    const opsArray = Array.isArray(operations)
      ? (operations as WsdlRecord[])
      : [operations as WsdlRecord];

    for (const op of opsArray) {
      const name = (op['@_name'] as string) || '';
      // soap:operation (prefix-stripped to 'operation') lives inside the binding wsdl:operation
      const soapOp = op['operation'] as WsdlRecord | undefined;
      const soapAction = (soapOp?.['@_soapAction'] as string) || '';
      if (name) map.set(name, soapAction);
    }
    return map;
  }

  private parseXsdElements(defs: WsdlRecord): void {
    const types = defs['types'] as WsdlRecord | undefined;
    if (!types) return;

    const schema = types['schema'] as WsdlRecord | undefined;
    if (!schema) return;

    const elements = schema['element'];
    if (!elements) return;

    const elemArray = Array.isArray(elements)
      ? (elements as WsdlRecord[])
      : [elements as WsdlRecord];

    for (const elem of elemArray) {
      const name = (elem['@_name'] as string) || '';
      if (!name) continue;
      this.elementFields.set(name, this.extractElementFields(elem));
    }
  }

  private extractElementFields(elemObj: WsdlRecord): { name: string; type: string; required: boolean }[] {
    const fields: { name: string; type: string; required: boolean }[] = [];
    const complexType = elemObj['complexType'] as WsdlRecord | undefined;
    if (!complexType) return fields;

    const sequence = complexType['sequence'] as WsdlRecord | undefined;
    if (!sequence) return fields;

    const elements = sequence['element'];
    if (!elements) return fields;

    const elemArray = Array.isArray(elements)
      ? (elements as WsdlRecord[])
      : [elements as WsdlRecord];

    for (const elem of elemArray) {
      const name = (elem['@_name'] as string) || '';
      const type = (elem['@_type'] as string) || 'xsd:string';
      const minOccurs = elem['@_minOccurs'];
      const required = minOccurs !== '0' && minOccurs !== 0;
      if (name) fields.push({ name, type, required });
    }
    return fields;
  }

  private getSampleValue(xsdType: string): string {
    const localType = (xsdType.split(':').pop() || xsdType).toLowerCase();
    switch (localType) {
      case 'string': return 'string';
      case 'int': case 'integer': case 'long': case 'short': return '0';
      case 'decimal': case 'float': case 'double': return '0.0';
      case 'boolean': return 'true';
      case 'date': return '2026-01-01';
      case 'datetime': return '2026-01-01T00:00:00Z';
      case 'time': return '00:00:00';
      default: return '';
    }
  }

  getOperations(): SoapOperation[] {
    return this.operations;
  }

  getTargetNamespace(): string {
    return this.targetNamespace;
  }

  getServiceEndpoint(): string {
    return this.serviceEndpoint;
  }

  getRequestTemplate(operationName: string): string {
    const operation = this.operations.find(op => op.name === operationName);
    const ns = this.targetNamespace || 'http://example.com/service';
    const inputElement = (operation?.inputElement) || `${operationName}Request`;
    const fields = this.elementFields.get(inputElement) || [];

    const fieldLines = fields
      .map(f => `      <tns:${f.name}>${this.getSampleValue(f.type)}</tns:${f.name}>`)
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:tns="${ns}">
  <soap:Header/>
  <soap:Body>
    <tns:${inputElement}>${fieldLines ? '\n' + fieldLines + '\n    ' : ''}</tns:${inputElement}>
  </soap:Body>
</soap:Envelope>`;
  }

  generateMockResponse(operationName: string): string {
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

    const defs = this.getDefinitions();
    if (defs?.['documentation']) {
      description = defs['documentation'] as string;
    }
    if (defs?.['service']) {
      const svc = defs['service'] as WsdlRecord;
      if (svc['@_name']) title = svc['@_name'] as string;
    }

    return { title, description };
  }

  getWsdlContent(): string {
    if (this.rawWsdlText) return this.rawWsdlText;

    const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
    return builder.build(this.wsdlData);
  }
}
