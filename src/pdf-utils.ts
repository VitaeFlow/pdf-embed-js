import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFString,
  PDFHexString,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
} from 'pdf-lib';

/**
 * A name/value pair from a PDF name tree.
 * Names are stored as alternating [name, ref, name, ref, ...] in the Names array.
 */
export interface NameTreeEntry {
  name: string;
  ref: PDFRef | PDFDict;
}

/**
 * Resolve a PDF object, dereferencing if it's a PDFRef.
 */
export function resolve(
  obj: ReturnType<PDFDict['get']>,
  context: PDFDocument['context'],
): unknown {
  return obj instanceof PDFRef ? context.lookup(obj) : obj;
}

/**
 * Extract a text value from a PDF string object (PDFString or PDFHexString).
 */
export function pdfStringValue(obj: unknown): string | undefined {
  if (obj instanceof PDFString) return obj.decodeText();
  if (obj instanceof PDFHexString) return obj.decodeText();
  return undefined;
}

/**
 * Get the EmbeddedFiles name tree dict from a PDF document catalog.
 */
export function getEmbeddedFilesDict(
  pdfDoc: PDFDocument,
): PDFDict | undefined {
  const namesRef = pdfDoc.catalog.get(PDFName.of('Names'));
  if (!namesRef) return undefined;

  const namesDict = resolve(namesRef, pdfDoc.context);
  if (!(namesDict instanceof PDFDict)) return undefined;

  const embeddedFilesRef = namesDict.get(PDFName.of('EmbeddedFiles'));
  if (!embeddedFilesRef) return undefined;

  const embeddedFiles = resolve(embeddedFilesRef, pdfDoc.context);
  if (!(embeddedFiles instanceof PDFDict)) return undefined;

  return embeddedFiles;
}

/**
 * Collect all name/value entries from a PDF name tree, handling both
 * leaf nodes (with Names array) and intermediate nodes (with Kids array).
 *
 * Per ISO 32000 §7.9.6, a name tree node has either:
 * - A "Names" array of [name, value, name, value, ...] pairs (leaf)
 * - A "Kids" array of child name tree nodes (intermediate)
 */
export function collectNameTreeEntries(
  node: PDFDict,
  context: PDFDocument['context'],
): NameTreeEntry[] {
  const entries: NameTreeEntry[] = [];

  const namesArray = resolve(node.get(PDFName.of('Names')), context);
  if (namesArray instanceof PDFArray) {
    for (let i = 0; i < namesArray.size(); i += 2) {
      const nameObj = namesArray.lookup(i);
      const name = pdfStringValue(nameObj);
      const valueRef = namesArray.get(i + 1);
      if (name && valueRef) {
        entries.push({
          name,
          ref: valueRef as PDFRef | PDFDict,
        });
      }
    }
    return entries;
  }

  const kidsArray = resolve(node.get(PDFName.of('Kids')), context);
  if (kidsArray instanceof PDFArray) {
    for (let i = 0; i < kidsArray.size(); i++) {
      const kid = resolve(kidsArray.get(i), context);
      if (kid instanceof PDFDict) {
        entries.push(...collectNameTreeEntries(kid, context));
      }
    }
  }

  return entries;
}

/**
 * Extract the decompressed bytes from an embedded file stream.
 */
export function extractStreamBytes(
  fileSpec: PDFDict,
  context: PDFDocument['context'],
): Uint8Array | null {
  const efDict = resolve(fileSpec.get(PDFName.of('EF')), context);
  if (!(efDict instanceof PDFDict)) return null;

  const stream = resolve(efDict.get(PDFName.of('F')), context);
  if (!(stream instanceof PDFRawStream)) return null;

  return decodePDFRawStream(stream).decode();
}

/**
 * Get the stream ref (PDFRef) for an embedded file, used for cleanup.
 */
export function getStreamRef(
  fileSpec: PDFDict,
  context: PDFDocument['context'],
): PDFRef | undefined {
  const efDict = resolve(fileSpec.get(PDFName.of('EF')), context);
  if (!(efDict instanceof PDFDict)) return undefined;

  const ref = efDict.get(PDFName.of('F'));
  return ref instanceof PDFRef ? ref : undefined;
}

/**
 * Read a numeric value from a PDF dictionary, handling indirect references.
 */
export function readPdfNumber(
  dict: PDFDict,
  key: string,
  context: PDFDocument['context'],
): number | undefined {
  const obj = resolve(dict.get(PDFName.of(key)), context);
  if (obj instanceof PDFNumber) return obj.asNumber();
  return undefined;
}

/**
 * Decode a (possibly compressed) XMP metadata stream to a string.
 */
export function decodeXmpStream(stream: PDFRawStream): string {
  const bytes = decodePDFRawStream(stream).decode();
  return new TextDecoder().decode(bytes);
}

/**
 * Rebuild the catalog-level AF array from the remaining entries
 * in the EmbeddedFiles name tree. Removes the AF key entirely
 * if no entries remain.
 */
export function rebuildAfArray(pdfDoc: PDFDocument, names: PDFArray): void {
  const catalog = pdfDoc.catalog;

  if (names.size() === 0) {
    catalog.delete(PDFName.of('AF'));
    return;
  }

  const newAf = pdfDoc.context.obj([]);
  for (let i = 1; i < names.size(); i += 2) {
    const ref = names.get(i);
    if (ref) newAf.push(ref);
  }
  catalog.set(PDFName.of('AF'), newAf);
}
