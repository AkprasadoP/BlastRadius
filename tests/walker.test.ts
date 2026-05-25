import { describe, it, expect } from 'vitest';
import { TypeScriptWalker } from '../src/walker/TypeScriptWalker.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('TypeScriptWalker', () => {
  it('should find exported symbols', async () => {
    const walker = new TypeScriptWalker();
    const filePath = path.resolve(__dirname, 'fixtures/simple-export.ts');
    
    const symbols = await walker.getExportedSymbols(filePath);
    
    expect(symbols.length).toBe(2);
    expect(symbols.map(s => s.name)).toContain('innerFunction');
    expect(symbols.map(s => s.name)).toContain('outerFunction');
  });

  it('should calculate blast radius correctly', async () => {
    const walker = new TypeScriptWalker();
    const filePath = path.resolve(__dirname, 'fixtures/simple-export.ts');
    
    const result = await walker.getBlastRadius([filePath]);
    
    expect(result.modifiedSymbols.length).toBe(2);
    expect(result.affectedFiles.length).toBe(1);
    
    // Changing the inner function correctly flags the outer function as an affected file (in this case, same file)
    const affectedFile = result.affectedFiles[0];
    expect(affectedFile.filePath).toBe(filePath.replace(/\\/g, '/')); // ts-morph uses forward slashes
    expect(affectedFile.consumedSymbols).toContain('innerFunction');
    
    // Token estimate: 2 modified symbols * 40 + 1 affected file * 20 = 100
    expect(result.tokenEstimate).toBe(100);
  });
});
