import { PDFDocument } from 'pdf-lib';

/** Create a minimal valid PDF for testing. */
export async function createBlankPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  return doc.save();
}
