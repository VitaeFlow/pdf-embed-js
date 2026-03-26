import { describe, it, expect } from 'vitest';
import { readXmp, writeXmp } from '../src/index.js';
import { createBlankPdf } from './helpers.js';

describe('writeXmp / readXmp', () => {
  it('should write and read custom XMP properties', async () => {
    const pdf = await createBlankPdf();

    const withXmp = await writeXmp(pdf, {
      namespace: 'urn:vitaeflow:pdfa:resume:1p0#',
      prefix: 'vf',
      properties: {
        DocumentType: 'RESUME',
        Version: '0.1',
        ConformanceLevel: 'standard',
      },
    });

    const props = await readXmp(withXmp);
    expect(props.DocumentType).toBe('RESUME');
    expect(props.Version).toBe('0.1');
    expect(props.ConformanceLevel).toBe('standard');
  });

  it('should return empty object for PDF without XMP', async () => {
    const pdf = await createBlankPdf();
    const props = await readXmp(pdf);
    expect(props).toEqual({});
  });

  it('should escape and unescape XML special characters', async () => {
    const pdf = await createBlankPdf();

    const withXmp = await writeXmp(pdf, {
      namespace: 'urn:test:ns#',
      prefix: 'test',
      properties: {
        Value: 'a < b & c > d',
      },
    });

    const props = await readXmp(withXmp);
    expect(props.Value).toBe('a < b & c > d');
  });

  it('should merge properties when writing to same namespace twice', async () => {
    const pdf = await createBlankPdf();

    const first = await writeXmp(pdf, {
      namespace: 'urn:test:ns#',
      prefix: 'vf',
      properties: { A: '1', B: '2' },
    });

    const second = await writeXmp(first, {
      namespace: 'urn:test:ns#',
      prefix: 'vf',
      properties: { B: 'updated', C: '3' },
    });

    const props = await readXmp(second);
    expect(props.B).toBe('updated');
    expect(props.C).toBe('3');
  });

  it('should reject invalid prefix names', async () => {
    const pdf = await createBlankPdf();

    await expect(
      writeXmp(pdf, {
        namespace: 'urn:test:ns#',
        prefix: 'bad prefix',
        properties: { A: '1' },
      }),
    ).rejects.toThrow('Invalid XMP prefix');
  });

  it('should reject invalid property key names', async () => {
    const pdf = await createBlankPdf();

    await expect(
      writeXmp(pdf, {
        namespace: 'urn:test:ns#',
        prefix: 'vf',
        properties: { 'bad>key': '1' },
      }),
    ).rejects.toThrow('Invalid XMP property name');
  });
});
