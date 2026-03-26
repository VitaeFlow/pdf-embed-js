import { describe, it, expect } from 'vitest';
import { embed, list, remove } from '../src/index.js';
import { createBlankPdf } from './helpers.js';

describe('remove', () => {
  it('should remove an embedded file', async () => {
    const pdf = await createBlankPdf();

    const withFile = await embed(pdf, 'data', {
      filename: 'test.json',
    });

    expect(await list(withFile)).toHaveLength(1);

    const cleaned = await remove(withFile, 'test.json');
    expect(await list(cleaned)).toHaveLength(0);
  });

  it('should throw when file not found', async () => {
    const pdf = await createBlankPdf();
    await expect(remove(pdf, 'nope.json')).rejects.toThrow(
      'Embedded file not found',
    );
  });

  it('should only remove the specified file', async () => {
    const pdf = await createBlankPdf();

    let withFiles = await embed(pdf, 'a', { filename: 'a.txt' });
    withFiles = await embed(withFiles, 'b', { filename: 'b.txt' });

    const cleaned = await remove(withFiles, 'a.txt');
    const remaining = await list(cleaned);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].filename).toBe('b.txt');
  });
});
