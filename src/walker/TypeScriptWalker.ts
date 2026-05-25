import { Project, Node } from 'ts-morph';
import { DependencyWalker, Symbol, BlastRadiusResult } from './types.js';

export class TypeScriptWalker implements DependencyWalker {
  private project: Project;

  constructor(tsConfigFilePath?: string) {
    this.project = new Project(
      tsConfigFilePath
        ? {
            tsConfigFilePath,
            skipFileDependencyResolution: true,
            compilerOptions: { skipLibCheck: true }
          }
        : {
            skipFileDependencyResolution: true,
            compilerOptions: { skipLibCheck: true }
          }
    );
  }

  async getExportedSymbols(filePath: string): Promise<Symbol[]> {
    this.project.addSourceFileAtPathIfExists(filePath);
    const sourceFile = this.project.getSourceFileOrThrow(filePath);
    const exportedDeclarations = sourceFile.getExportedDeclarations();
    const symbols: Symbol[] = [];

    for (const [name, declarations] of exportedDeclarations) {
      for (const decl of declarations) {
        if (Node.isFunctionDeclaration(decl) || Node.isClassDeclaration(decl) || Node.isVariableDeclaration(decl)) {
          let kind: 'function' | 'class' | 'variable' = 'variable';
          if (Node.isFunctionDeclaration(decl)) kind = 'function';
          else if (Node.isClassDeclaration(decl)) kind = 'class';

          const signature = decl.getText().split('{')[0].trim();

          symbols.push({
            name,
            kind,
            filePath,
            signature,
            isExported: true
          });
        }
      }
    }
    return symbols;
  }

  async getBlastRadius(changedFiles: string[]): Promise<BlastRadiusResult> {
    const modifiedSymbols: Symbol[] = [];
    const affectedFilesMap = new Map<string, Set<string>>();

    for (const filePath of changedFiles) {
      this.project.addSourceFileAtPathIfExists(filePath);
      const symbols = await this.getExportedSymbols(filePath);
      modifiedSymbols.push(...symbols);

      const sourceFile = this.project.getSourceFileOrThrow(filePath);
      const exportedDeclarations = sourceFile.getExportedDeclarations();

      for (const [name, declarations] of exportedDeclarations) {
        for (const decl of declarations) {
          if (Node.isReferenceFindable(decl)) {
            const referencedNodes = decl.findReferencesAsNodes();
            for (const refNode of referencedNodes) {
              // Skip the declaration itself (self-reference)
              if (refNode.getStart() === decl.getStart() || refNode.getFirstAncestor(a => a === decl)) {
                continue;
              }

              const refSourceFile = refNode.getSourceFile();
              const refFilePath = refSourceFile.getFilePath();

              if (!affectedFilesMap.has(refFilePath)) {
                affectedFilesMap.set(refFilePath, new Set());
              }
              affectedFilesMap.get(refFilePath)!.add(name);
            }
          }
        }
      }
    }

    const affectedFiles = Array.from(affectedFilesMap.entries()).map(([fPath, consumedSymbols]) => ({
      filePath: fPath,
      consumedSymbols: Array.from(consumedSymbols)
    }));

    const tokenEstimate = modifiedSymbols.length * 40 + affectedFiles.length * 20;

    return {
      modifiedSymbols,
      affectedFiles,
      tokenEstimate
    };
  }
}
