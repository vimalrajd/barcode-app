# Barcode Label Generator

Turns a spreadsheet of `SKU`, `MRP`, and `Quantity` into a single PDF of
50mm x 20mm barcode labels — one page per unit, so a row with quantity 5
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

## Gyroscope angle visualizer (MPU6050 + Arduino)

`public/gyro.html` (linked from the home page) is a standalone page that
shows a live 3D view of an Arduino + MPU6050's orientation, read straight
from USB serial in the browser via the [Web Serial
API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) &mdash;
no drivers, backend, or extra install required.

It expects the Arduino sketch to print lines in this format (115200 baud):

```
Angle from origin -> X: 12.34  Y: -3.21  Z: 45.00 (deg)
```

which is exactly what a standard complementary-filter MPU6050 sketch
(gyro + accel fused for roll/pitch, gyro-only integration for yaw) prints.

**To run it:**

1. Wire the MPU6050 to the Arduino: `VCC`&rarr;5V (or 3.3V, check your
   board), `GND`&rarr;GND, `SCL`&rarr;`SCL`/`A5`, `SDA`&rarr;`SDA`/`A4`.
2. Upload your sketch via the Arduino IDE, then **close the Serial
   Monitor** &mdash; only one program can hold the serial port open at a
   time, and the web page needs it.
3. Start this app (`npm start`) and open http://localhost:3000/gyro.html
   in **Chrome or Edge** (Web Serial isn't supported in Firefox/Safari).
4. Click **Connect to Arduino**, pick the Arduino's port from the browser
   prompt, and confirm the baud rate matches the sketch's `Serial.begin(...)`
   (115200 by default).
5. Tilt the sensor &mdash; the 3D board and the live X/Y/Z readouts should
   track it. Yaw (Z) will drift slowly since it's pure gyro integration
   with no accelerometer reference; use **Set current as zero** to
   re-baseline any axis without resetting the board.

The page also works opened directly as a file, but serving it from this
app (or any localhost/HTTPS origin) is the more reliable option since some
browsers restrict Web Serial on plain `file://` pages.

## Deployment

This is a stateless Node/Express app with no database — it works on any
Node host (Render, Railway, Fly.io, a VM, etc.) or as a container.

### Docker image (built automatically by CI)

Every push to `main` builds and publishes a Docker image to GitHub
Container Registry via `.github/workflows/docker-publish.yml` — no extra
secrets required, it uses the repo's built-in `GITHUB_TOKEN`.

```bash
docker pull ghcr.io/vimalrajd/barcode-app:latest
docker run -p 3000:3000 ghcr.io/vimalrajd/barcode-app:latest
```

The package is published under the repository's **Packages** tab on
GitHub. If the package is private, make it public (or `docker login
ghcr.io` first) before pulling it on your host.

To point any Node host or PaaS (Render, Railway, Fly.io, a VM, etc.) at
this app, just have it run that image (most platforms accept a container
registry image directly — no separate build step needed).

### Building locally

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
