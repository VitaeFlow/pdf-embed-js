import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, readFileSync } from 'fs';
import { embed, extract, list, readXmp } from '../src/index.js';

async function main() {
  // 1. Créer un PDF bidon avec du contenu
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]); // A4

  page.drawText('Marie Laurent', { x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0) });
  page.drawText('Développeuse Full Stack', { x: 50, y: 720, size: 14, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('marie.laurent@example.com | +33 6 12 34 56 78', { x: 50, y: 695, size: 10, font });
  page.drawText('Expérience', { x: 50, y: 650, size: 16, font });
  page.drawText('Lead Developer - TechCorp (2021 - present)', { x: 50, y: 625, size: 11, font });
  page.drawText('Full Stack Developer - WebAgency (2018 - 2021)', { x: 50, y: 605, size: 11, font });

  const pdfBytes = await doc.save();
  writeFileSync('/tmp/cv-test.pdf', pdfBytes);
  console.log('✓ PDF créé: /tmp/cv-test.pdf (' + pdfBytes.length + ' bytes)');

  // 2. Embarquer du JSON VitaeFlow dedans
  const resume = {
    version: '0.1',
    profile: 'basic',
    lang: 'fr',
    basics: {
      givenName: 'Marie',
      familyName: 'Laurent',
      headline: 'Développeuse Full Stack',
      email: 'marie.laurent@example.com',
    },
    work: [
      { organization: 'TechCorp', position: 'Lead Developer', startDate: '2021-03' },
      { organization: 'WebAgency', position: 'Full Stack Developer', startDate: '2018-01', endDate: '2021-02' },
    ],
  };

  const withJson = await embed(pdfBytes, JSON.stringify(resume, null, 2), {
    filename: 'vitaeflow.json',
    mimeType: 'application/json',
    relationship: 'Alternative',
    description: 'VitaeFlow structured resume data',
    xmp: {
      namespace: 'urn:vitaeflow:pdfa:resume:1p0#',
      prefix: 'vf',
      properties: {
        DocumentType: 'RESUME',
        Version: '0.1',
        ConformanceLevel: 'basic',
      },
    },
  });

  writeFileSync('/tmp/cv-vitaeflow.pdf', withJson);
  console.log('✓ PDF avec VitaeFlow: /tmp/cv-vitaeflow.pdf (' + withJson.length + ' bytes)');

  // 3. Relire le PDF et vérifier
  const reloaded = readFileSync('/tmp/cv-vitaeflow.pdf');

  const files = await list(new Uint8Array(reloaded));
  console.log('✓ Fichiers embarqués:', files);

  const extracted = await extract(new Uint8Array(reloaded), 'vitaeflow.json');
  if (!extracted) {
    console.error('✗ Extraction échouée!');
    process.exit(1);
  }

  const parsed = JSON.parse(new TextDecoder().decode(extracted));
  console.log('✓ JSON extrait:', JSON.stringify(parsed, null, 2));

  const xmp = await readXmp(new Uint8Array(reloaded));
  console.log('✓ XMP metadata:', xmp);

  // 4. Vérifications
  const ok =
    parsed.basics.givenName === 'Marie' &&
    parsed.work.length === 2 &&
    xmp.DocumentType === 'RESUME';

  if (ok) {
    console.log('\n✓ TOUT EST BON — ouvre /tmp/cv-vitaeflow.pdf dans un lecteur PDF pour vérifier les pièces jointes');
  } else {
    console.error('\n✗ ÉCHEC');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
