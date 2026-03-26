import { describe, it, expect } from 'vitest';
import { embed, list, extract } from '../src/index.js';
import { createBlankPdf } from './helpers.js';

describe('embed', () => {
  it('should embed a file in a PDF', async () => {
    const pdf = await createBlankPdf();
    const data = JSON.stringify({ hello: 'world' });

    const result = await embed(pdf, data, {
      filename: 'test.json',
      mimeType: 'application/json',
    });

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(pdf.length);

    // Verify the file is listed
    const files = await list(result);
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe('test.json');
  });

  it('should accept string data', async () => {
    const pdf = await createBlankPdf();
    const data = '{"name": "test"}';

    const result = await embed(pdf, data, {
      filename: 'data.json',
    });

    const extracted = await extract(result, 'data.json');
    expect(extracted).not.toBeNull();
    const text = new TextDecoder().decode(extracted!);
    expect(text).toBe(data);
  });

  it('should embed with AFRelationship', async () => {
    const pdf = await createBlankPdf();

    const result = await embed(pdf, 'test', {
      filename: 'alt.json',
      relationship: 'Alternative',
    });

    const files = await list(result);
    expect(files[0].relationship).toBe('Alternative');
  });

  it('should embed with description', async () => {
    const pdf = await createBlankPdf();

    const result = await embed(pdf, 'test', {
      filename: 'doc.json',
      description: 'My description',
    });

    const files = await list(result);
    expect(files[0].description).toBe('My description');
  });

  it('should embed multiple files', async () => {
    const pdf = await createBlankPdf();

    let result = await embed(pdf, 'first', {
      filename: 'first.txt',
    });
    result = await embed(result, 'second', {
      filename: 'second.txt',
    });

    const files = await list(result);
    expect(files).toHaveLength(2);
    const names = files.map((f) => f.filename).sort();
    expect(names).toEqual(['first.txt', 'second.txt']);
  });
});
