# Barcode Label Generator

Turns a spreadsheet of `SKU`, `MRP`, and `Quantity` into a single PDF of
50mm x 25mm barcode labels — one page per unit, so a row with quantity 5
produces 5 pages for that SKU.

Each label matches this layout:

```
        RS. <MRP>
      |  barcode  |
      -------------
        <SKU>
  <footer text, e.g. contact + address>
```

## Running locally

```bash
npm install
npm start
```

Then open http://localhost:3000. You can either:

- Upload an `.xlsx`, `.xls`, or `.csv` file, or
- Paste a link to a spreadsheet (a direct `.xlsx`/`.csv` URL, or a Google
  Sheets share/publish link — both `.../edit` and `.../pubhtml` links are
  handled automatically).

Column names are matched flexibly (e.g. "SKU", "Qty", "MRP (Rs)" all work).
Optionally add a footer line (contact email + address) that's printed on
every label.

The generated PDF streams back as a download; the `X-Label-Count` response
header reports the total number of label pages produced.

## API

- `POST /api/generate/upload` — multipart form with a `file` field (and
  optional `companyLine`).
- `POST /api/generate/url` — JSON body `{ "url": "...", "companyLine": "..." }`.

Both return `application/pdf` on success or `{ "error": "..." }` (HTTP 400)
on failure.

## Deployment

This is a stateless Node/Express app with no database — it works on any
Node host (Render, Railway, Fly.io, a VM, etc.) or as a container.

```bash
docker build -t barcode-app .
docker run -p 3000:3000 barcode-app
```

Set `PORT` to change the listening port (defaults to `3000`).

## Limits

- Max upload/remote file size: 20MB
- Max rows per sheet: 5,000
- Max total label pages per request: 20,000
- Remote URL fetches are restricted to public hosts (no localhost/private
  IP ranges) as a basic SSRF guard.
