const path = require('path');
const express = require('express');
const multer = require('multer');

const { parseSheetBuffer } = require('./lib/parseSheet');
const { fetchSheetFromUrl } = require('./lib/fetchSheet');
const { generateLabelsPdf } = require('./lib/generatePdf');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const MAX_ROWS = 5000;
const MAX_TOTAL_LABELS = 20000;

function validateItems(items) {
  if (items.length > MAX_ROWS) {
    throw new Error(`Too many rows (${items.length}). The limit is ${MAX_ROWS}.`);
  }
  const totalLabels = items.reduce((sum, i) => sum + i.quantity, 0);
  if (totalLabels > MAX_TOTAL_LABELS) {
    throw new Error(`Too many total labels requested (${totalLabels}). The limit is ${MAX_TOTAL_LABELS}.`);
  }
  if (totalLabels === 0) {
    throw new Error('Every row has a quantity of 0 - nothing to generate.');
  }
  return totalLabels;
}

async function handleGenerate(req, res, getBufferAndMeta) {
  try {
    const { buffer, contentType, filename } = await getBufferAndMeta();
    const items = await parseSheetBuffer(buffer, contentType, filename);
    const totalLabels = validateItems(items);

    const companyLine = typeof req.body.companyLine === 'string' ? req.body.companyLine.slice(0, 300) : '';

    const pdfBuffer = await generateLabelsPdf(items, { companyLine });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="barcode-labels.pdf"');
    res.setHeader('X-Label-Count', String(totalLabels));
    res.setHeader('Access-Control-Expose-Headers', 'X-Label-Count');
    res.send(pdfBuffer);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to generate labels.' });
  }
}

app.post('/api/generate/upload', upload.single('file'), (req, res) => {
  handleGenerate(req, res, async () => {
    if (!req.file) throw new Error('No file was uploaded.');
    return { buffer: req.file.buffer, contentType: req.file.mimetype, filename: req.file.originalname };
  });
});

app.post('/api/generate/url', (req, res) => {
  handleGenerate(req, res, async () => {
    const url = (req.body && req.body.url) || '';
    if (!url.trim()) throw new Error('No URL was provided.');
    return fetchSheetFromUrl(url.trim());
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    res.status(400).json({ error: err.message || 'Request failed.' });
    return;
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Barcode label generator listening on http://localhost:${PORT}`);
});
