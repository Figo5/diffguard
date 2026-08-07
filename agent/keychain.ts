// agent/keychain.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SERVICE = 'diffguard';

type ExecFileFn = (cmd: string, args: string[], opts?: object) => Promise<{ stdout: string; stderr: string }>;

export async function getKeyFromKeychain(
  platform: NodeJS.Platform = process.platform,
  exec: ExecFileFn = execFileAsync
): Promise<string | null> {
  if (platform === 'darwin') {
    try {
      const { stdout } = await exec('security', ['find-generic-password', '-s', SERVICE, '-w']);
      const key = stdout.trim();
      return key.length > 0 ? key : null;
    } catch {
      return null;
    }
  }
  if (platform === 'linux') {
    try {
      const { stdout } = await exec('secret-tool', ['lookup', 'service', SERVICE]);
      const key = stdout.trim();
      return key.length > 0 ? key : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function setKeyInKeychain(
  key: string,
  platform: NodeJS.Platform = process.platform,
  exec: ExecFileFn = execFileAsync
): Promise<void> {
  if (platform === 'darwin') {
    try {
      await exec('security', ['add-generic-password', '-a', SERVICE, '-s', SERVICE, '-w', key, '-U']);
    } catch {
      throw new Error('Could not store the API key in the macOS keychain.');
    }
    return;
  }
  if (platform === 'linux') {
    try {
      await exec('secret-tool', ['store', '--label', 'DiffGuard API key', 'service', SERVICE, 'key', SERVICE], { input: key });
    } catch {
      throw new Error('Could not store the API key in the platform keychain.');
    }
    return;
  }
  throw new Error('Keychain storage is not supported on this platform.');
}
