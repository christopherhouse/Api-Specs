import * as fs from 'fs';
import { SoapMockGenerator } from '../generators/soap-generator';

jest.mock('fs');

describe('SoapMockGenerator', () => {
  let generator: SoapMockGenerator;

  beforeEach(() => {
    generator = new SoapMockGenerator();
    jest.clearAllMocks();
  });

  describe('loadSpec', () => {
    it('should load and parse WSDL spec from file', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/">
  <portType name="UserService">
    <operation name="GetUser">
      <documentation>Get user by ID</documentation>
    </operation>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);

      generator.loadSpec('/test/service.wsdl');

      expect(fs.readFileSync).toHaveBeenCalledWith('/test/service.wsdl', 'utf-8');
    });
  });

  describe('getOperations', () => {
    it('should parse WSDL operations correctly', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/">
  <portType name="UserService">
    <operation name="GetUser">
      <documentation>Get user by ID</documentation>
    </operation>
    <operation name="CreateUser">
      <documentation>Create a new user</documentation>
    </operation>
    <operation name="DeleteUser"/>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const operations = generator.getOperations();

      expect(operations).toHaveLength(3);
      expect(operations[0]).toMatchObject({
        name: 'GetUser',
        description: 'Get user by ID',
      });
      expect(operations[1]).toMatchObject({
        name: 'CreateUser',
        description: 'Create a new user',
      });
      expect(operations[2]).toMatchObject({
        name: 'DeleteUser',
        description: '',
      });
    });

    it('should return empty array when no operations exist', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/">
  <portType name="UserService">
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const operations = generator.getOperations();

      expect(operations).toEqual([]);
    });

    it('should handle single operation (non-array)', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/">
  <portType name="UserService">
    <operation name="GetUser"/>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const operations = generator.getOperations();

      expect(operations).toHaveLength(1);
      expect(operations[0].name).toBe('GetUser');
    });
  });

  describe('generateMockResponse', () => {
    beforeEach(() => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/">
  <portType name="UserService">
    <operation name="GetUser"/>
  </portType>
</definitions>
`;
      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');
    });

    it('should generate SOAP envelope response', () => {
      const response = generator.generateMockResponse('GetUser');

      expect(response).toContain('soap:Envelope');
      expect(response).toContain('soap:Body');
      expect(response).toContain('GetUserResponse');
    });

    it('should include operation name in response', () => {
      const response = generator.generateMockResponse('CreateUser');

      expect(response).toContain('CreateUserResponse');
    });

    it('should include mock data in response', () => {
      const response = generator.generateMockResponse('TestOperation');

      expect(response).toContain('success');
      expect(response).toContain('id');
      expect(response).toContain('message');
      expect(response).toContain('timestamp');
    });

    it('should generate different responses on each call', () => {
      const response1 = generator.generateMockResponse('GetUser');
      const response2 = generator.generateMockResponse('GetUser');

      expect(response1).not.toBe(response2);
    });
  });

  describe('getApiInfo', () => {
    it('should return default title when no WSDL is loaded', () => {
      const info = generator.getApiInfo();

      expect(info.title).toBe('SOAP API');
    });

    it('should extract service name as title', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/">
  <service name="UserManagementService">
    <port/>
  </service>
  <portType name="UserService">
    <operation name="GetUser"/>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const info = generator.getApiInfo();

      expect(info.title).toBe('UserManagementService');
    });

    it('should extract documentation as description', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/">
  <documentation>This is a user management service</documentation>
  <portType name="UserService">
    <operation name="GetUser"/>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const info = generator.getApiInfo();

      expect(info.description).toBe('This is a user management service');
    });
  });

  describe('getWsdlContent', () => {
    it('should return WSDL content as XML string', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/">
  <portType name="UserService">
    <operation name="GetUser"/>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const content = generator.getWsdlContent();

      expect(content).toContain('<?xml');
      expect(content).toContain('definitions');
    });

    it('should build XML from parsed data when rawWsdlText is not available', () => {
      const content = generator.getWsdlContent();
      expect(typeof content).toBe('string');
    });
  });

  describe('getServiceEndpoint', () => {
    it('should return empty string when no spec is loaded', () => {
      expect(generator.getServiceEndpoint()).toBe('');
    });

    it('should parse service endpoint from WSDL', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/">
  <service name="UserService">
    <port name="UserServicePort">
      <soap:address location="http://example.com/UserService"/>
    </port>
  </service>
  <portType name="UserServicePortType">
    <operation name="GetUser"/>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      expect(generator.getServiceEndpoint()).toBe('http://example.com/UserService');
    });

    it('should return empty string when service has no port', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/">
  <service name="UserService"/>
  <portType name="UserServicePortType">
    <operation name="GetUser"/>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      expect(generator.getServiceEndpoint()).toBe('');
    });
  });

  describe('getTargetNamespace', () => {
    it('should return empty string when no spec is loaded', () => {
      expect(generator.getTargetNamespace()).toBe('');
    });

    it('should parse target namespace from WSDL', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" targetNamespace="http://example.com/ns">
  <portType name="UserServicePortType">
    <operation name="GetUser"/>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      expect(generator.getTargetNamespace()).toBe('http://example.com/ns');
    });
  });

  describe('getRequestTemplate', () => {
    it('should generate request template with no input fields', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" targetNamespace="http://example.com/ns">
  <portType name="UserServicePortType">
    <operation name="GetUser"/>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const template = generator.getRequestTemplate('GetUser');

      expect(template).toContain('soap:Envelope');
      expect(template).toContain('soap:Body');
      expect(template).toContain('GetUserRequest');
    });

    it('should use operation inputElement when available via message map', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:tns="http://example.com/ns" targetNamespace="http://example.com/ns">
  <types>
    <schema xmlns="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns">
      <element name="GetUserRequest">
        <complexType>
          <sequence>
            <element name="userId" type="xsd:string" minOccurs="1"/>
            <element name="includeDetails" type="xsd:boolean" minOccurs="0"/>
          </sequence>
        </complexType>
      </element>
    </schema>
  </types>
  <message name="GetUserRequestMsg">
    <part name="parameters" element="tns:GetUserRequest"/>
  </message>
  <portType name="UserServicePortType">
    <operation name="GetUser">
      <input message="tns:GetUserRequestMsg"/>
    </operation>
  </portType>
  <binding name="UserServiceBinding" type="tns:UserServicePortType">
    <operation name="GetUser">
      <operation soapAction="http://example.com/ns/GetUser"/>
    </operation>
  </binding>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const template = generator.getRequestTemplate('GetUser');

      expect(template).toContain('GetUserRequest');
      expect(template).toContain('userId');
    });

    it('should generate template for all XSD types', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:tns="http://example.com/ns" targetNamespace="http://example.com/ns">
  <types>
    <schema xmlns="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns">
      <element name="CreateRecordRequest">
        <complexType>
          <sequence>
            <element name="name" type="xsd:string"/>
            <element name="count" type="xsd:int"/>
            <element name="total" type="xsd:integer"/>
            <element name="bigNum" type="xsd:long"/>
            <element name="smallNum" type="xsd:short"/>
            <element name="price" type="xsd:decimal"/>
            <element name="rate" type="xsd:float"/>
            <element name="ratio" type="xsd:double"/>
            <element name="active" type="xsd:boolean"/>
            <element name="startDate" type="xsd:date"/>
            <element name="createdAt" type="xsd:dateTime"/>
            <element name="startTime" type="xsd:time"/>
            <element name="custom" type="xsd:anyType"/>
          </sequence>
        </complexType>
      </element>
    </schema>
  </types>
  <portType name="RecordServicePortType">
    <operation name="CreateRecord"/>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const template = generator.getRequestTemplate('CreateRecord');

      expect(template).toContain('CreateRecordRequest');
      expect(template).toContain('<tns:name>string</tns:name>');
      expect(template).toContain('<tns:count>0</tns:count>');
      expect(template).toContain('<tns:price>0.0</tns:price>');
      expect(template).toContain('<tns:active>true</tns:active>');
      expect(template).toContain('<tns:startDate>2026-01-01</tns:startDate>');
      expect(template).toContain('<tns:createdAt>2026-01-01T00:00:00Z</tns:createdAt>');
      expect(template).toContain('<tns:startTime>00:00:00</tns:startTime>');
    });
  });

  describe('buildMessageElementMap', () => {
    it('should handle multiple messages as array', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:tns="http://example.com/ns" targetNamespace="http://example.com/ns">
  <message name="GetUserRequestMsg">
    <part name="parameters" element="tns:GetUserRequest"/>
  </message>
  <message name="CreateUserRequestMsg">
    <part name="parameters" element="tns:CreateUserRequest"/>
  </message>
  <portType name="UserServicePortType">
    <operation name="GetUser">
      <input message="tns:GetUserRequestMsg"/>
    </operation>
    <operation name="CreateUser">
      <input message="tns:CreateUserRequestMsg"/>
    </operation>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const ops = generator.getOperations();
      expect(ops[0].inputElement).toBe('GetUserRequest');
      expect(ops[1].inputElement).toBe('CreateUserRequest');
    });

    it('should handle message with no part', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:tns="http://example.com/ns" targetNamespace="http://example.com/ns">
  <message name="EmptyMessage"/>
  <portType name="UserServicePortType">
    <operation name="Ping">
      <input message="tns:EmptyMessage"/>
    </operation>
  </portType>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const ops = generator.getOperations();
      expect(ops[0].inputElement).toBe('');
    });
  });

  describe('buildSoapActionMap', () => {
    it('should handle multiple binding operations as array', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:tns="http://example.com/ns" targetNamespace="http://example.com/ns">
  <portType name="UserServicePortType">
    <operation name="GetUser"/>
    <operation name="CreateUser"/>
  </portType>
  <binding name="UserServiceBinding" type="tns:UserServicePortType">
    <operation name="GetUser">
      <operation soapAction="http://example.com/ns/GetUser"/>
    </operation>
    <operation name="CreateUser">
      <operation soapAction="http://example.com/ns/CreateUser"/>
    </operation>
  </binding>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const ops = generator.getOperations();
      const getUserOp = ops.find(op => op.name === 'GetUser');
      const createUserOp = ops.find(op => op.name === 'CreateUser');

      expect(getUserOp?.soapAction).toBe('http://example.com/ns/GetUser');
      expect(createUserOp?.soapAction).toBe('http://example.com/ns/CreateUser');
    });

    it('should handle binding with no operations', () => {
      const mockWsdlText = `
<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:tns="http://example.com/ns" targetNamespace="http://example.com/ns">
  <portType name="UserServicePortType">
    <operation name="GetUser"/>
  </portType>
  <binding name="UserServiceBinding" type="tns:UserServicePortType"/>
</definitions>
`;

      (fs.readFileSync as jest.Mock).mockReturnValue(mockWsdlText);
      generator.loadSpec('/test/service.wsdl');

      const ops = generator.getOperations();
      expect(ops[0].soapAction).toBe('');
    });
  });
});
