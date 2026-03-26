import { describe, it, expect } from 'vitest';
import { embed, list } from '../src/index.js';
import { createBlankPdf } from './helpers.js';

describe('list', () => {
  it('should return empty array for PDF without embedded files', async () => {
    const pdf = await createBlankPdf();
    const files = await list(pdf);
    expect(files).toEqual([]);
  });

  it('should list embedded files with metadata', async () => {
    const pdf = await createBlankPdf();
    const data = JSON.stringify({ test: true });

    const withFile = await embed(pdf, data, {
      filename: 'vitaeflow.json',
      mimeType: 'application/json',
      relationship: 'Alternative',
      description: 'Structured resume data',
    });

    const files = await list(withFile);
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe('vitaeflow.json');
    expect(files[0].relationship).toBe('Alternative');
    expect(files[0].description).toBe('Structured resume data');
    expect(files[0].size).toBeGreaterThan(0);
  });
});
