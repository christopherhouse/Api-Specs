import * as fs from 'fs';
import * as path from 'path';

export interface CorsConfig {
  /** Allowed origins. Use '*' for all, or provide specific origins. */
  origin: string | string[];
  /** Allowed HTTP methods. */
  methods: string[];
  /** Allowed request headers. */
  allowedHeaders: string[];
  /** Whether to include credentials (cookies, authorization headers). */
  credentials: boolean;
  /** Preflight response cache duration in seconds. */
  maxAge: number;
}

export interface TlsConfig {
  /** Enable HTTPS. When true, keyFile and certFile are required. */
  enabled: boolean;
  /** Path to the PEM-encoded private key file. */
  keyFile: string;
  /** Path to the PEM-encoded certificate file. */
  certFile: string;
}

export interface ResponseDelayConfig {
  /** Enable artificial response delay to simulate latency. */
  enabled: boolean;
  /** Minimum delay in milliseconds. */
  minMs: number;
  /** Maximum delay in milliseconds. */
  maxMs: number;
}

export interface ServerConfig {
  /** Port to listen on. */
  port: number;
  /** Host/IP to bind to. */
  host: string;
  /** CORS configuration. */
  cors: CorsConfig;
  /** TLS/HTTPS configuration. */
  tls: TlsConfig;
  /** Artificial response delay configuration. */
  responseDelay: ResponseDelayConfig;
  /** Maximum request body size (e.g. '1mb', '500kb'). */
  bodyLimit: string;
}

export const DEFAULT_CONFIG: ServerConfig = {
  port: 3000,
  host: '0.0.0.0',
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 86400,
  },
  tls: {
    enabled: false,
    keyFile: '',
    certFile: '',
  },
  responseDelay: {
    enabled: false,
    minMs: 0,
    maxMs: 0,
  },
  bodyLimit: '1mb',
};

/**
 * Deep-merge a partial config into the defaults, producing a full ServerConfig.
 * Only known keys from DEFAULT_CONFIG are merged; unknown keys are ignored.
 */
export function mergeConfig(partial: Record<string, unknown>): ServerConfig {
  const merged = { ...DEFAULT_CONFIG };

  if (typeof partial.port === 'number') merged.port = partial.port;
  if (typeof partial.host === 'string') merged.host = partial.host;
  if (typeof partial.bodyLimit === 'string') merged.bodyLimit = partial.bodyLimit;

  if (partial.cors && typeof partial.cors === 'object') {
    const c = partial.cors as Record<string, unknown>;
    merged.cors = { ...DEFAULT_CONFIG.cors };
    if (typeof c.origin === 'string' || Array.isArray(c.origin)) {
      merged.cors.origin = c.origin as string | string[];
    }
    if (Array.isArray(c.methods)) merged.cors.methods = c.methods as string[];
    if (Array.isArray(c.allowedHeaders)) merged.cors.allowedHeaders = c.allowedHeaders as string[];
    if (typeof c.credentials === 'boolean') merged.cors.credentials = c.credentials;
    if (typeof c.maxAge === 'number') merged.cors.maxAge = c.maxAge;
  }

  if (partial.tls && typeof partial.tls === 'object') {
    const t = partial.tls as Record<string, unknown>;
    merged.tls = { ...DEFAULT_CONFIG.tls };
    if (typeof t.enabled === 'boolean') merged.tls.enabled = t.enabled;
    if (typeof t.keyFile === 'string') merged.tls.keyFile = t.keyFile;
    if (typeof t.certFile === 'string') merged.tls.certFile = t.certFile;
  }

  if (partial.responseDelay && typeof partial.responseDelay === 'object') {
    const r = partial.responseDelay as Record<string, unknown>;
    merged.responseDelay = { ...DEFAULT_CONFIG.responseDelay };
    if (typeof r.enabled === 'boolean') merged.responseDelay.enabled = r.enabled;
    if (typeof r.minMs === 'number') merged.responseDelay.minMs = r.minMs;
    if (typeof r.maxMs === 'number') merged.responseDelay.maxMs = r.maxMs;
  }

  return merged;
}

/**
 * Load a config file from disk and merge with defaults.
 * Resolves file paths (TLS keyFile/certFile) relative to the config file location.
 */
export function loadConfigFile(configPath: string): ServerConfig {
  const absolutePath = path.resolve(configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, 'utf-8');
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${absolutePath}`);
  }

  const config = mergeConfig(parsed);
  const configDir = path.dirname(absolutePath);

  // Resolve TLS file paths relative to config file location
  if (config.tls.enabled) {
    if (config.tls.keyFile) {
      config.tls.keyFile = path.resolve(configDir, config.tls.keyFile);
    }
    if (config.tls.certFile) {
      config.tls.certFile = path.resolve(configDir, config.tls.certFile);
    }
  }

  return config;
}

/**
 * Parse CLI arguments to find a --config flag and load the config.
 * Falls back to DEFAULT_CONFIG when no --config is provided.
 * Also respects the PORT environment variable as an override.
 */
export function resolveConfig(argv: string[] = process.argv): ServerConfig {
  const configIndex = argv.indexOf('--config');
  let config: ServerConfig;

  if (configIndex !== -1 && argv[configIndex + 1]) {
    const configPath = argv[configIndex + 1];
    config = loadConfigFile(configPath);
    console.log(`📄 Loaded config from ${path.resolve(configPath)}`);
  } else {
    config = { ...DEFAULT_CONFIG, cors: { ...DEFAULT_CONFIG.cors }, tls: { ...DEFAULT_CONFIG.tls }, responseDelay: { ...DEFAULT_CONFIG.responseDelay } };
  }

  // Environment variable override for port
  if (process.env.PORT) {
    const envPort = parseInt(process.env.PORT, 10);
    if (!isNaN(envPort)) {
      config.port = envPort;
    }
  }

  return config;
}
