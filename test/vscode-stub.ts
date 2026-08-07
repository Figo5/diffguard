// test/vscode-stub.ts
// Minimal VSCode API stub for vitest, satisfying what the code under test needs

export const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
};

export class EventEmitter {
  event = Symbol('event');
  fire() {}
}

export class TreeItem {
  collapsibleState = undefined;
  command = undefined;
}

export const TreeItemCollapsibleState = {
  Collapsed: 1,
  None: 0,
};

export class Diagnostic {
  constructor(range: unknown, message: string, severity: number) {}
}

export class Range {
  constructor(startLine: number, startChar: number, endLine: number, endChar: number) {}
}

export class Uri {
  static parse() { return {}; }
}

// TreeDataProvider is an interface; we just need the type to exist
export interface TreeDataProvider<T> {
  onDidChangeTreeData?: unknown;
  getTreeItem(element: T): TreeItem;
  getChildren(element?: T): T[];
}

export type SecretStorage = {
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
};
