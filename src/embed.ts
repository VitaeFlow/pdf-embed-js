import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFRef,
  PDFDict,
  AFRelationship as PdfLibAFRelationship,
} from 'pdf-lib';
import type { AFRelationship, EmbedOptions } from './types.js';
import { writeXmpToDoc } from './xmp.js';
import {
  getEmbeddedFilesDict,
  pdfStringValue,
  getStreamRef,
  resolve,
} from './pdf-utils.js';

const AF_RELATIONSHIP_MAP: Record<AFRelationship, PdfLibAFRelationship> = {
  Alternative: PdfLibAFRelationship.Alternative,
  Source: PdfLibAFRelationship.Source,
  Data: PdfLibAFRelationship.Data,
  Supplement: PdfLibAFRelationship.Supplement,
  Unspecified: PdfLibAFRelationship.Unspecified,
};

/**
 * Embed a file in a PDF document.
 *
 * The file is registered both in the EmbeddedFiles name tree (PDF 1.7)
 * and the AF array (PDF/A-3) for maximum compatibility.
 *
 * @param pdf - The source PDF as a Uint8Array.
 * @param data - The file content to embed (Uint8Array or UTF-8 string).
 * @param options - Embedding options (filename, mimeType, etc.).
 * @returns The modified PDF as a Uint8Array.
 */
export async function embed(
  pdf: Uint8Array,
  data: Uint8Array | string,
  options: EmbedOptions,
): Promise<Uint8Array> {
  const fileData =
    typeof data === 'string' ? new TextEncoder().encode(data) : data;

  const pdfDoc = await PDFDocument.load(pdf);
  const relationship = options.relationship ?? 'Unspecified';

  // Remove existing file with the same name to avoid duplicates
  removeExistingAttachment(pdfDoc, options.filename);

  await pdfDoc.attach(fileData, options.filename, {
    mimeType: options.mimeType ?? 'application/octet-stream',
    description: options.description,
    afRelationship: AF_RELATIONSHIP_MAP[relationship],
  });

  if (options.xmp) {
    writeXmpToDoc(pdfDoc, options.xmp);
  }

  return pdfDoc.save();
}

/**
 * Remove an existing attachment by filename from a loaded PDFDocument.
 * Silently does nothing if the file is not found.
 */
function removeExistingAttachment(
  pdfDoc: PDFDocument,
  filename: string,
): void {
  const treeRoot = getEmbeddedFilesDict(pdfDoc);
  if (!treeRoot) return;

  const names = treeRoot.lookup(PDFName.of('Names'));
  if (!(names instanceof PDFArray)) return;

  for (let i = 0; i < names.size(); i += 2) {
    const nameObj = names.lookup(i);
    const name = pdfStringValue(nameObj);
    if (name !== filename) continue;

    const fileSpecRef = names.get(i + 1);
    const fileSpec = resolve(fileSpecRef, pdfDoc.context);

    // Delete the embedded file stream
    if (fileSpec instanceof PDFDict) {
      const streamRef = getStreamRef(fileSpec, pdfDoc.context);
      if (streamRef) pdfDoc.context.delete(streamRef);
    }

    // Delete the filespec object
    if (fileSpecRef instanceof PDFRef) {
      pdfDoc.context.delete(fileSpecRef);
    }

    // Remove from the name tree
    names.remove(i + 1);
    names.remove(i);

    // Rebuild the AF array
    const catalog = pdfDoc.catalog;
    if (names.size() === 0) {
      catalog.delete(PDFName.of('AF'));
    } else {
      const newAf = pdfDoc.context.obj([]);
      for (let j = 1; j < names.size(); j += 2) {
        const ref = names.get(j);
        if (ref) newAf.push(ref);
      }
      catalog.set(PDFName.of('AF'), newAf);
    }

    return;
  }
}
