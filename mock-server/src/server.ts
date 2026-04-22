import express, { Request, Response, NextFunction, Router } from 'express';
import * as path from 'path';
import * as https from 'https';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import * as fs from 'fs';
import SwaggerParser from '@apidevtools/swagger-parser';
import { SpecDiscovery, SpecFile } from './discovery';
import { OpenAPIMockGenerator } from './generators/openapi-generator';
import { GraphQLMockGenerator } from './generators/graphql-generator';
import { RamlMockGenerator } from './generators/raml-generator';
import { WadlMockGenerator } from './generators/wadl-generator';
import { SoapMockGenerator } from './generators/soap-generator';
import { createHandler } from 'graphql-http/lib/use/express';
import { resolveConfig, ServerConfig } from './config';

const config: ServerConfig = resolveConfig();

const app = express();
const PORT = config.port;

// Middleware — CORS with config
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: config.cors.credentials,
  maxAge: config.cors.maxAge,
}));
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));

// Optional response delay middleware
if (config.responseDelay.enabled) {
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    const delay = Math.floor(
      Math.random() * (config.responseDelay.maxMs - config.responseDelay.minMs + 1)
    ) + config.responseDelay.minMs;
    setTimeout(next, delay);
  });
}

// Discover all specs
const scenariosPath = config.specsDir || path.join(__dirname, '../../scenarios');
const discovery = new SpecDiscovery(scenariosPath);
const specs = discovery.discoverSpecs();

interface ApiEndpoint {
  spec: SpecFile;
  basePath: string;
  info: { title: string; description?: string; version?: string };
  endpoints?: { path: string; method: string; description?: string }[];
}

const apiEndpoints: ApiEndpoint[] = [];

// Setup mock endpoints for each spec
async function setupMockEndpoints() {
  console.log(`\n🔍 Discovered ${specs.length} API specifications\n`);

  for (const spec of specs) {
    const basePath = `/api/${spec.domain}/${spec.apiName}`;

    try {
      if (spec.format === 'openapi') {
        await setupOpenApiMock(spec, basePath);
      } else if (spec.format === 'graphql') {
        await setupGraphQLMock(spec, basePath);
      } else if (spec.format === 'raml') {
        await setupRamlMock(spec, basePath);
      } else if (spec.format === 'wadl') {
        await setupWadlMock(spec, basePath);
      } else if (spec.format === 'soap') {
        await setupSoapMock(spec, basePath);
      }
    } catch (error) {
      console.error(`❌ Error setting up mock for ${spec.fileName}:`, error);
    }
  }
}

async function setupOpenApiMock(spec: SpecFile, basePath: string) {
  const generator = new OpenAPIMockGenerator();
  await generator.loadSpec(spec.filePath);

  const info = generator.getApiInfo();
  const endpoints = generator.getEndpoints();

  const router = Router();

  // Add Swagger UI documentation route
  const specContent = await SwaggerParser.parse(spec.filePath) as Record<string, unknown> & {
    servers?: { url: string; description: string }[];
  };
  // Update server URL in spec to point to the mock server
  if (!specContent.servers || specContent.servers.length === 0) {
    specContent.servers = [{ url: basePath, description: 'Mock Server' }];
  } else {
    specContent.servers = [
      { url: basePath, description: 'Mock Server' },
      ...specContent.servers
    ];
  }

  router.use('/docs', swaggerUi.serve);
  router.get('/docs', swaggerUi.setup(specContent, {
    customSiteTitle: info.title || spec.apiName,
    customCss: '.swagger-ui .topbar { display: none }'
  }));

  for (const endpoint of endpoints) {
    const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    const expressPath = endpoint.path.replace(/{([^}]+)}/g, ':$1');

    router[method](expressPath, (req: Request, res: Response) => {
      // Validate required parameters
      const requiredParams = endpoint.parameters.filter((p: { required?: boolean }) => p.required);

      for (const param of requiredParams) {
        const paramValue = param.in === 'path' ? req.params[param.name] :
                          param.in === 'query' ? req.query[param.name] :
                          param.in === 'header' ? req.headers[param.name.toLowerCase()] :
                          undefined;

        if (!paramValue) {
          return res.status(400).json({
            error: 'Bad Request',
            message: `Missing required parameter: ${param.name}`
          });
        }
      }

      const { statusCode, data } = generator.generateMockResponse(endpoint);
      res.status(statusCode).json(data);
    });
  }

  app.use(basePath, router);

  apiEndpoints.push({
    spec,
    basePath,
    info,
    endpoints: endpoints.map(e => ({
      path: e.path,
      method: e.method,
      description: e.description
    }))
  });

  console.log(`✅ OpenAPI: ${info.title} -> ${basePath}`);
}

