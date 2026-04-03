import { PDFDocument, PDFName, PDFRef, PDFRawStream } from 'pdf-lib';
import type { XmpOptions } from './types.js';
import { decodeXmpStream, resolve } from './pdf-utils.js';

const XML_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9._-]*$/;

/**
 * Read custom XMP metadata properties from a PDF.
 *
 * Returns all properties found across custom namespaces (non-standard).
 * Standard XMP properties (dc:, xmp:, pdf:) are excluded.
 *
 * @param pdf - The PDF as a Uint8Array.
 * @returns Key-value pairs of custom XMP properties.
 */
export async function readXmp(
  pdf: Uint8Array,
): Promise<Record<string, string>> {
  const pdfDoc = await PDFDocument.load(pdf);
  const xmpData = getXmpString(pdfDoc);
  if (!xmpData) return {};

  return parseCustomXmpProperties(xmpData);
}

/**
 * Write custom XMP metadata to a PDF.
 *
 * If a Description block with the same namespace already exists,
 * its properties are merged (updated). Otherwise a new block is added.
 *
 * @param pdf - The PDF as a Uint8Array.
 * @param options - XMP namespace, prefix, and properties to write.
 * @returns The modified PDF as a Uint8Array.
 */
export async function writeXmp(
  pdf: Uint8Array,
  options: XmpOptions,
): Promise<Uint8Array> {
  validateXmpOptions(options);

  const pdfDoc = await PDFDocument.load(pdf);
  const existingXmp = getXmpString(pdfDoc);

  const newXmp = existingXmp
    ? mergeIntoExistingXmp(existingXmp, options)
    : buildXmpPacket(options);

  setXmpStream(pdfDoc, newXmp);

  return pdfDoc.save();
}

/**
 * Write XMP metadata directly to an already-loaded PDFDocument.
 * Used internally by embed() to avoid a double serialize round-trip.
 * @internal
 */
export function writeXmpToDoc(pdfDoc: PDFDocument, options: XmpOptions): void {
  validateXmpOptions(options);
  const existingXmp = getXmpString(pdfDoc);
  const newXmp = existingXmp
    ? mergeIntoExistingXmp(existingXmp, options)
    : buildXmpPacket(options);
  setXmpStream(pdfDoc, newXmp);
}

function validateXmpOptions(options: XmpOptions): void {
  if (!XML_NAME_REGEX.test(options.prefix)) {
    throw new Error(
      `Invalid XMP prefix: "${options.prefix}". Must be a valid XML name.`,
    );
  }
  for (const key of Object.keys(options.properties)) {
    if (!XML_NAME_REGEX.test(key)) {
      throw new Error(
        `Invalid XMP property name: "${key}". Must be a valid XML name.`,
      );
    }
  }
}

function getXmpString(pdfDoc: PDFDocument): string | undefined {
  const metadataRef = pdfDoc.catalog.get(PDFName.of('Metadata'));
  if (!metadataRef) return undefined;

  const metadata = resolve(metadataRef, pdfDoc.context);
  if (!(metadata instanceof PDFRawStream)) return undefined;

  return decodeXmpStream(metadata);
}

function setXmpStream(pdfDoc: PDFDocument, xmp: string): void {
  const xmpBytes = new TextEncoder().encode(xmp);
  const stream = pdfDoc.context.stream(xmpBytes, {
    Type: 'Metadata',
    Subtype: 'XML',
    Length: xmpBytes.length,
  });
  const ref = pdfDoc.context.register(stream);
  pdfDoc.catalog.set(PDFName.of('Metadata'), ref);
}

function parseCustomXmpProperties(xmp: string): Record<string, string> {
  const result: Record<string, string> = {};

  const standardPrefixes = new Set([
    'dc',
    'xmp',
    'xmpMM',
    'pdf',
    'pdfaid',
    'rdf',
    'xmlns',
    'x',
  ]);

  // Match simple element properties: <prefix:Name>value</prefix:Name>
  // Also handles optional attributes on the element (e.g. xml:lang="x-default")
  const propRegex =
    /<([a-zA-Z_][a-zA-Z0-9._-]*):([a-zA-Z_][a-zA-Z0-9._-]*)[^>]*>([^<]*)<\/\1:\2>/g;
  let match;

  while ((match = propRegex.exec(xmp)) !== null) {
    const prefix = match[1];
    const name = match[2];
    const value = match[3].trim();

    if (standardPrefixes.has(prefix)) continue;

    result[name] = unescapeXml(value);
  }

  return result;
}

function buildXmpPacket(options: XmpOptions): string {
  const props = buildPropsXml(options);

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:${options.prefix}="${escapeXml(options.namespace)}">
${props}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function mergeIntoExistingXmp(xmp: string, options: XmpOptions): string {
  // Check if a Description block with this namespace already exists
  const nsPattern = new RegExp(
    `<rdf:Description[^>]*xmlns:${options.prefix}="${escapeRegex(options.namespace)}"[^>]*>[\\s\\S]*?</rdf:Description>`,
  );
  const existingBlock = nsPattern.exec(xmp);

  if (existingBlock) {
    // Parse existing properties from the block and merge with new ones
    const existingProps = parseCustomXmpProperties(existingBlock[0]);
    const mergedProps = { ...existingProps, ...options.properties };
    const mergedOptions = { ...options, properties: mergedProps };

    const newBlock = `<rdf:Description rdf:about=""
      xmlns:${options.prefix}="${escapeXml(options.namespace)}">
${buildPropsXml(mergedOptions)}
    </rdf:Description>`;
    return xmp.slice(0, existingBlock.index) + newBlock + xmp.slice(existingBlock.index + existingBlock[0].length);
  }

  // No existing block — insert before closing </rdf:RDF>
  const closingTag = '</rdf:RDF>';
  const insertPos = xmp.lastIndexOf(closingTag);
  if (insertPos === -1) {
    return buildXmpPacket(options);
  }

  const newBlock = `    <rdf:Description rdf:about=""
      xmlns:${options.prefix}="${escapeXml(options.namespace)}">
${buildPropsXml(options)}
    </rdf:Description>`;

  return xmp.slice(0, insertPos) + newBlock + '\n  ' + xmp.slice(insertPos);
}

function buildPropsXml(options: XmpOptions): string {
  return Object.entries(options.properties)
    .map(
      ([key, value]) =>
        `      <${options.prefix}:${key}>${escapeXml(value)}</${options.prefix}:${key}>`,
    )
    .join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
