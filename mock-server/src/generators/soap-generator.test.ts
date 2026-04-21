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
  });
});
