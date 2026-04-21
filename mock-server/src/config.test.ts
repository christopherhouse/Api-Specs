import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DEFAULT_CONFIG, mergeConfig, loadConfigFile, resolveConfig } from './config';

describe('Config Module', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-server-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_CONFIG.port).toBe(3000);
      expect(DEFAULT_CONFIG.host).toBe('0.0.0.0');
      expect(DEFAULT_CONFIG.cors.origin).toBe('*');
      expect(DEFAULT_CONFIG.cors.credentials).toBe(false);
      expect(DEFAULT_CONFIG.tls.enabled).toBe(false);
      expect(DEFAULT_CONFIG.responseDelay.enabled).toBe(false);
      expect(DEFAULT_CONFIG.bodyLimit).toBe('1mb');
    });
  });

  describe('mergeConfig', () => {
    it('should return defaults when given an empty object', () => {
      const result = mergeConfig({});
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should override port', () => {
      const result = mergeConfig({ port: 8080 });
      expect(result.port).toBe(8080);
      expect(result.host).toBe(DEFAULT_CONFIG.host);
    });

    it('should override host', () => {
      const result = mergeConfig({ host: '127.0.0.1' });
      expect(result.host).toBe('127.0.0.1');
    });

    it('should override bodyLimit', () => {
      const result = mergeConfig({ bodyLimit: '10mb' });
      expect(result.bodyLimit).toBe('10mb');
    });

    it('should partially override cors', () => {
      const result = mergeConfig({ cors: { origin: 'http://example.com' } });
      expect(result.cors.origin).toBe('http://example.com');
      // other cors fields remain default
      expect(result.cors.methods).toEqual(DEFAULT_CONFIG.cors.methods);
      expect(result.cors.credentials).toBe(false);
    });

    it('should accept cors origin as array', () => {
      const origins = ['http://a.com', 'http://b.com'];
      const result = mergeConfig({ cors: { origin: origins } });
      expect(result.cors.origin).toEqual(origins);
    });

    it('should override tls settings', () => {
      const result = mergeConfig({
        tls: { enabled: true, keyFile: '/tmp/key.pem', certFile: '/tmp/cert.pem' },
      });
      expect(result.tls.enabled).toBe(true);
      expect(result.tls.keyFile).toBe('/tmp/key.pem');
      expect(result.tls.certFile).toBe('/tmp/cert.pem');
    });

    it('should override responseDelay settings', () => {
      const result = mergeConfig({
        responseDelay: { enabled: true, minMs: 100, maxMs: 500 },
      });
      expect(result.responseDelay.enabled).toBe(true);
      expect(result.responseDelay.minMs).toBe(100);
      expect(result.responseDelay.maxMs).toBe(500);
    });

    it('should ignore unknown keys', () => {
      const result = mergeConfig({ unknownKey: 'value' } as Record<string, unknown>);
      expect(result).toEqual(DEFAULT_CONFIG);
      expect((result as unknown as Record<string, unknown>).unknownKey).toBeUndefined();
    });

    it('should ignore invalid types', () => {
      const result = mergeConfig({ port: 'not-a-number' } as Record<string, unknown>);
      expect(result.port).toBe(DEFAULT_CONFIG.port);
    });
  });

  describe('loadConfigFile', () => {
    it('should load and merge a valid config file', () => {
      const configPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({ port: 4000, host: '127.0.0.1' }));

      const result = loadConfigFile(configPath);
      expect(result.port).toBe(4000);
      expect(result.host).toBe('127.0.0.1');
      expect(result.cors).toEqual(DEFAULT_CONFIG.cors);
    });

    it('should throw when config file does not exist', () => {
      expect(() => loadConfigFile('/nonexistent/config.json')).toThrow('Config file not found');
    });

    it('should throw on invalid JSON', () => {
      const configPath = path.join(tmpDir, 'bad.json');
      fs.writeFileSync(configPath, 'not json{{{');

      expect(() => loadConfigFile(configPath)).toThrow('Invalid JSON');
    });

    it('should resolve TLS paths relative to config file directory', () => {
      const configPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tls: { enabled: true, keyFile: './certs/key.pem', certFile: './certs/cert.pem' },
        })
      );

      const result = loadConfigFile(configPath);
      expect(result.tls.keyFile).toBe(path.join(tmpDir, 'certs', 'key.pem'));
      expect(result.tls.certFile).toBe(path.join(tmpDir, 'certs', 'cert.pem'));
    });

    it('should not resolve TLS paths when TLS is disabled', () => {
      const configPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tls: { enabled: false, keyFile: './certs/key.pem', certFile: './certs/cert.pem' },
        })
      );

      const result = loadConfigFile(configPath);
      // Paths are raw strings since tls is disabled
      expect(result.tls.keyFile).toBe('./certs/key.pem');
    });

    it('should throw when TLS is enabled but keyFile is missing', () => {
      const configPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ tls: { enabled: true, certFile: './certs/cert.pem' } })
      );

      expect(() => loadConfigFile(configPath)).toThrow('keyFile and certFile are required');
    });

    it('should throw when TLS is enabled but certFile is missing', () => {
      const configPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ tls: { enabled: true, keyFile: './certs/key.pem' } })
      );

      expect(() => loadConfigFile(configPath)).toThrow('keyFile and certFile are required');
    });
  });

  describe('resolveConfig', () => {
    const origEnv = process.env.PORT;

    afterEach(() => {
      if (origEnv !== undefined) {
        process.env.PORT = origEnv;
      } else {
        delete process.env.PORT;
      }
    });

    it('should return defaults when no --config flag', () => {
      delete process.env.PORT;
      const result = resolveConfig(['node', 'server.js']);
      expect(result.port).toBe(DEFAULT_CONFIG.port);
      expect(result.cors.origin).toBe('*');
    });

    it('should load config when --config flag is provided', () => {
      const configPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({ port: 9090 }));
      delete process.env.PORT;

      const result = resolveConfig(['node', 'server.js', '--config', configPath]);
      expect(result.port).toBe(9090);
    });

    it('should let PORT env var override config file port', () => {
      const configPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({ port: 9090 }));
      process.env.PORT = '7777';

      const result = resolveConfig(['node', 'server.js', '--config', configPath]);
      expect(result.port).toBe(7777);
    });

    it('should let PORT env var override default port', () => {
      process.env.PORT = '5555';
      const result = resolveConfig(['node', 'server.js']);
      expect(result.port).toBe(5555);
    });
  });
});
