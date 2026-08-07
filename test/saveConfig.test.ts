// test/saveConfig.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveConfig } from '../src/config/saveConfig.js';
import { readConfigFile } from '../src/config/configFile.js';

let dir: string;
async function tempDir() {
  dir = await mkdtemp(join(tmpdir(), 'diffguard-save-'));
  return dir;
}
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('saveConfig', () => {
  it('writes a fresh config file', async () => {
    const d = await tempDir();
    const p = join(d, 'config.json');
    await saveConfig({ provider: 'openai', model: 'gemma4:e2b', baseUrl: 'http://localhost:11434/v1', needsKey: false }, p);
    expect(await readConfigFile(p)).toEqual({ provider: 'openai', model: 'gemma4:e2b', baseUrl: 'http://localhost:11434/v1', needsKey: false });
  });
  it('merges with an existing file instead of overwriting', async () => {
    const d = await tempDir();
    const p = join(d, 'config.json');
    await saveConfig({ provider: 'openai', baseUrl: 'http://localhost:11434/v1' }, p);
    await saveConfig({ model: 'gemma4:e2b' }, p);
    expect(await readConfigFile(p)).toEqual({ provider: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'gemma4:e2b' });
  });
  it('omits undefined fields', async () => {
    const d = await tempDir();
    const p = join(d, 'config.json');
    await saveConfig({ provider: 'anthropic', model: undefined, baseUrl: undefined }, p);
    expect(await readConfigFile(p)).toEqual({ provider: 'anthropic' });
  });
});
