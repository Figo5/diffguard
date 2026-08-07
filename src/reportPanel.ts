import * as vscode from 'vscode';
import type { Finding } from './findingsModel';

export class FindingNode {
  constructor(
    public readonly label: string,
    public readonly finding: Finding | null,
    public readonly children: FindingNode[] = []
  ) {}
}

export class FindingsTreeProvider implements vscode.TreeDataProvider<FindingNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<FindingNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private root: FindingNode[] = [];

  setFindings(findings: Finding[]): void {
    const byCategory = new Map<string, Finding[]>();
    for (const f of findings) {
      const list = byCategory.get(f.category) ?? [];
      list.push(f);
      byCategory.set(f.category, list);
    }
    this.root = [...byCategory.entries()].map(
      ([category, list]) =>
        new FindingNode(
          `${category} (${list.length})`,
          null,
          list.map((f) => new FindingNode(`${f.severity}: ${f.message} — ${f.file}:${f.line}`, f))
        )
    );
    this._onDidChangeTreeData.fire(undefined);
  }

  setError(message: string): void {
    this.root = [new FindingNode(`⚠ ${message}`, null)];
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: FindingNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label);
    item.collapsibleState =
      element.children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
    if (element.finding) {
      item.command = {
        command: 'diffguard.jumpToFinding',
        title: 'Jump to finding',
        arguments: [element.finding],
      };
      if (element.finding.suggestedFix) {
        item.tooltip = `Fix: ${element.finding.suggestedFix}`;
      }
    }
    return item;
  }

  getChildren(element?: FindingNode): FindingNode[] {
    return element ? element.children : this.root;
  }
}
