// src/config/saveConfig.ts
import type { ConfigFile } from './configFile.js';
import { readConfigFile, writeConfigFile } from './configFile.js';

export async function saveConfig(partial: ConfigFile, filePath: string): Promise<void> {
  const existing = await readConfigFile(filePath);
  const merged: ConfigFile = { ...existing, ...partial };
  for (const key of Object.keys(merged) as (keyof ConfigFile)[]) {
    if (merged[key] === undefined) delete merged[key];
  }
  await writeConfigFile(filePath, merged);
}
