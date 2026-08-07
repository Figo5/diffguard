import type { Severity } from './findingsModel.js';

export interface DiffGuardSettings {
  model: string;
  severityThreshold: Severity;
  securityEnabled: boolean;
  behaviorEnabled: boolean;
  maxDiffTokens: number;
}
