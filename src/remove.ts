import { PDFDocument, PDFName, PDFArray, PDFDict, PDFRef } from 'pdf-lib';

import {
  getEmbeddedFilesDict,
  pdfStringValue,
  getStreamRef,
  resolve,
  rebuildAfArray,
} from './pdf-utils.js';

/**
 * Remove an embedded file from a PDF by filename.
 *
 * Removes the file entry from the EmbeddedFiles name tree, the AF array,
 * and deletes the underlying stream object from the PDF context.
 *
 * @param pdf - The PDF as a Uint8Array.
 * @param filename - The name of the embedded file to remove.
 * @returns The modified PDF as a Uint8Array.
 * @throws If the file is not found.
 */
export async function remove(
  pdf: Uint8Array,
  filename: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdf);
  const treeRoot = getEmbeddedFilesDict(pdfDoc);
  if (!treeRoot) {
    throw new Error(`Embedded file not found: ${filename}`);
  }

  const names = treeRoot.lookup(PDFName.of('Names'));
  if (!(names instanceof PDFArray)) {
    throw new Error(`Embedded file not found: ${filename}`);
  }

  // Find the file entry and collect refs to delete
  let found = false;
  for (let i = 0; i < names.size(); i += 2) {
    const nameObj = names.lookup(i);
    const name = pdfStringValue(nameObj);
    if (name !== filename) continue;

    // Get refs before removing from the tree
    const fileSpecRef = names.get(i + 1);
    const fileSpec = resolve(fileSpecRef, pdfDoc.context);

    // Delete the embedded file stream from the PDF context
    if (fileSpec instanceof PDFDict) {
      const streamRef = getStreamRef(fileSpec, pdfDoc.context);
      if (streamRef) {
        pdfDoc.context.delete(streamRef);
      }
    }

    // Delete the filespec object itself
    if (fileSpecRef instanceof PDFRef) {
      pdfDoc.context.delete(fileSpecRef);
    }

    // Remove from the name tree (highest index first to avoid shift issues)
    names.remove(i + 1);
    names.remove(i);
    found = true;
    break;
  }

  if (!found) {
    throw new Error(`Embedded file not found: ${filename}`);
  }

  // Rebuild the AF array from remaining entries
  rebuildAfArray(pdfDoc, names);

  return pdfDoc.save();
}

