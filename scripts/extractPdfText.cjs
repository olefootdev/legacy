const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('Usage: node extractPdfText.cjs <path-to-pdf>');
  process.exit(1);
}

async function extractText() {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
  }

  console.log(fullText);
}

extractText().catch(error => {
  console.error('Error parsing PDF:', error);
  process.exit(1);
});
