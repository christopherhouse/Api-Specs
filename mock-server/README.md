# Mock API Server

A comprehensive mock API server that serves all API specifications in the Api-Specs repository.

## Features

- **Multi-format support**: OpenAPI, GraphQL, RAML, WADL, and SOAP/WSDL
- **Automatic discovery**: Scans and loads all specs from the scenarios directory
- **Mock data generation**: Returns realistic random data using Faker.js
- **Parameter validation**: Enforces required parameters
- **Beautiful catalog UI**: Browse and explore all available APIs
- **Server config file**: Optional JSON config for CORS, TLS/HTTPS, response delay, body limits, and more
- **Interactive test consoles**:
  - **Swagger UI** for OpenAPI specs
  - **GraphiQL** for GraphQL APIs
  - **RAML Console** for RAML APIs
  - **SOAP Console** for SOAP/WSDL services
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

### With a config file

```bash
npm start -- --config ./mock-server.config.json
# or in dev mode
npm run dev -- --config ./mock-server.config.json
```

### Docker

The mock server is published as a container image to GitHub Container Registry on every merge to `main`.

#### Pull the image

```bash
docker pull ghcr.io/christopherhouse/api-specs-mock-server:latest
```

#### Run with the built-in specs

The image ships with all the API specs from this repository:

```bash
docker run -p 3000:3000 ghcr.io/christopherhouse/api-specs-mock-server:latest
```

Then open `http://localhost:3000/catalog` to browse the APIs.

#### Run with your own specs

Mount a local directory of specs into the container using `SPECS_DIR`:

```bash
docker run -p 3000:3000 \
  -v /path/to/your/scenarios:/specs \
  -e SPECS_DIR=/specs \
  ghcr.io/christopherhouse/api-specs-mock-server:latest
```

The mounted directory should follow the standard [scenarios layout](../README.md) (e.g. `<domain>/rest/openapi/json/*.json`).

#### Custom port

```bash
docker run -p 8080:8080 -e PORT=8080 ghcr.io/christopherhouse/api-specs-mock-server:latest
```

#### With a config file

```bash
docker run -p 3000:3000 \
  -v $(pwd)/mock-server.config.json:/app/mock-server/config.json:ro \
  ghcr.io/christopherhouse/api-specs-mock-server:latest \
  node dist/server.js --config /app/mock-server/config.json
```

The server will start on port 3000 (or the port specified in the config file or `PORT` environment variable).

## Configuration

The server accepts an optional JSON config file via the `--config` CLI flag. Any settings not provided in the file fall back to sensible defaults.

A sample config file is included at [`mock-server.config.json`](./mock-server.config.json).

| Section | Key | Default | Description |
|---------|-----|---------|-------------|
| *(root)* | `port` | `3000` | Port to listen on (overridden by `PORT` env var) |
| *(root)* | `host` | `"0.0.0.0"` | Host/IP address to bind to |
| *(root)* | `bodyLimit` | `"1mb"` | Maximum request body size (e.g. `"1mb"`, `"500kb"`) |
| *(root)* | `specsDir` | *(auto-detected)* | Path to the scenarios directory containing API specs (overridden by `--specs-dir` flag or `SPECS_DIR` env var) |
| `cors` | `origin` | `"*"` | Allowed origin(s). Use `"*"` for all, or provide a specific origin string or array of strings |
| `cors` | `methods` | `["GET","POST","PUT","PATCH","DELETE","OPTIONS"]` | Allowed HTTP methods |
| `cors` | `allowedHeaders` | `["Content-Type","Authorization"]` | Allowed request headers |
| `cors` | `credentials` | `false` | Whether to include credentials (cookies, auth headers) |
| `cors` | `maxAge` | `86400` | Preflight cache duration in seconds |
| `tls` | `enabled` | `false` | Enable HTTPS. When `true`, `keyFile` and `certFile` are required |
| `tls` | `keyFile` | `""` | Path to PEM-encoded private key (resolved relative to config file) |
| `tls` | `certFile` | `""` | Path to PEM-encoded certificate (resolved relative to config file) |
| `responseDelay` | `enabled` | `false` | Enable artificial response delay to simulate latency |
| `responseDelay` | `minMs` | `0` | Minimum delay in milliseconds |
| `responseDelay` | `maxMs` | `0` | Maximum delay in milliseconds |

