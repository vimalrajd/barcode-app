const dns = require('dns').promises;
const net = require('net');

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const FETCH_TIMEOUT_MS = 15000;

function resolveGoogleSheetsUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.hostname !== 'docs.google.com') return rawUrl;

  const publishedMatch = url.pathname.match(/^\/spreadsheets\/d\/e\/([^/]+)\//);
  if (publishedMatch) {
    return `https://docs.google.com/spreadsheets/d/e/${publishedMatch[1]}/pub?output=xlsx`;
  }

  const normalMatch = url.pathname.match(/^\/spreadsheets\/d\/([^/]+)\//);
  if (normalMatch) {
    return `https://docs.google.com/spreadsheets/d/${normalMatch[1]}/export?format=xlsx`;
  }

  return rawUrl;
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fe80:')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7));
    return false;
  }
  return true;
}

async function assertPublicHost(hostname) {
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length) throw new Error('Could not resolve host.');
  for (const { address } of records) {
    if (isPrivateIp(address)) {
      throw new Error('This URL resolves to a private or internal address and cannot be fetched.');
    }
  }
}

async function fetchSheetFromUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('That does not look like a valid URL.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only http/https URLs are supported.');
  }

  const resolvedUrl = resolveGoogleSheetsUrl(url.toString());
  const finalUrl = new URL(resolvedUrl);
  await assertPublicHost(finalUrl.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(finalUrl.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'barcode-label-generator/1.0' },
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Timed out fetching the spreadsheet URL.');
    throw new Error(`Failed to fetch the URL: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch the URL (HTTP ${response.status}).`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_BYTES) {
    throw new Error('The remote file is too large (limit 20MB).');
  }

  const reader = response.body.getReader();
  const bufChunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) throw new Error('The remote file is too large (limit 20MB).');
    bufChunks.push(value);
  }

  const contentType = response.headers.get('content-type') || '';
  const filename = finalUrl.pathname.split('/').pop() || '';
  return { buffer: Buffer.concat(bufChunks), contentType, filename };
}

module.exports = { fetchSheetFromUrl, resolveGoogleSheetsUrl, isPrivateIp };
