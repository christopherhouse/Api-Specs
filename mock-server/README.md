# Mock API Server

A comprehensive mock API server that serves all API specifications in the Api-Specs repository.

## Features

- **Multi-format support**: OpenAPI, GraphQL, RAML, WADL, and SOAP/WSDL
- **Automatic discovery**: Scans and loads all specs from the scenarios directory
- **Mock data generation**: Returns realistic random data using Faker.js
- **Parameter validation**: Enforces required parameters
- **Beautiful catalog UI**: Browse and explore all available APIs
- **GraphiQL interface**: Interactive GraphQL playground for GraphQL APIs
- **No authentication required**: All endpoints are publicly accessible

## Installation

```bash
cd mock-server
npm install
```

## Usage

### Development mode (with auto-reload)

```bash
npm run dev
```

### Build and run

```bash
npm run build
npm start
```

The server will start on port 3000 (or the port specified in the PORT environment variable).

## Accessing the APIs

Once the server is running:

1. **Catalog UI**: Visit `http://localhost:3000/catalog` to see all available APIs
2. **REST APIs**: Access at `http://localhost:3000/api/{domain}/{api-name}/{endpoint}`
3. **GraphQL APIs**: Access at `http://localhost:3000/api/{domain}/{api-name}` (includes GraphiQL interface)
4. **SOAP APIs**: Access at `http://localhost:3000/api/{domain}/{api-name}` (POST requests)

## Examples

### OpenAPI (REST)
```bash
# List customers from the banking API
curl http://localhost:3000/api/banking/banking/customers

# Get a specific customer
curl http://localhost:3000/api/banking/banking/customers/123
```

### GraphQL
```bash
# Open GraphiQL in your browser
open http://localhost:3000/api/banking/banking

# Or make a POST request with a query
curl -X POST http://localhost:3000/api/banking/banking \
  -H "Content-Type: application/json" \
  -d '{"query": "{ customers { id name email } }"}'
```

### RAML/WADL
These work similarly to OpenAPI endpoints, using the same URL structure.

### SOAP
```bash
# Get WSDL
curl http://localhost:3000/api/hr/hr/wsdl

# Call SOAP operation
curl -X POST http://localhost:3000/api/hr/hr \
  -H "Content-Type: text/xml" \
  -d '<soap:Envelope>...</soap:Envelope>'
```

## How It Works

1. **Discovery**: On startup, the server scans the `scenarios/` directory for all API spec files
2. **Parsing**: Each spec is parsed using format-specific parsers:
   - OpenAPI: swagger-parser
   - GraphQL: graphql (schema builder)
   - RAML: custom RAML 1.0 parser
   - WADL: fast-xml-parser
   - WSDL: fast-xml-parser
3. **Mock generation**: Uses @faker-js/faker to generate realistic random data
4. **Routing**: Creates Express routes for each endpoint
5. **Validation**: Validates required parameters before returning responses

## Architecture

```
mock-server/
├── src/
│   ├── server.ts                    # Main server and Express app
│   ├── discovery.ts                 # Spec file discovery
│   └── generators/
│       ├── openapi-generator.ts     # OpenAPI mock generator
│       ├── graphql-generator.ts     # GraphQL mock generator
│       ├── raml-generator.ts        # RAML mock generator
│       ├── wadl-generator.ts        # WADL mock generator
│       └── soap-generator.ts        # SOAP/WSDL mock generator
├── package.json
└── tsconfig.json
```

## Notes

- All responses are randomly generated and reset on server restart
- No data persistence - this is a stateless mock server
- Authentication is disabled for easy testing
- CORS is enabled for all origins
- Parameter validation only checks for presence of required parameters, not types

## Troubleshooting

If you encounter issues:

1. **Port already in use**: Set a different port: `PORT=4000 npm run dev`
2. **Spec parsing errors**: Check the console output for specific file errors
3. **Missing dependencies**: Run `npm install` again
4. **TypeScript errors**: Ensure you have the correct Node.js version (v18+ recommended)
