// test/configFile.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configFilePath, readConfigFile, writeConfigFile, deleteConfigFile } from '../src/config/configFile.js';

let dir: string;
async function tempDir() {
  dir = await mkdtemp(join(tmpdir(), 'diffguard-cfg-'));
  return dir;
}
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('configFilePath', () => {
  it('defaults to ~/.config/diffguard/config.json', () => {
    expect(configFilePath({} as NodeJS.ProcessEnv)).toMatch(/diffguard[\\/]config\.json$/);
  });
  it('honors XDG_CONFIG_HOME', () => {
    expect(configFilePath({ XDG_CONFIG_HOME: '/tmp/xdg' } as NodeJS.ProcessEnv)).toBe(join('/tmp/xdg', 'diffguard', 'config.json'));
  });
});

describe('readConfigFile', () => {
  it('returns null when the file is missing', async () => {
    const d = await tempDir();
    expect(await readConfigFile(join(d, 'nope.json'))).toBeNull();
  });
  it('reads a written config', async () => {
    const d = await tempDir();
    const p = join(d, 'config.json');
    await writeConfigFile(p, { provider: 'openai', model: 'gemma4:e2b', baseUrl: 'http://localhost:11434/v1', needsKey: false });
    expect(await readConfigFile(p)).toEqual({ provider: 'openai', model: 'gemma4:e2b', baseUrl: 'http://localhost:11434/v1', needsKey: false });
  });
  it('throws on invalid JSON', async () => {
    const d = await tempDir();
    const p = join(d, 'config.json');
    await writeFile(p, '{ not json', 'utf8');
    await expect(readConfigFile(p)).rejects.toThrow(/invalid config/i);
  });
});

describe('writeConfigFile / deleteConfigFile', () => {
  it('creates parent directories', async () => {
    const d = await tempDir();
    const p = join(d, 'nested', 'dir', 'config.json');
    await writeConfigFile(p, { provider: 'anthropic' });
    expect(await readConfigFile(p)).toEqual({ provider: 'anthropic' });
  });
  it('deleteConfigFile removes the file and is idempotent', async () => {
    const d = await tempDir();
    const p = join(d, 'config.json');
    await writeConfigFile(p, {});
    await deleteConfigFile(p);
    expect(await readConfigFile(p)).toBeNull();
    await deleteConfigFile(p); // must not throw
  });
});
