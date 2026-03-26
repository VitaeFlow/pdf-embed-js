/**
 * Relationship between the embedded file and the PDF document.
 * See PDF 2.0 specification, Table 46.
 */
export type AFRelationship =
  | 'Alternative'
  | 'Source'
  | 'Data'
  | 'Supplement'
  | 'Unspecified';

/**
 * Options for embedding a file in a PDF.
 */
export interface EmbedOptions {
  /** Name of the embedded file as it appears in the PDF. */
  filename: string;
  /** MIME type of the embedded file. Defaults to 'application/octet-stream'. */
  mimeType?: string;
  /** Relationship between the file and the PDF. Defaults to 'Unspecified'. */
  relationship?: AFRelationship;
  /** Human-readable description of the file. */
  description?: string;
  /** Custom XMP metadata to write alongside the embedded file. */
  xmp?: XmpOptions;
}

/**
 * Custom XMP metadata options.
 */
export interface XmpOptions {
  /** XML namespace URI (e.g. 'urn:vitaeflow:pdfa:resume:1p0#'). */
  namespace: string;
  /** XML namespace prefix (e.g. 'vf'). */
  prefix: string;
  /** Key-value pairs to write as XMP properties. */
  properties: Record<string, string>;
}

/**
 * Information about an embedded file found in a PDF.
 */
export interface EmbeddedFileInfo {
  /** Filename as stored in the PDF. */
  filename: string;
  /** MIME type, if specified. */
  mimeType?: string;
  /** Size in bytes of the embedded file. */
  size: number;
  /** AFRelationship, if specified. */
  relationship?: AFRelationship;
  /** Description, if specified. */
  description?: string;
}
