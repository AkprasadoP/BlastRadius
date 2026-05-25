export interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'variable';
  filePath: string;
  signature: string;
  isExported: boolean;
}

export interface BlastRadiusResult {
  modifiedSymbols: Symbol[];
  affectedFiles: Array<{
    filePath: string;
    consumedSymbols: string[];
  }>;
  tokenEstimate: number;
}

export interface DependencyWalker {
  getBlastRadius(changedFiles: string[]): Promise<BlastRadiusResult>;
  getExportedSymbols(filePath: string): Promise<Symbol[]>;
}
