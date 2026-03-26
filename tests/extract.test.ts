import { describe, it, expect } from 'vitest';
import { embed, extract, extractAll } from '../src/index.js';
import { createBlankPdf } from './helpers.js';

describe('extract', () => {
  it('should extract an embedded file by name', async () => {
    const pdf = await createBlankPdf();
    const data = JSON.stringify({ key: 'value' });

    const withFile = await embed(pdf, data, {
      filename: 'test.json',
      mimeType: 'application/json',
    });

    const extracted = await extract(withFile, 'test.json');
    expect(extracted).not.toBeNull();
    const text = new TextDecoder().decode(extracted!);
    expect(text).toBe(data);
  });

  it('should return null for non-existent file', async () => {
    const pdf = await createBlankPdf();
    const result = await extract(pdf, 'nope.json');
    expect(result).toBeNull();
  });

  it('should return null for PDF without embedded files', async () => {
    const pdf = await createBlankPdf();
    const result = await extract(pdf, 'anything.json');
    expect(result).toBeNull();
  });
});

describe('extractAll', () => {
  it('should extract all embedded files', async () => {
    const pdf = await createBlankPdf();

    let withFiles = await embed(pdf, 'content-a', {
      filename: 'a.txt',
    });
    withFiles = await embed(withFiles, 'content-b', {
      filename: 'b.txt',
    });

    const all = await extractAll(withFiles);
    expect(all.size).toBe(2);

    const aText = new TextDecoder().decode(all.get('a.txt')!);
    expect(aText).toBe('content-a');

    const bText = new TextDecoder().decode(all.get('b.txt')!);
    expect(bText).toBe('content-b');
  });

  it('should return empty map for PDF without embedded files', async () => {
    const pdf = await createBlankPdf();
    const all = await extractAll(pdf);
    expect(all.size).toBe(0);
  });
});
