import { PDFDocument, PDFDict, PDFRef } from 'pdf-lib';
import {
  getEmbeddedFilesDict,
  collectNameTreeEntries,
  extractStreamBytes,
  resolve,
} from './pdf-utils.js';

/**
 * Extract an embedded file from a PDF by filename.
 *
 * @param pdf - The PDF as a Uint8Array.
 * @param filename - The name of the embedded file to extract.
 * @returns The file content as a Uint8Array, or null if not found.
 */
export async function extract(
  pdf: Uint8Array,
  filename: string,
): Promise<Uint8Array | null> {
  const pdfDoc = await PDFDocument.load(pdf);
  const treeRoot = getEmbeddedFilesDict(pdfDoc);
  if (!treeRoot) return null;

  const entries = collectNameTreeEntries(treeRoot, pdfDoc.context);
  const match = entries.find((e) => e.name === filename);
  if (!match) return null;

  const fileSpec = resolve(match.ref, pdfDoc.context);
  if (!(fileSpec instanceof PDFDict)) return null;

  return extractStreamBytes(fileSpec, pdfDoc.context);
}

/**
 * Extract all embedded files from a PDF.
 *
 * @param pdf - The PDF as a Uint8Array.
 * @returns A Map of filename → file content.
 */
export async function extractAll(
  pdf: Uint8Array,
): Promise<Map<string, Uint8Array>> {
  const result = new Map<string, Uint8Array>();
  const pdfDoc = await PDFDocument.load(pdf);
  const treeRoot = getEmbeddedFilesDict(pdfDoc);
  if (!treeRoot) return result;

  const entries = collectNameTreeEntries(treeRoot, pdfDoc.context);

  for (const entry of entries) {
    const fileSpec = resolve(entry.ref, pdfDoc.context);
    if (!(fileSpec instanceof PDFDict)) continue;

    const data = extractStreamBytes(fileSpec, pdfDoc.context);
    if (data) {
      result.set(entry.name, data);
    }
  }

  return result;
}
