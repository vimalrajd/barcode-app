const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');

const MM_TO_PT = 72 / 25.4;
const LABEL_WIDTH_MM = 50;
const LABEL_HEIGHT_MM = 20;
const LABEL_WIDTH = LABEL_WIDTH_MM * MM_TO_PT;
const LABEL_HEIGHT = LABEL_HEIGHT_MM * MM_TO_PT;

async function makeBarcodePng(text) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: String(text),
    scale: 3,
    height: 9,
    includetext: false,
    backgroundcolor: 'FFFFFF',
    paddingwidth: 0,
    paddingheight: 0,
  });
}

/**
 * items: [{ sku, mrp, quantity }]
 * companyLine: string shown at the bottom of every label (contact + address)
 * Returns a Buffer containing the generated PDF.
 */
function generateLabelsPdf(items, { companyLine = '' } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [LABEL_WIDTH, LABEL_HEIGHT], margin: 0, autoFirstPage: false });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    (async () => {
      const barcodeCache = new Map();
      const margin = 2.5;
      const contentWidth = LABEL_WIDTH - margin * 2;

      for (const item of items) {
        if (!barcodeCache.has(item.sku)) {
          barcodeCache.set(item.sku, await makeBarcodePng(item.sku));
        }
        const barcodePng = barcodeCache.get(item.sku);
        const priceText = `RS. ${formatMrp(item.mrp)}`;

        for (let copy = 0; copy < item.quantity; copy++) {
          doc.addPage({ size: [LABEL_WIDTH, LABEL_HEIGHT], margin: 0 });

          // Fixed vertical slots so content never overflows the tiny label
          // page and triggers pdfkit's automatic (and unwanted) pagination.
          let y = 1.5;

          doc.font('Helvetica-Bold').fontSize(11).fillColor('#3d3d3d');
          doc.text(priceText, margin, y, { width: contentWidth, height: 12, align: 'center', ellipsis: true });
          y += 13;

          const barcodeDrawWidth = contentWidth - 8;
          const barcodeDrawHeight = 15;
          doc.image(barcodePng, margin + 4, y, { width: barcodeDrawWidth, height: barcodeDrawHeight });
          y += barcodeDrawHeight + 1.5;

          doc.moveTo(margin, y).lineTo(LABEL_WIDTH - margin, y).strokeColor('#999999').lineWidth(0.4).stroke();
          y += 1.5;

          doc.font('Helvetica-Bold').fontSize(9).fillColor('#3d3d3d');
          doc.text(item.sku, margin, y, { width: contentWidth, height: 10, align: 'center', ellipsis: true });
          y += 10;

          if (companyLine) {
            doc.font('Helvetica').fontSize(4.3).fillColor('#3d3d3d');
            const remaining = LABEL_HEIGHT - y - 1;
            doc.text(companyLine, margin, y, {
              width: contentWidth,
              height: Math.max(remaining, 0),
              align: 'center',
              lineGap: 0.3,
              ellipsis: true,
            });
          }
        }
      }

      doc.end();
    })().catch(reject);
  });
}

function formatMrp(mrp) {
  const rounded = Math.round(mrp * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

module.exports = { generateLabelsPdf, LABEL_WIDTH, LABEL_HEIGHT };