async function setupGraphQLMock(spec: SpecFile, basePath: string) {
  const generator = new GraphQLMockGenerator();
  generator.loadSpec(spec.filePath);

  const schema = generator.getSchema();
  const info = generator.getApiInfo();

  if (schema) {
    const resolvers = generator.createMockResolvers();

    // Create a simple root value with resolvers
    const rootValue = {
      ...resolvers.Query,
      ...resolvers.Mutation
    };

    // GraphQL endpoint
    app.all(
      basePath,
      createHandler({
        schema,
        rootValue
      })
    );

    // GraphiQL UI
    app.get(basePath + '/graphiql', (req: Request, res: Response) => {
      res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>GraphiQL</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphiql/graphiql.min.css" />
</head>
<body style="margin: 0;">
  <div id="graphiql" style="height: 100vh;"></div>
  <script crossorigin src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
  <script crossorigin src="https://cdn.jsdelivr.net/npm/graphiql/graphiql.min.js"></script>
  <script>
    const fetcher = GraphiQL.createFetcher({ url: '${basePath}' });
    ReactDOM.render(
      React.createElement(GraphiQL, { fetcher: fetcher }),
      document.getElementById('graphiql')
    );
  </script>
</body>
</html>
      `);
    });

    apiEndpoints.push({
      spec,
      basePath,
      info,
      endpoints: [{ path: basePath, method: 'POST', description: 'GraphQL endpoint' }]
    });

    console.log(`✅ GraphQL: ${info.title} -> ${basePath}`);
  }
}

async function setupRamlMock(spec: SpecFile, basePath: string) {
  const generator = new RamlMockGenerator();
  generator.loadSpec(spec.filePath);

  const info = generator.getApiInfo();
  const endpoints = generator.getEndpoints();

  const router = Router();

  // Add RAML API Console route
  router.get('/console', (_req: Request, res: Response) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${info.title || spec.apiName} - RAML Console</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        .header p { opacity: 0.9; }
        .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
        .endpoint-section {
            background: white;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .endpoint-header {
            background: #f8f9fa;
            padding: 1rem 1.5rem;
            border-bottom: 2px solid #e9ecef;
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .method {
            font-weight: bold;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            font-size: 0.9rem;
            min-width: 80px;
            text-align: center;
        }
        .method.get { background: #61affe; color: white; }
        .method.post { background: #49cc90; color: white; }
        .method.put { background: #fca130; color: white; }
        .method.patch { background: #50e3c2; color: white; }
        .method.delete { background: #f93e3e; color: white; }
        .endpoint-path {
            font-family: 'Courier New', monospace;
            font-size: 1.1rem;
            color: #333;
        }
        .endpoint-body {
            padding: 1.5rem;
        }
        .try-section {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 4px;
            margin-top: 1rem;
        }
        .try-button {
            background: #667eea;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 4px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: 600;
        }
        .try-button:hover { background: #764ba2; }
        .response-section {
            margin-top: 1rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 4px;
            display: none;
        }
        .response-section.active { display: block; }
        pre {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
        }
        .param-input {
            width: 100%;
            padding: 0.5rem;
            margin: 0.5rem 0;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .param-label {
            font-weight: 600;
            margin-top: 0.5rem;
            display: block;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${info.title || spec.apiName}</h1>
        <p>${info.description || 'RAML API Console'}</p>
        <p style="margin-top: 0.5rem; opacity: 0.8;">Base URL: ${basePath}</p>
    </div>
    <div class="container">
        ${endpoints.map((endpoint, idx) => `
            <div class="endpoint-section">
                <div class="endpoint-header">
                    <span class="method ${endpoint.method.toLowerCase()}">${endpoint.method}</span>
                    <span class="endpoint-path">${endpoint.path}</span>
                </div>
                <div class="endpoint-body">
                    <p>${endpoint.description || 'No description available'}</p>
                    <div class="try-section">
                        <h3>Try it out</h3>
                        <div id="params-${idx}"></div>
                        <button class="try-button" onclick="tryEndpoint('${endpoint.method}', '${endpoint.path}', ${idx})">
                            Send Request
                        </button>
                        <div id="response-${idx}" class="response-section">
                            <h4>Response:</h4>
                            <pre id="response-body-${idx}"></pre>
                        </div>
                    </div>
                </div>
            </div>
        `).join('')}
    </div>
    <script>
        async function tryEndpoint(method, path, idx) {
            const responseSection = document.getElementById('response-' + idx);
            const responseBody = document.getElementById('response-body-' + idx);

            try {
                // Replace path parameters
                let url = '${basePath}' + path;
                const pathParams = path.match(/{([^}]+)}/g);
                if (pathParams) {
                    pathParams.forEach(param => {
                        const paramName = param.slice(1, -1);
                        const input = document.querySelector(\`input[name="param-\${idx}-\${paramName}"]\`);
                        if (input) {
                            url = url.replace(param, input.value || '123');
                        }
                    });
                }

                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();
                responseBody.textContent = JSON.stringify(data, null, 2);
                responseSection.classList.add('active');
            } catch (error) {
                responseBody.textContent = 'Error: ' + error.message;
                responseSection.classList.add('active');
            }
        }

        // Setup parameter inputs
        ${endpoints.map((endpoint, idx) => {
          const pathParams = endpoint.path.match(/{([^}]+)}/g) || [];
          return pathParams.length > 0 ? `
            document.getElementById('params-${idx}').innerHTML = \`
              ${pathParams.map(param => {
                const paramName = param.slice(1, -1);
                return `
                  <label class="param-label">${paramName}:</label>
                  <input class="param-input" name="param-${idx}-${paramName}" placeholder="Enter ${paramName}" />
                `;
              }).join('')}
            \`;
          ` : '';
        }).join('')}
    </script>
</body>
</html>
    `);
  });

  for (const endpoint of endpoints) {
    const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    const expressPath = endpoint.path.replace(/{([^}]+)}/g, ':$1');

    router[method](expressPath, (req: Request, res: Response) => {
      const { statusCode, data } = generator.generateMockResponse();
      res.status(statusCode).json(data);
    });
  }

  app.use(basePath, router);

  apiEndpoints.push({
    spec,
    basePath,
    info,
    endpoints: endpoints.map(e => ({
      path: e.path,
      method: e.method,
      description: e.description
    }))
  });

  console.log(`✅ RAML: ${info.title} -> ${basePath}`);
}

async function setupWadlMock(spec: SpecFile, basePath: string) {
  const generator = new WadlMockGenerator();
  generator.loadSpec(spec.filePath);

  const info = generator.getApiInfo();
  const endpoints = generator.getEndpoints();

  const router = Router();

  for (const endpoint of endpoints) {
    const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    const expressPath = endpoint.path.replace(/{([^}]+)}/g, ':$1');

    router[method](expressPath, (req: Request, res: Response) => {
      const { statusCode, data } = generator.generateMockResponse();
      res.status(statusCode).json(data);
    });
  }

  app.use(basePath, router);

  apiEndpoints.push({
    spec,
    basePath,
    info,
    endpoints: endpoints.map(e => ({
      path: e.path,
      method: e.method,
      description: e.description
    }))
  });

  console.log(`✅ WADL: ${info.title} -> ${basePath}`);
}

async function setupSoapMock(spec: SpecFile, basePath: string) {
  const generator = new SoapMockGenerator();
  generator.loadSpec(spec.filePath);

  const info = generator.getApiInfo();
  const operations = generator.getOperations();

  const router = Router();

  // Accept raw XML bodies on this router so the SOAP endpoint can parse them
  router.use(express.text({ type: ['text/xml', 'application/xml', 'application/soap+xml'] }));

  // WSDL endpoint
  router.get('/wsdl', (_req: Request, res: Response) => {
    res.set('Content-Type', 'text/xml');
    res.send(generator.getWsdlContent());
  });

  // SOAP Console endpoint — Swagger UI-style interactive test console
  router.get('/console', (_req: Request, res: Response) => {
    const consoleData = {
      title: info.title || spec.apiName,
      description: info.description || '',
      basePath,
      wsdlUrl: `${basePath}/wsdl`,
      targetNamespace: generator.getTargetNamespace(),
      serviceEndpoint: generator.getServiceEndpoint(),
      operations: operations.map(op => ({
        name: op.name,
        description: op.description || '',
        soapAction: op.soapAction || '',
        requestTemplate: generator.getRequestTemplate(op.name)
      }))
    };

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${consoleData.title} – SOAP Console</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            background: #fafafa;
            color: #3b4151;
            line-height: 1.5;
        }

        /* ── Top bar ─────────────────────────────── */
        .topbar {
            background: #1a1d2e;
            padding: 0.875rem 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }
        .topbar-brand {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            color: #fff;
            font-weight: 700;
            font-size: 1.05rem;
            letter-spacing: -0.01em;
        }
        .topbar-brand .soap-badge {
            background: #7c3aed;
            color: #fff;
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            padding: 0.2rem 0.55rem;
            border-radius: 4px;
            text-transform: uppercase;
        }
        .topbar-links {
            display: flex;
            gap: 0.75rem;
        }
        .topbar-link {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            color: #a5b4fc;
            font-size: 0.8rem;
            font-weight: 500;
            text-decoration: none;
            padding: 0.375rem 0.75rem;
            border: 1px solid rgba(165,180,252,0.3);
            border-radius: 6px;
            transition: background 0.15s, color 0.15s;
        }
        .topbar-link:hover { background: rgba(165,180,252,0.12); color: #fff; }

        /* ── Info block ──────────────────────────── */
        .info-wrapper {
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
            padding: 2.5rem 2rem;
            color: #fff;
        }
        .info-container { max-width: 1100px; margin: 0 auto; }
        .info-title {
            font-size: 2rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            line-height: 1.2;
            margin-bottom: 0.5rem;
        }
        .info-version {
            display: inline-block;
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.25);
            color: #e0e7ff;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.2rem 0.6rem;
            border-radius: 20px;
            margin-left: 0.75rem;
            vertical-align: middle;
        }
        .info-description {
            margin-top: 0.75rem;
            color: #c7d2fe;
            font-size: 0.95rem;
            max-width: 700px;
        }
        .info-meta {
            margin-top: 1.25rem;
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
        }
        .info-meta-item {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.82rem;
            color: #a5b4fc;
        }
        .info-meta-item strong { color: #e0e7ff; }
        .info-meta-item code {
            font-family: 'JetBrains Mono', monospace;
            background: rgba(0,0,0,0.25);
            padding: 0.1rem 0.4rem;
            border-radius: 4px;
            font-size: 0.78rem;
        }
        .wsdl-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.3);
            color: #fff;
            font-size: 0.82rem;
            font-weight: 600;
            padding: 0.45rem 1rem;
            border-radius: 6px;
            text-decoration: none;
            transition: background 0.15s;
        }
        .wsdl-btn:hover { background: rgba(255,255,255,0.22); }

        /* ── Operations container ────────────────── */
        .ops-wrapper { max-width: 1100px; margin: 2rem auto; padding: 0 2rem 3rem; }

        .ops-section-title {
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 1rem;
        }

        /* ── Operation block (Swagger-style) ─────── */
        .opblock {
            border: 1px solid #d1c4e9;
            border-radius: 8px;
            margin-bottom: 0.75rem;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .opblock-summary {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.875rem 1.25rem;
            background: #f3e8ff;
            cursor: pointer;
            user-select: none;
            border-bottom: 1px solid transparent;
            transition: background 0.15s;
        }
        .opblock-summary:hover { background: #ede9fe; }
        .opblock.expanded .opblock-summary { border-bottom-color: #d1c4e9; }
        .opblock-method {
            flex-shrink: 0;
            background: #7c3aed;
            color: #fff;
            font-size: 0.68rem;
            font-weight: 700;
            letter-spacing: 0.07em;
            text-transform: uppercase;
            padding: 0.3rem 0.65rem;
            border-radius: 4px;
            min-width: 52px;
            text-align: center;
        }
        .opblock-name {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.95rem;
            font-weight: 600;
            color: #3b4151;
            flex-shrink: 0;
        }
        .opblock-desc {
            color: #6b7280;
            font-size: 0.85rem;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .opblock-chevron {
            flex-shrink: 0;
            color: #7c3aed;
            transition: transform 0.2s;
            font-size: 0.7rem;
        }
        .opblock.expanded .opblock-chevron { transform: rotate(180deg); }

        /* ── Operation body ──────────────────────── */
        .opblock-body {
            display: none;
            background: #fff;
            padding: 1.5rem;
        }
        .opblock.expanded .opblock-body { display: block; }

        .op-section { margin-bottom: 1.5rem; }
        .op-section:last-child { margin-bottom: 0; }
        .op-section-label {
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #5b21b6;
            margin-bottom: 0.5rem;
        }

        .soap-action-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: #f5f3ff;
            border: 1px solid #ddd6fe;
            border-radius: 6px;
            padding: 0.6rem 0.875rem;
            font-size: 0.82rem;
        }
        .soap-action-label {
            font-weight: 600;
            color: #5b21b6;
            flex-shrink: 0;
        }
        .soap-action-value {
            font-family: 'JetBrains Mono', monospace;
            color: #374151;
            word-break: break-all;
        }
        .soap-action-empty { color: #9ca3af; font-style: italic; }

        .description-text { color: #4b5563; font-size: 0.88rem; }

        /* ── Request editor ──────────────────────── */
        .content-type-label {
            font-size: 0.75rem;
            font-weight: 600;
            color: #6b7280;
            margin-bottom: 0.4rem;
        }
        .request-textarea {
            width: 100%;
            min-height: 220px;
            padding: 1rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.82rem;
            line-height: 1.6;
            color: #1f2937;
            background: #fdfdfd;
            resize: vertical;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        .request-textarea:focus {
            border-color: #7c3aed;
            box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
        }

        /* ── Execute buttons ─────────────────────── */
        .execute-row {
            display: flex;
            gap: 0.625rem;
            margin-top: 0.875rem;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.85rem;
            font-weight: 600;
            padding: 0.5rem 1.125rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            transition: background 0.15s, transform 0.1s;
        }
        .btn:active { transform: scale(0.98); }
        .btn-execute {
            background: #7c3aed;
            color: #fff;
        }
        .btn-execute:hover { background: #6d28d9; }
        .btn-execute:disabled {
            background: #a78bfa;
            cursor: not-allowed;
            transform: none;
        }
        .btn-clear {
            background: transparent;
            color: #6b7280;
            border: 1px solid #d1d5db;
        }
        .btn-clear:hover { background: #f9fafb; color: #374151; }

        /* ── Response section ────────────────────── */
        .response-container { display: none; margin-top: 1.5rem; }
        .response-container.visible { display: block; }

        .response-header-row {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
        }
        .response-label {
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #374151;
        }
        .status-badge {
            font-size: 0.78rem;
            font-weight: 700;
            padding: 0.2rem 0.6rem;
            border-radius: 4px;
        }
        .status-2xx { background: #d1fae5; color: #065f46; }
        .status-4xx { background: #fee2e2; color: #991b1b; }
        .status-5xx { background: #fef3c7; color: #92400e; }
        .status-error { background: #fee2e2; color: #991b1b; }

        .response-body-pre {
            background: #1e1b4b;
            color: #e0e7ff;
            padding: 1rem 1.25rem;
            border-radius: 6px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.78rem;
            line-height: 1.65;
            overflow-x: auto;
            white-space: pre;
            max-height: 400px;
            overflow-y: auto;
        }

        /* ── Spinner ─────────────────────────────── */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.4);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
        }

        /* ── Empty state ─────────────────────────── */
        .no-ops {
            text-align: center;
            padding: 3rem;
            color: #6b7280;
        }
        .no-ops-icon { font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.5; }
    </style>
</head>
<body>

<!-- Top bar -->
<div class="topbar">
    <div class="topbar-brand">
        <span class="soap-badge">SOAP</span>
        WSDL Console
    </div>
    <div class="topbar-links">
        <a class="topbar-link" href="${basePath}/wsdl" target="_blank">
            &#x2197; View WSDL
        </a>
    </div>
</div>

<!-- Info block -->
<div class="info-wrapper">
    <div class="info-container">
        <div class="info-title">
            ${consoleData.title}
        </div>
        ${consoleData.description ? `<div class="info-description">${consoleData.description}</div>` : ''}
        <div class="info-meta">
            <span class="info-meta-item">
                <strong>Mock endpoint:</strong>
                <code>${consoleData.basePath}</code>
            </span>
            ${consoleData.serviceEndpoint ? `
            <span class="info-meta-item">
                <strong>WSDL service URL:</strong>
                <code>${consoleData.serviceEndpoint}</code>
            </span>` : ''}
            ${consoleData.targetNamespace ? `
            <span class="info-meta-item">
                <strong>Namespace:</strong>
                <code>${consoleData.targetNamespace}</code>
            </span>` : ''}
        </div>
        <div style="margin-top: 1.25rem;">
            <a class="wsdl-btn" href="${basePath}/wsdl" target="_blank">
                &#x21E9; Download WSDL
            </a>
        </div>
    </div>
</div>

<!-- Operations -->
<div class="ops-wrapper">
    <div class="ops-section-title">Operations</div>
    <div id="operations-list"></div>
</div>

<script>
    const CONSOLE_DATA = ${JSON.stringify(consoleData)};

    function formatXml(xml) {
        try {
            const INDENT = '  ';
            let formatted = '';
            let depth = 0;
            const lines = xml.replace(/></g, '>\\n<').split('\\n');
            for (const raw of lines) {
                const line = raw.trim();
                if (!line) continue;
                if (line.startsWith('</')) {
                    depth = Math.max(0, depth - 1);
                    formatted += INDENT.repeat(depth) + line + '\\n';
                } else if (line.endsWith('/>') || line.includes('</')) {
                    formatted += INDENT.repeat(depth) + line + '\\n';
                } else if (line.startsWith('<') && !line.startsWith('<?')) {
                    formatted += INDENT.repeat(depth) + line + '\\n';
                    depth++;
                } else {
                    formatted += INDENT.repeat(depth) + line + '\\n';
                }
            }
            return formatted.trim();
        } catch {
            return xml;
        }
    }

    function toggleOp(idx) {
        const block = document.getElementById('opblock-' + idx);
        block.classList.toggle('expanded');
    }

    async function executeOp(idx) {
        const textarea = document.getElementById('req-textarea-' + idx);
        const btn = document.getElementById('execute-btn-' + idx);
        const respContainer = document.getElementById('resp-container-' + idx);
        const statusBadge = document.getElementById('resp-status-' + idx);
        const respBody = document.getElementById('resp-body-' + idx);
        const op = CONSOLE_DATA.operations[idx];

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Sending…';

        const headers = { 'Content-Type': 'text/xml' };
        if (op.soapAction) headers['SOAPAction'] = '"' + op.soapAction + '"';

        try {
            const response = await fetch(CONSOLE_DATA.basePath, {
                method: 'POST',
                headers,
                body: textarea.value
            });
            const text = await response.text();
            const code = response.status;
            const cls = code >= 200 && code < 300 ? 'status-2xx' : code >= 400 && code < 500 ? 'status-4xx' : 'status-5xx';
            statusBadge.textContent = code + ' ' + response.statusText;
            statusBadge.className = 'status-badge ' + cls;
            respBody.textContent = formatXml(text);
        } catch (err) {
            statusBadge.textContent = 'Network Error';
            statusBadge.className = 'status-badge status-error';
            respBody.textContent = err.message;
        }

        respContainer.classList.add('visible');
        btn.disabled = false;
        btn.innerHTML = '&#x25B6; Execute';
    }

    function clearResponse(idx) {
        const respContainer = document.getElementById('resp-container-' + idx);
        respContainer.classList.remove('visible');
    }

    function renderOperations() {
        const container = document.getElementById('operations-list');
        const ops = CONSOLE_DATA.operations;

        if (!ops.length) {
            container.innerHTML = '<div class="no-ops"><div class="no-ops-icon">&#x26A0;</div><p>No operations found in this WSDL.</p></div>';
            return;
        }

        container.innerHTML = ops.map((op, idx) => \`
            <div class="opblock" id="opblock-\${idx}">
                <div class="opblock-summary" onclick="toggleOp(\${idx})">
                    <span class="opblock-method">SOAP</span>
                    <span class="opblock-name">\${op.name}</span>
                    \${op.description ? '<span class="opblock-desc">' + op.description + '</span>' : '<span class="opblock-desc"></span>'}
                    <span class="opblock-chevron">&#x25BC;</span>
                </div>
                <div class="opblock-body">
                    \${op.description ? \`
                    <div class="op-section">
                        <div class="op-section-label">Description</div>
                        <p class="description-text">\${op.description}</p>
                    </div>\` : ''}

                    <div class="op-section">
                        <div class="op-section-label">SOAPAction</div>
                        <div class="soap-action-row">
                            <span class="soap-action-label">SOAPAction:</span>
                            \${op.soapAction
                                ? '<span class="soap-action-value">' + op.soapAction + '</span>'
                                : '<span class="soap-action-empty">(none)</span>'}
                        </div>
                    </div>

                    <div class="op-section">
                        <div class="op-section-label">Request Body</div>
                        <div class="content-type-label">Content-Type: text/xml (SOAP 1.1)</div>
                        <textarea class="request-textarea" id="req-textarea-\${idx}" spellcheck="false">\${op.requestTemplate.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                        <div class="execute-row">
                            <button class="btn btn-execute" id="execute-btn-\${idx}" onclick="executeOp(\${idx})">
                                &#x25B6; Execute
                            </button>
                            <button class="btn btn-clear" onclick="clearResponse(\${idx})">
                                Clear
                            </button>
                        </div>
                    </div>

                    <div class="response-container" id="resp-container-\${idx}">
                        <div class="response-header-row">
                            <span class="response-label">Server Response</span>
                            <span class="status-badge" id="resp-status-\${idx}"></span>
                        </div>
                        <pre class="response-body-pre" id="resp-body-\${idx}"></pre>
                    </div>
                </div>
            </div>
        \`).join('');
    }

    renderOperations();
</script>
</body>
</html>`);
  });

  // SOAP endpoint — parse operation name from request to route correctly
  router.post('/', (req: Request, res: Response) => {
    let operationName = operations.length > 0 ? operations[0].name : 'UnknownOperation';

    // Try SOAPAction header first
    const soapActionHeader = (req.headers['soapaction'] as string | undefined)?.replace(/"/g, '');
    if (soapActionHeader) {
      const matched = operations.find(op => op.soapAction === soapActionHeader);
      if (matched) operationName = matched.name;
    } else if (typeof req.body === 'string') {
      // Extract operation element from inside soap:Body
      const bodyMatch = req.body.match(/<soap:Body[^>]*>\s*<(?:[^:]+:)?(\w+)/i);
      if (bodyMatch) {
        const candidate = bodyMatch[1].replace(/Request$/, '');
        const matched = operations.find(op => op.name === candidate || op.name === bodyMatch[1]);
        if (matched) operationName = matched.name;
      }
    }

    const soapResponse = generator.generateMockResponse(operationName);
    res.set('Content-Type', 'text/xml');
    res.send(soapResponse);
  });

  app.use(basePath, router);

  apiEndpoints.push({
    spec,
    basePath,
    info,
    endpoints: operations.map(op => ({
      path: basePath,
      method: 'POST',
      description: `SOAP Operation: ${op.name}`
    }))
  });

  console.log(`✅ SOAP: ${info.title} -> ${basePath}`);
}

