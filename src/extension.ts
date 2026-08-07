// src/extension.ts
import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { AuditEngine } from './auditEngine/auditEngine';
import { AnthropicLlmClient } from './auditEngine/llmClient';
import { detectRepoContext } from './auditEngine/repoContext';
import { getApiKey, getSettings, setApiKey } from './settings';
import { getGitDiff, getSelectionText, isGitRepo } from './diffProvider';
import { applyFindings } from './diagnostics';
import { FindingsTreeProvider } from './reportPanel';
import type { Finding } from './findingsModel';

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('diffguard');
  const treeProvider = new FindingsTreeProvider();
  vscode.window.registerTreeDataProvider('diffguard.findings', treeProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand('diffguard.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Paste your Anthropic API key',
        password: true,
        ignoreFocusOut: true,
      });
      if (key) await setApiKey(context.secrets, key.trim());
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('diffguard.auditChanges', () => runAudit('git')),
    vscode.commands.registerCommand('diffguard.auditSelection', () => runAudit('selection'))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('diffguard.jumpToFinding', (finding: Finding) => {
      const uri = vscode.Uri.file(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '').with({
        path: vscode.Uri.joinPath(
          vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(''),
          finding.file
        ).path,
      });
      vscode.window.showTextDocument(uri, { selection: new vscode.Range(finding.line - 1, 0, finding.line - 1, 0) });
    })
  );

  async function runAudit(source: 'git' | 'selection'): Promise<void> {
    const key = await getApiKey(context.secrets);
    if (!key) {
      const choice = await vscode.window.showWarningMessage(
        'DiffGuard: no API key configured. Set one to audit changes.',
        'Set API Key'
      );
      if (choice === 'Set API Key') await vscode.commands.executeCommand('diffguard.setApiKey');
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let diff: string;
    if (source === 'git') {
      if (!workspaceRoot || !(await isGitRepo(workspaceRoot))) {
        const choice = await vscode.window.showWarningMessage(
          'DiffGuard: this folder is not a git repository. Audit a selection instead?',
          'Audit Selection'
        );
        if (choice === 'Audit Selection') await vscode.commands.executeCommand('diffguard.auditSelection');
        return;
      }
      diff = await getGitDiff(workspaceRoot);
    } else {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('DiffGuard: no active editor with a selection.');
        return;
      }
      diff = getSelectionText(editor);
    }

    if (diff.trim() === '') {
      vscode.window.showInformationMessage('DiffGuard: no changes to audit.');
      return;
    }

    const settings = getSettings(vscode.workspace.getConfiguration());
    const engine = new AuditEngine({
      llm: new AnthropicLlmClient(new Anthropic({ apiKey: key })),
      getSettings: () => settings,
    });

    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'DiffGuard: auditing changes…',
        cancellable: true,
      },
      async (_progress, token) => {
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());
        return engine.audit({ diff, repoContext: detectRepoContext(diff) }, controller.signal);
      }
    );

    if (result.error === 'cancelled') {
      return; // previous findings stay visible
    }
    if (result.error === 'empty') {
      vscode.window.showInformationMessage('DiffGuard: no changes to audit.');
      return;
    }
    if (result.error) {
      treeProvider.setError(`Audit failed: ${result.error}`);
      const retry = await vscode.window.showErrorMessage(
        `DiffGuard: audit failed — ${result.error}`,
        'Retry'
      );
      if (retry === 'Retry') await vscode.commands.executeCommand(
        source === 'git' ? 'diffguard.auditChanges' : 'diffguard.auditSelection'
      );
      return;
    }

    if (result.truncated) {
      vscode.window.showWarningMessage('DiffGuard: diff was large and the audit is partial.');
    }
    if (result.dropped > 0) {
      vscode.window.showInformationMessage(
        `DiffGuard: ${result.dropped} malformed finding(s) from the model were dropped.`
      );
    }

    treeProvider.setFindings(result.findings);
    const uri = vscode.window.activeTextEditor?.document.uri;
    if (uri) applyFindings(result.findings, uri, diagnostics, settings.severityThreshold);
  }
}

export function deactivate(): void {}
