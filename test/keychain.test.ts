// test/keychain.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getKeyFromKeychain, setKeyInKeychain } from '../agent/keychain.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getKeyFromKeychain', () => {
  it('returns the stored key on macOS', async () => {
    const execFile = vi.fn(async () => ({ stdout: 'sk-ant-123\n', stderr: '' }));
    expect(await getKeyFromKeychain('darwin', execFile as never)).toBe('sk-ant-123');
  });

  it('returns null when the keychain has no entry', async () => {
    const execFile = vi.fn(async () => { throw new Error('not found'); });
    expect(await getKeyFromKeychain('darwin', execFile as never)).toBeNull();
  });

  it('returns null on unsupported platforms', async () => {
    expect(await getKeyFromKeychain('win32')).toBeNull();
  });
});

describe('setKeyInKeychain', () => {
  it('stores the key on macOS', async () => {
    const execFile = vi.fn(async () => ({ stdout: '', stderr: '' }));
    await setKeyInKeychain('sk-ant-123', 'darwin', execFile as never);
    expect(execFile).toHaveBeenCalledWith(
      'security',
      expect.arrayContaining(['add-generic-password', '-a', 'diffguard', '-s', 'diffguard', '-w', 'sk-ant-123'])
    );
  });

  it('sanitizes the error so the key never appears in the thrown error message', async () => {
    const apiKey = 'sk-ant-sensitive-key-12345';
    const execFile = vi.fn(async () => {
      throw new Error(`Command failed: security add-generic-password -a diffguard -s diffguard -w ${apiKey} -U`);
    });
    await expect(setKeyInKeychain(apiKey, 'darwin', execFile as never)).rejects.toThrow();
    try {
      await setKeyInKeychain(apiKey, 'darwin', execFile as never);
    } catch (err) {
      expect(err instanceof Error ? err.message : String(err)).not.toContain(apiKey);
    }
  });
});
