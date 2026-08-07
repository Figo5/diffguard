import * as vscode from 'vscode';
import type { Finding, Severity } from './findingsModel';

const SEVERITY_ORDER: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function severityToVscode(severity: Severity): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'critical':
    case 'high':
      return vscode.DiagnosticSeverity.Error;
    case 'medium':
      return vscode.DiagnosticSeverity.Warning;
    case 'low':
    case 'info':
      return vscode.DiagnosticSeverity.Information;
  }
}

export function applyFindings(
  findings: Finding[],
  uri: vscode.Uri,
  collection: vscode.DiagnosticCollection,
  threshold: Severity
): void {
  const minIndex = SEVERITY_ORDER.indexOf(threshold);
  const filtered = findings.filter((f) => SEVERITY_ORDER.indexOf(f.severity) >= minIndex);
  const diagnostics = filtered.map(
    (f) =>
      new vscode.Diagnostic(
        new vscode.Range(f.line - 1, 0, f.line - 1, Number.MAX_SAFE_INTEGER),
        f.suggestedFix
          ? `[${f.category}] ${f.message} — Fix: ${f.suggestedFix}`
          : `[${f.category}] ${f.message}`,
        severityToVscode(f.severity)
      )
  );
  collection.set(uri, diagnostics);
}
