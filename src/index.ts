// src/index.ts
export { AuditEngine } from './auditEngine/auditEngine.js';
export type { AuditRequest, AuditResult, RepoAuditRequest } from './auditEngine/auditEngine.js';
export { createEngine } from './auditEngine/engineFactory.js';
export { AnthropicLlmClient } from './auditEngine/anthropicClient.js';
export { OpenAIClient } from './auditEngine/openaiClient.js';
export type { LlmClient, StreamOptions } from './auditEngine/llmClient.js';
export { buildPrompt, buildRepoAuditPrompt, truncateDiff } from './auditEngine/promptBuilder.js';
export { parseFindings } from './auditEngine/findingsParser.js';
export { detectRepoContext } from './auditEngine/repoContext.js';
export { isGitRepo, getGitDiff, getRepoFiles } from './diffProvider.js';
export type { RepoFiles } from './diffProvider.js';
export type { Finding, Category, Severity } from './findingsModel.js';
export type { DiffGuardSettings } from './types.js';
