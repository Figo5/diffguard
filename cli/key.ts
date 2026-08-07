// cli/key.ts
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { setKeyInKeychain } from '../agent/keychain.js';

export interface KeyDeps {
  setKeyInKeychain: (key: string) => Promise<void>;
  readStdinLine: () => Promise<string>;
}

export const realKeyDeps: KeyDeps = {
  setKeyInKeychain,
  readStdinLine: () =>
    new Promise((resolve) => {
      const rl = createInterface({ input: stdin, output: stdout });
      rl.question('Paste your API key (input is hidden): ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }),
};

export async function handleKeyCommand(argv: string[], deps: KeyDeps = realKeyDeps): Promise<number> {
  const sub = argv[0];
  if (sub !== 'set') {
    console.error('DiffGuard: unknown key subcommand. Usage: diffguard key set [KEY]');
    return 2;
  }
  const key = argv[1] ?? (await deps.readStdinLine());
  if (!key || key.length === 0) {
    console.error('DiffGuard: no API key provided. Usage: diffguard key set [KEY]');
    return 2;
  }
  try {
    await deps.setKeyInKeychain(key);
    console.log('DiffGuard: API key stored in the platform keychain.');
    return 0;
  } catch (err) {
    console.error(`DiffGuard: could not store the key — ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}
