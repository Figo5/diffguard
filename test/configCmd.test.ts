// test/configCmd.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleConfigCommand, parseConfigFlags, type ConfigDeps } from '../cli/configCmd.js';

function deps(over: Partial<ConfigDeps> = {}): ConfigDeps {
  return {
    readConfigFile: async () => null,
    writeConfigFile: vi.fn(async () => {}),
    deleteConfigFile: vi.fn(async () => {}),
    configFilePath: () => '/tmp/diffguard-config.json',
    setKeyInKeychain: vi.fn(async () => {}),
    getKeyFromKeychain: async () => null,
    promptLine: vi.fn().mockResolvedValueOnce('1').mockResolvedValueOnce(''),
    promptHidden: async () => 'sk-test',
    ...over,
  } as ConfigDeps;
}

describe('parseConfigFlags', () => {
  it('parses provider/model/base-url/key flags', () => {
    expect(parseConfigFlags(['--provider=ollama', '--model=gemma4:e2b', '--base-url=http://x/v1', '--key=sk'])).toEqual({
      provider: 'ollama', model: 'gemma4:e2b', baseUrl: 'http://x/v1', key: 'sk', show: false, reset: false,
    });
  });
  it('parses --show and --reset', () => {
    expect(parseConfigFlags(['--show'])).toMatchObject({ show: true });
    expect(parseConfigFlags(['--reset'])).toMatchObject({ reset: true });
  });
  it('throws on an unknown flag', () => {
    expect(() => parseConfigFlags(['--nope'])).toThrow(/unknown config option/i);
  });
});

describe('handleConfigCommand', () => {
  it('writes config and stores the key via the wizard', async () => {
    const d = deps();
    expect(await handleConfigCommand([], d)).toBe(0);
    expect(d.writeConfigFile).toHaveBeenCalledWith('/tmp/diffguard-config.json', { provider: 'anthropic', model: 'claude-sonnet-5', baseUrl: undefined, needsKey: true });
    expect(d.setKeyInKeychain).toHaveBeenCalledWith('sk-test');
  });
  it('writes ollama config without requiring a key', async () => {
    const d = deps({ promptLine: vi.fn().mockResolvedValueOnce('5').mockResolvedValueOnce('') });
    expect(await handleConfigCommand([], d)).toBe(0);
    expect(d.writeConfigFile).toHaveBeenCalledWith('/tmp/diffguard-config.json', { provider: 'openai', model: 'gemma4:e2b', baseUrl: 'http://localhost:11434/v1', needsKey: false });
    expect(d.setKeyInKeychain).not.toHaveBeenCalled();
  });
  it('applies flags non-interactively', async () => {
    const d = deps();
    expect(await handleConfigCommand(['--provider=ollama', '--model=gemma4:e2b'], d)).toBe(0);
    expect(d.writeConfigFile).toHaveBeenCalledWith('/tmp/diffguard-config.json', { provider: 'openai', model: 'gemma4:e2b', baseUrl: 'http://localhost:11434/v1', needsKey: false });
  });
  it('errors on an unknown provider flag', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await handleConfigCommand(['--provider=gemini'], deps())).toBe(2);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('unknown provider'));
    err.mockRestore();
  });
  it('errors when a key-requiring provider has no key', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await handleConfigCommand(['--provider=anthropic'], deps())).toBe(2);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('needs an API key'));
    err.mockRestore();
  });
  it('--reset deletes the config file', async () => {
    const d = deps();
    expect(await handleConfigCommand(['--reset'], d)).toBe(0);
    expect(d.deleteConfigFile).toHaveBeenCalledWith('/tmp/diffguard-config.json');
  });
  it('--show prints the effective config without the key', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const d = deps({ readConfigFile: async () => ({ provider: 'openai', model: 'gemma4:e2b', baseUrl: 'http://localhost:11434/v1', needsKey: false }) });
    expect(await handleConfigCommand(['--show'], d)).toBe(0);
    expect(log.mock.calls.join('\n')).toContain('gemma4:e2b');
    expect(log.mock.calls.join('\n')).not.toContain('sk-');
    log.mockRestore();
  });
});
