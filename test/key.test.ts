// test/key.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleKeyCommand } from '../cli/key.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleKeyCommand', () => {
  it('stores a key passed as an argument', async () => {
    const set = vi.fn(async () => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await handleKeyCommand(['set', 'sk-ant-123'], { setKeyInKeychain: set });
    expect(set).toHaveBeenCalledWith('sk-ant-123');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('stored'));
    expect(code).toBe(0);
  });

  it('reads a key from stdin when no argument is given', async () => {
    const set = vi.fn(async () => {});
    const read = vi.fn(async () => 'sk-stdin-key');
    const code = await handleKeyCommand(['set'], { setKeyInKeychain: set, readStdinLine: read });
    expect(set).toHaveBeenCalledWith('sk-stdin-key');
    expect(code).toBe(0);
  });

  it('returns 2 when no key is provided', async () => {
    const set = vi.fn(async () => {});
    const read = vi.fn(async () => '');
    const code = await handleKeyCommand(['set'], { setKeyInKeychain: set, readStdinLine: read });
    expect(set).not.toHaveBeenCalled();
    expect(code).toBe(2);
  });

  it('returns 2 on an unsupported platform', async () => {
    const set = vi.fn(async () => { throw new Error('Keychain storage is not supported on this platform.'); });
    const code = await handleKeyCommand(['set', 'sk-ant-123'], { setKeyInKeychain: set });
    expect(code).toBe(2);
  });

  it('returns 2 for an unknown subcommand', async () => {
    const code = await handleKeyCommand(['get'], { setKeyInKeychain: vi.fn() });
    expect(code).toBe(2);
  });
});
