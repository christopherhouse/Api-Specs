import express, { Request, Response, Router } from 'express';
import * as path from 'path';
import cors from 'cors';
import { SpecDiscovery, SpecFile } from './discovery';
import { OpenAPIMockGenerator } from './generators/openapi-generator';
import { GraphQLMockGenerator } from './generators/graphql-generator';
import { RamlMockGenerator } from './generators/raml-generator';
import { WadlMockGenerator } from './generators/wadl-generator';
import { SoapMockGenerator } from './generators/soap-generator';
import { createHandler } from 'graphql-http/lib/use/express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Discover all specs
const scenariosPath = path.join(__dirname, '../../scenarios');
const discovery = new SpecDiscovery(scenariosPath);
const specs = discovery.discoverSpecs();

interface ApiEndpoint {
  spec: SpecFile;
  basePath: string;
  info: any;
  endpoints?: any[];
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

  for (const endpoint of endpoints) {
    const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    const expressPath = endpoint.path.replace(/{([^}]+)}/g, ':$1');

    router[method](expressPath, (req: Request, res: Response) => {
      // Validate required parameters
      const requiredParams = endpoint.parameters.filter((p: any) => p.required);

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

  // WSDL endpoint
  router.get('/wsdl', (req: Request, res: Response) => {
    res.set('Content-Type', 'text/xml');
    res.send(generator.getWsdlContent());
  });

  // SOAP endpoint
  router.post('/', (req: Request, res: Response) => {
    // Extract operation name from SOAP request (simplified)
    const body = req.body;
    let operationName = 'UnknownOperation';

    if (operations.length > 0) {
      operationName = operations[0].name;
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

// Catalog UI endpoint
app.get('/catalog', (req: Request, res: Response) => {
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

  app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Mock API Server is running!');
    console.log('='.repeat(60));
    console.log(`\n📍 Server URL: http://localhost:${PORT}`);
    console.log(`📋 Catalog UI: http://localhost:${PORT}/catalog`);
    console.log(`\n✨ ${apiEndpoints.length} APIs are ready to serve mock data\n`);
  });
}

start().catch(console.error);
