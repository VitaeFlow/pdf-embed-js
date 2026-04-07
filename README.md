# @vitaeflow/pdf-embed

[![CI](https://github.com/VitaeFlow/pdf-embed-js/actions/workflows/ci.yml/badge.svg)](https://github.com/VitaeFlow/pdf-embed-js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@vitaeflow/pdf-embed.svg)](https://www.npmjs.com/package/@vitaeflow/pdf-embed)
[![license](https://img.shields.io/npm/l/@vitaeflow/pdf-embed.svg)](LICENSE)

A generic library for embedding and extracting files in PDF documents, compatible with PDF/A-3. Built on [pdf-lib](https://github.com/Hopding/pdf-lib).

Works in Node.js and browsers.

## Install

```bash
npm install @vitaeflow/pdf-embed
```

## Usage

### Embed a file

```ts
import { embed } from '@vitaeflow/pdf-embed';
import { readFileSync, writeFileSync } from 'fs';

const pdf = readFileSync('document.pdf');
const data = JSON.stringify({ hello: 'world' });

const result = await embed(new Uint8Array(pdf), data, {
  filename: 'data.json',
  mimeType: 'application/json',
  relationship: 'Alternative',
  description: 'Structured data',
});

writeFileSync('output.pdf', result);
```

### Extract a file

```ts
import { extract } from '@vitaeflow/pdf-embed';

const json = await extract(pdfBytes, 'data.json');
if (json) {
  const parsed = JSON.parse(new TextDecoder().decode(json));
}
```

### List embedded files

```ts
import { list } from '@vitaeflow/pdf-embed';

const files = await list(pdfBytes);
// [{ filename: 'data.json', mimeType: 'application/json', size: 42, relationship: 'Alternative' }]
```

### Remove a file

```ts
import { remove } from '@vitaeflow/pdf-embed';

const cleaned = await remove(pdfBytes, 'data.json');
```

### XMP metadata

```ts
import { writeXmp, readXmp } from '@vitaeflow/pdf-embed';

const withXmp = await writeXmp(pdfBytes, {
  namespace: 'urn:example:ns#',
  prefix: 'ex',
  properties: { DocumentType: 'INVOICE', Version: '1.0' },
});

const props = await readXmp(withXmp);
// { DocumentType: 'INVOICE', Version: '1.0' }
```

## API

| Function | Description |
|----------|-------------|
| `embed(pdf, data, options)` | Embed a file in a PDF |
| `extract(pdf, filename)` | Extract a file by name |
| `extractAll(pdf)` | Extract all embedded files |
| `list(pdf)` | List embedded files with metadata |
| `remove(pdf, filename)` | Remove an embedded file |
| `readXmp(pdf)` | Read custom XMP metadata |
| `writeXmp(pdf, options)` | Write custom XMP metadata |

## License

[MIT](LICENSE)