// Catalog data endpoint for JavaScript to fetch
app.get('/catalog/data', (req: Request, res: Response) => {
  const catalogData = apiEndpoints.map(api => {
    const consoleUrl =
      api.spec.format === 'graphql' ? `${api.basePath}/graphiql` :
      api.spec.format === 'openapi' ? `${api.basePath}/docs` :
      api.spec.format === 'raml' ? `${api.basePath}/console` :
      api.spec.format === 'soap' ? `${api.basePath}/console` :
      api.basePath;

    return {
      id: `${api.spec.domain}-${api.spec.format}-${api.spec.apiName}`,
      domain: api.spec.domain,
      format: api.spec.format,
      apiName: api.spec.apiName,
      title: api.info.title || api.spec.apiName,
      description: api.info.description || '',
      version: api.info.version || '',
      basePath: api.basePath,
      consoleUrl: consoleUrl,
      endpoints: api.endpoints || []
    };
  });

  res.json(catalogData);
});

// Catalog UI endpoint
app.get('/catalog', (req: Request, res: Response) => {
  const catalogHtml = fs.readFileSync(path.join(__dirname, 'catalog.html'), 'utf-8');
  res.send(catalogHtml);
});

// Keep legacy catalog endpoint for backward compatibility
app.get('/catalog-old', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Mock Server - Catalog</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 2rem;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            color: white;
            margin-bottom: 3rem;
        }

        header h1 {
            font-size: 3rem;
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }

        header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }

        .stats {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }

        .stat-card {
            background: white;
            padding: 1.5rem 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
        }

        .stat-card .number {
            font-size: 2.5rem;
            font-weight: bold;
            color: #667eea;
        }

        .stat-card .label {
            color: #666;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .api-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: 1.5rem;
        }

        .api-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .api-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 12px rgba(0,0,0,0.15);
        }

        .api-card-header {
            padding: 1.5rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .api-card-title {
            font-size: 1.3rem;
            margin-bottom: 0.5rem;
            font-weight: 600;
        }

        .api-card-meta {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            background: rgba(255,255,255,0.2);
        }

        .api-card-body {
            padding: 1.5rem;
        }

        .api-info {
            margin-bottom: 1rem;
        }

        .api-info-label {
            font-weight: 600;
            color: #333;
            margin-bottom: 0.25rem;
        }

        .api-info-value {
            color: #666;
            font-size: 0.9rem;
        }

        .base-path {
            background: #f7f7f7;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.85rem;
            word-break: break-all;
            margin-bottom: 1rem;
        }

        .endpoints {
            margin-top: 1rem;
        }

        .endpoints-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
        }

        .endpoint {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            background: #f9f9f9;
            border-radius: 6px;
            margin-bottom: 0.5rem;
            font-size: 0.85rem;
        }

        .method {
            font-weight: bold;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.7rem;
            min-width: 60px;
            text-align: center;
        }

        .method.get { background: #61affe; color: white; }
        .method.post { background: #49cc90; color: white; }
        .method.put { background: #fca130; color: white; }
        .method.patch { background: #50e3c2; color: white; }
        .method.delete { background: #f93e3e; color: white; }

        .endpoint-path {
            flex: 1;
            font-family: 'Courier New', monospace;
            color: #666;
        }

        .try-button {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
            transition: background 0.2s;
        }

        .try-button:hover {
            background: #764ba2;
        }

        @media (max-width: 768px) {
            .api-grid {
                grid-template-columns: 1fr;
            }

            header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🚀 API Mock Server</h1>
            <p>Explore and test all available mock APIs</p>
        </header>

        <div class="stats">
            <div class="stat-card">
                <div class="number">${apiEndpoints.length}</div>
                <div class="label">Total APIs</div>
            </div>
            <div class="stat-card">
                <div class="number">${apiEndpoints.filter(a => a.spec.format === 'openapi').length}</div>
                <div class="label">OpenAPI</div>
            </div>
            <div class="stat-card">
                <div class="number">${apiEndpoints.filter(a => a.spec.format === 'graphql').length}</div>
                <div class="label">GraphQL</div>
            </div>
            <div class="stat-card">
                <div class="number">${apiEndpoints.filter(a => a.spec.format === 'raml').length}</div>
                <div class="label">RAML</div>
            </div>
            <div class="stat-card">
                <div class="number">${apiEndpoints.filter(a => a.spec.format === 'wadl').length}</div>
                <div class="label">WADL</div>
            </div>
            <div class="stat-card">
                <div class="number">${apiEndpoints.filter(a => a.spec.format === 'soap').length}</div>
                <div class="label">SOAP</div>
            </div>
        </div>

        <div class="api-grid">
            ${apiEndpoints.map(api => `
                <div class="api-card">
                    <div class="api-card-header">
                        <div class="api-card-title">${api.info.title || api.spec.apiName}</div>
                        <div class="api-card-meta">
                            <span class="badge">${api.spec.format.toUpperCase()}</span>
                            <span class="badge">${api.spec.domain}</span>
                            ${api.info.version ? `<span class="badge">v${api.info.version}</span>` : ''}
                        </div>
                    </div>
                    <div class="api-card-body">
                        ${api.info.description ? `
                            <div class="api-info">
                                <div class="api-info-label">Description</div>
                                <div class="api-info-value">${api.info.description}</div>
                            </div>
                        ` : ''}

                        <div class="api-info">
                            <div class="api-info-label">Base Path</div>
                            <div class="base-path">${api.basePath}</div>
                        </div>

                        ${api.endpoints && api.endpoints.length > 0 ? `
                            <div class="endpoints">
                                <div class="endpoints-title">Endpoints (${api.endpoints.length})</div>
                                ${api.endpoints.slice(0, 5).map(e => `
                                    <div class="endpoint">
                                        <span class="method ${e.method.toLowerCase()}">${e.method}</span>
                                        <span class="endpoint-path">${e.path}</span>
                                    </div>
                                `).join('')}
                                ${api.endpoints.length > 5 ? `
                                    <div style="text-align: center; color: #999; font-size: 0.85rem; margin-top: 0.5rem;">
                                        +${api.endpoints.length - 5} more endpoints
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}

                        ${api.spec.format === 'graphql' ? `
                            <a href="${api.basePath}/graphiql" class="try-button" target="_blank">Open GraphiQL</a>
                        ` : ''}
                        ${api.spec.format === 'openapi' ? `
                            <a href="${api.basePath}/docs" class="try-button" target="_blank">Open Swagger UI</a>
                        ` : ''}
                        ${api.spec.format === 'raml' ? `
                            <a href="${api.basePath}/console" class="try-button" target="_blank">Open API Console</a>
                        ` : ''}
                        ${api.spec.format === 'soap' ? `
                            <a href="${api.basePath}/console" class="try-button" target="_blank">Open SOAP Console</a>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
  `;

  res.send(html);
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.redirect('/catalog');
});

// Start server
async function start() {
  await setupMockEndpoints();

  const protocol = config.tls.enabled ? 'https' : 'http';

  const onListening = () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Mock API Server is running!');
    console.log('='.repeat(60));
    console.log(`\n📍 Server URL: ${protocol}://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${PORT}`);
    console.log(`📋 Catalog UI: ${protocol}://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${PORT}/catalog`);
    if (config.tls.enabled) {
      console.log(`🔒 TLS enabled`);
    }
    if (config.responseDelay.enabled) {
      console.log(`⏱️  Response delay: ${config.responseDelay.minMs}–${config.responseDelay.maxMs}ms`);
    }
    console.log(`\n✨ ${apiEndpoints.length} APIs are ready to serve mock data\n`);
  };

  if (config.tls.enabled) {
    let key: Buffer;
    let cert: Buffer;
    try {
      key = fs.readFileSync(config.tls.keyFile);
    } catch (err) {
      throw new Error(`Failed to read TLS key file: ${config.tls.keyFile} — ${(err as Error).message}`);
    }
    try {
      cert = fs.readFileSync(config.tls.certFile);
    } catch (err) {
      throw new Error(`Failed to read TLS cert file: ${config.tls.certFile} — ${(err as Error).message}`);
    }
    https.createServer({ key, cert }, app).listen(PORT, config.host, onListening);
  } else {
    app.listen(PORT, config.host, onListening);
  }
}

start().catch(console.error);