### Example: CORS restricted to specific origins

```json
{
  "cors": {
    "origin": ["http://localhost:5173", "https://myapp.example.com"],
    "credentials": true
  }
}
```

### Example: HTTPS with self-signed certificates

```bash
# Generate a self-signed cert for local development
openssl req -x509 -newkey rsa:2048 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj '/CN=localhost'
```

```json
{
  "tls": {
    "enabled": true,
    "keyFile": "./certs/server.key",
    "certFile": "./certs/server.crt"
  }
}
```

### Example: Simulating network latency

```json
{
  "responseDelay": {
    "enabled": true,
    "minMs": 200,
    "maxMs": 800
  }
}
```

## Accessing the APIs

Once the server is running:

1. **Catalog UI**: Visit `http://localhost:3000/catalog` to see all available APIs
2. **REST APIs**: Access at `http://localhost:3000/api/{domain}/{api-name}/{endpoint}`
3. **GraphQL APIs**: Access at `http://localhost:3000/api/{domain}/{api-name}` (includes GraphiQL interface)
4. **SOAP APIs**: Access at `http://localhost:3000/api/{domain}/{api-name}` (POST requests)

### Interactive Test Consoles

Each API format has its own interactive test console accessible from the catalog UI:

- **OpenAPI**: `http://localhost:3000/api/{domain}/{api-name}/docs` - Swagger UI interface
- **GraphQL**: `http://localhost:3000/api/{domain}/{api-name}/graphiql` - GraphiQL playground
- **RAML**: `http://localhost:3000/api/{domain}/{api-name}/console` - RAML API Console
- **SOAP**: `http://localhost:3000/api/{domain}/{api-name}/console` - SOAP testing console with WSDL viewer

## Examples

### OpenAPI (REST)
```bash
# List customers from the banking API
curl http://localhost:3000/api/banking/banking/customers

# Get a specific customer
curl http://localhost:3000/api/banking/banking/customers/123

# Open Swagger UI test console
open http://localhost:3000/api/banking/banking/docs
```

### GraphQL
```bash
# Open GraphiQL in your browser
open http://localhost:3000/api/banking/banking/graphiql

# Or make a POST request with a query
curl -X POST http://localhost:3000/api/banking/banking \
  -H "Content-Type: application/json" \
  -d '{"query": "{ customers { id name email } }"}'
```

### RAML
```bash
# Access RAML API endpoints
curl http://localhost:3000/api/supply-chain/supply-chain/suppliers

# Open RAML API Console
open http://localhost:3000/api/supply-chain/supply-chain/console
```

### WADL
These work similarly to OpenAPI endpoints, using the same URL structure.

### SOAP
```bash
# Get WSDL
curl http://localhost:3000/api/hr/hr/wsdl

# Open SOAP test console
open http://localhost:3000/api/hr/hr/console

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
│   ├── config.ts                    # Server config types and loader
│   ├── discovery.ts                 # Spec file discovery
│   └── generators/
│       ├── openapi-generator.ts     # OpenAPI mock generator
│       ├── graphql-generator.ts     # GraphQL mock generator
│       ├── raml-generator.ts        # RAML mock generator
│       ├── wadl-generator.ts        # WADL mock generator
│       └── soap-generator.ts        # SOAP/WSDL mock generator
├── mock-server.config.json          # Sample config file
├── package.json
└── tsconfig.json
```

## Notes

- All responses are randomly generated and reset on server restart
- No data persistence - this is a stateless mock server
- Authentication is disabled for easy testing
- CORS is enabled for all origins by default (configurable via config file)
- Parameter validation only checks for presence of required parameters, not types

## Troubleshooting

If you encounter issues:

1. **Port already in use**: Set a different port: `PORT=4000 npm run dev`
2. **Spec parsing errors**: Check the console output for specific file errors
3. **Missing dependencies**: Run `npm install` again
4. **TypeScript errors**: Ensure you have the correct Node.js version (v18+ recommended)
