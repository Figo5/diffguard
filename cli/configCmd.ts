// cli/configCmd.ts
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { PROVIDER_PRESETS, getPreset } from '../src/config/presets.js';
import { configFilePath, readConfigFile, writeConfigFile, deleteConfigFile, type ConfigFile } from '../src/config/configFile.js';
import { loadSettings } from '../src/config/loadSettings.js';
import { setKeyInKeychain, getKeyFromKeychain } from '../agent/keychain.js';
import { readHiddenLine } from './key.js';

export interface ConfigDeps {
  readConfigFile: (path: string) => Promise<ConfigFile | null>;
  writeConfigFile: (path: string, cfg: ConfigFile) => Promise<void>;
  deleteConfigFile: (path: string) => Promise<void>;
  configFilePath: (env: NodeJS.ProcessEnv) => string;
  setKeyInKeychain: (key: string) => Promise<void>;
  getKeyFromKeychain: () => Promise<string | null>;
  promptLine: (question: string) => Promise<string>;
  promptHidden: (question: string) => Promise<string>;
}

function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout });
    rl.question(question, (line) => {
      rl.close();
      resolve(line.trim());
    });
  });
}

export const realConfigDeps: ConfigDeps = {
  readConfigFile,
  writeConfigFile,
  deleteConfigFile,
  configFilePath,
  setKeyInKeychain,
  getKeyFromKeychain,
  promptLine,
  promptHidden: readHiddenLine,
};

export interface ConfigFlags {
  provider?: string;
  model?: string;
  baseUrl?: string;
  key?: string;
  show: boolean;
  reset: boolean;
}

export function parseConfigFlags(argv: string[]): ConfigFlags {
  const flags: ConfigFlags = { show: false, reset: false };
  for (const arg of argv) {
    if (arg === '--show') flags.show = true;
    else if (arg === '--reset') flags.reset = true;
    else if (arg.startsWith('--provider=')) flags.provider = arg.slice('--provider='.length);
    else if (arg.startsWith('--model=')) flags.model = arg.slice('--model='.length);
    else if (arg.startsWith('--base-url=')) flags.baseUrl = arg.slice('--base-url='.length);
    else if (arg.startsWith('--key=')) flags.key = arg.slice('--key='.length);
    else throw new Error(`Unknown config option: ${arg}`);
  }
  return flags;
}

export async function handleConfigCommand(argv: string[], deps: ConfigDeps = realConfigDeps): Promise<number> {
  let flags: ConfigFlags;
  try {
    flags = parseConfigFlags(argv);
  } catch (err) {
    console.error(`DiffGuard: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  const path = deps.configFilePath(process.env);

  if (flags.show) {
    const file = await deps.readConfigFile(path);
    const settings = loadSettings(process.env, file);
    const keySource = process.env.ANTHROPIC_API_KEY?.trim() ? 'env' : (await deps.getKeyFromKeychain()) ? 'keychain' : 'none';
    console.log('DiffGuard config:');
    console.log(`  provider: ${settings.provider}`);
    console.log(`  model:    ${settings.model}`);
    console.log(`  baseUrl:  ${settings.baseUrl ?? '(default)'}`);
    console.log(`  key:      ${keySource}`);
    return 0;
  }

  if (flags.reset) {
    await deps.deleteConfigFile(path);
    console.log('DiffGuard: config cleared.');
    return 0;
  }

  const hasFlags = flags.provider !== undefined || flags.model !== undefined || flags.baseUrl !== undefined || flags.key !== undefined;
  if (hasFlags) return applyFlags(flags, path, deps);

  return runWizard(path, deps);
}

async function applyFlags(flags: ConfigFlags, path: string, deps: ConfigDeps): Promise<number> {
  const preset = flags.provider !== undefined ? getPreset(flags.provider) : undefined;
  if (flags.provider !== undefined && !preset) {
    console.error(`DiffGuard: unknown provider '${flags.provider}'. Known: ${PROVIDER_PRESETS.map((p) => p.id).join(', ')}`);
    return 2;
  }
  const provider = preset ? preset.provider : undefined;
  const baseUrl = flags.baseUrl ?? preset?.baseUrl;
  const model = flags.model ?? preset?.defaultModel;
  const needsKey = preset ? preset.needsKey : true;
  if (!provider || !model) {
    console.error('DiffGuard: config requires a provider and model. Run `diffguard config` interactively, or pass --provider and --model.');
    return 2;
  }
  if (flags.key) {
    try {
      await deps.setKeyInKeychain(flags.key);
    } catch (err) {
      console.error(`DiffGuard: could not store the key — ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }
  }
  if (needsKey && !flags.key && !(await deps.getKeyFromKeychain())) {
    console.error('DiffGuard: this provider needs an API key. Pass --key, run `diffguard key set`, or run `diffguard config` interactively.');
    return 2;
  }
  await deps.writeConfigFile(path, { provider, model, baseUrl, needsKey });
  console.log(`DiffGuard: config saved (provider: ${provider}, model: ${model}).`);
  return 0;
}

async function runWizard(path: string, deps: ConfigDeps): Promise<number> {
  console.log('DiffGuard config — set up your provider and model.');
  const customChoice = { id: 'custom', label: 'Custom (OpenAI-compatible base URL)' };
  const choices = [...PROVIDER_PRESETS, customChoice];
  choices.forEach((c, i) => console.log(`  ${i + 1}. ${c.label}`));
  const pick = await deps.promptLine(`Select a provider [1-${choices.length}]: `);
  const index = Number(pick) - 1;
  const choice = Number.isInteger(index) && index >= 0 && index < choices.length ? choices[index] : undefined;
  if (!choice) {
    console.error('DiffGuard: invalid provider selection.');
    return 2;
  }

  let provider: 'anthropic' | 'openai';
  let baseUrl: string | undefined;
  let defaultModel: string;
  let needsKey: boolean;
  if (choice.id === 'custom') {
    provider = 'openai';
    baseUrl = await deps.promptLine('Base URL (e.g. http://localhost:11434/v1): ');
    if (!baseUrl) {
      console.error('DiffGuard: a base URL is required for a custom provider.');
      return 2;
    }
    defaultModel = '';
    needsKey = true;
  } else {
    const preset = getPreset(choice.id)!;
    provider = preset.provider;
    baseUrl = preset.baseUrl;
    defaultModel = preset.defaultModel;
    needsKey = preset.needsKey;
  }

  const model = (await deps.promptLine(`Model [${defaultModel}]: `)) || defaultModel;
  if (!model) {
    console.error('DiffGuard: a model is required.');
    return 2;
  }

  if (needsKey) {
    const key = await deps.promptHidden('Paste your API key (input is hidden): ');
    if (!key) {
      console.error('DiffGuard: no API key provided. Run `diffguard config` again or `diffguard key set`.');
      return 2;
    }
    try {
      await deps.setKeyInKeychain(key);
    } catch (err) {
      console.error(`DiffGuard: could not store the key — ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }
  }

  await deps.writeConfigFile(path, { provider, model, baseUrl, needsKey });
  console.log(`DiffGuard: config saved (provider: ${provider}, model: ${model}).`);
  return 0;
}
