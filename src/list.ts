import { PDFDocument, PDFName, PDFDict, PDFRawStream } from 'pdf-lib';
import type { AFRelationship, EmbeddedFileInfo } from './types.js';
import {
  getEmbeddedFilesDict,
  collectNameTreeEntries,
  pdfStringValue,
  readPdfNumber,
  resolve,
} from './pdf-utils.js';

const VALID_RELATIONSHIPS = new Set<string>([
  'Alternative',
  'Source',
  'Data',
  'Supplement',
  'Unspecified',
]);

/**
 * List all embedded files in a PDF.
 *
 * @param pdf - The PDF as a Uint8Array.
 * @returns An array of embedded file information.
 */
export async function list(pdf: Uint8Array): Promise<EmbeddedFileInfo[]> {
  const pdfDoc = await PDFDocument.load(pdf);
  const treeRoot = getEmbeddedFilesDict(pdfDoc);
  if (!treeRoot) return [];

  const entries = collectNameTreeEntries(treeRoot, pdfDoc.context);
  const results: EmbeddedFileInfo[] = [];

  for (const entry of entries) {
    const fileSpec = resolve(entry.ref, pdfDoc.context);
    if (!(fileSpec instanceof PDFDict)) continue;

    const info: EmbeddedFileInfo = {
      filename: entry.name,
      size: 0,
    };

    // Description
    const desc = pdfStringValue(fileSpec.lookup(PDFName.of('Desc')));
    if (desc) info.description = desc;

    // AFRelationship
    const afRel = fileSpec.lookup(PDFName.of('AFRelationship'));
    if (afRel instanceof PDFName) {
      const relValue = afRel.decodeText();
      if (VALID_RELATIONSHIPS.has(relValue)) {
        info.relationship = relValue as AFRelationship;
      }
    }

    // EF dict → stream → size and mimeType
    const efDict = resolve(fileSpec.get(PDFName.of('EF')), pdfDoc.context);
    if (efDict instanceof PDFDict) {
      const stream = resolve(efDict.get(PDFName.of('F')), pdfDoc.context);

      if (stream instanceof PDFRawStream) {
        // MIME type from /Subtype
        const subtype = stream.dict.lookup(PDFName.of('Subtype'));
        if (subtype instanceof PDFName) {
          info.mimeType = subtype.decodeText();
        }

        // Size from /Params/Size or fallback to stream length
        const params = resolve(
          stream.dict.get(PDFName.of('Params')),
          pdfDoc.context,
        );
        if (params instanceof PDFDict) {
          const size = readPdfNumber(params, 'Size', pdfDoc.context);
          if (size !== undefined) info.size = size;
        }
        if (info.size === 0) {
          info.size = stream.contents.length;
        }
      }
    }

    results.push(info);
  }

  return results;
}
