#!/usr/bin/env node
/* Trezyn standalone tool: unlock what Trezyn locked, without the website.
   Needs Node.js 16 or newer. No packages to install.

   node trezyn-tool.js text  "tz1.AbCd..."           unlock text from the Encrypt tool
   node trezyn-tool.js file  secret.pdf.tzenc [dir]   unlock a file from the Encrypt tool
   node trezyn-tool.js image hidden.png [dir]         read a message or file hidden by the Hide tool

   It asks for the password. The exact formats are in FORMAT.md. */
'use strict';
const crypto = require('crypto'), zlib = require('zlib'), fs = require('fs'), path = require('path'), readline = require('readline');
const ITER = 600000;
const fail = (m) => { console.error(m); process.exit(1); };
const kdf = (pw, salt, n) => crypto.pbkdf2Sync(Buffer.from(pw.normalize('NFKC'), 'utf8'), salt, ITER, n, 'sha256');
function gcm(key, iv, ct) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(ct.subarray(ct.length - 16));
  return Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
}
function openSealed(data, pw, magic) {
  if (data.length < 4 + 16 + 12 + 16 || data.subarray(0, 4).toString() !== magic) fail('This is not data locked with Trezyn.');
  try { return gcm(kdf(pw, data.subarray(4, 20), 32), data.subarray(20, 32), data.subarray(32)); }
  catch (e) { fail('Wrong password, or the data was changed.'); }
}
const safe = (n) => (n.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'file');
function save(dir, name, data) { fs.mkdirSync(dir, { recursive: true }); const p = path.join(dir, safe(name)); fs.writeFileSync(p, data); console.log('Saved', p); }

function parsePNG(raw) {
  if (raw.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail('This is not a PNG file.');
  let pos = 8, w, h, depth, type, inter; const idat = [];
  while (pos + 12 <= raw.length) {
    const len = raw.readUInt32BE(pos), name = raw.toString('latin1', pos + 4, pos + 8), body = raw.subarray(pos + 8, pos + 8 + len);
    if (name === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; type = body[9]; inter = body[12]; }
    else if (name === 'IDAT') idat.push(body); else if (name === 'IEND') break;
    pos += 12 + len;
  }
  if (!w) fail('Damaged PNG.');
  if (depth !== 8 || (type !== 2 && type !== 6) || inter !== 0) fail('Only plain 8-bit RGB or RGBA PNG files are supported (the files the Hide tool makes).');
  const ch = type === 6 ? 4 : 3, stride = w * ch, data = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = data[y * (stride + 1)], row = y * stride, prev = row - stride;
    for (let x = 0; x < stride; x++) {
      let v = data[y * (stride + 1) + 1 + x];
      const a = x >= ch ? px[row + x - ch] : 0, b = y ? px[prev + x] : 0, c = y && x >= ch ? px[prev + x - ch] : 0;
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (f !== 0) fail('Damaged PNG.');
      px[row + x] = v & 255;
    }
  }
  return { w, h, ch, px };
}
const mix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
function makePerm(n, keys) {
  let bits = 1; while ((1 << bits) < n) bits++; if (bits & 1) bits++;
  const half = bits >> 1, mask = (1 << half) - 1;
  return (i) => {
    let x = i;
    for (;;) {
      let l = x >>> half, r = x & mask;
      keys.forEach((key, k) => { const t = (l ^ (mix((r + Math.imul(k + 1, 0x9e3779b1)) ^ key) & mask)) & mask; l = r; r = t; });
      x = ((l << half) | r) >>> 0;
      if (x < n) return x;
    }
  };
}
const PUBLIC = [0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344, 0xa4093822, 0x299f31d0], HEADER = 28;
function reveal(raw, pw) {
  const { w, h, ch, px } = parsePNG(raw), n = w * h * 3, idx = (j) => Math.floor(j / 3) * ch + (j % 3);
  const pub = makePerm(n, PUBLIC), skip = new Set(); for (let i = 0; i < HEADER * 8; i++) skip.add(pub(i));
  const read = (next, count) => { const out = Buffer.alloc(count); for (let i = 0; i < count; i++) { let v = 0; for (let b = 0; b < 8; b++) v = (v << 1) | (px[idx(next())] & 1); out[i] = v; } return out; };
  let k = 0; const head = read(() => pub(k++), HEADER);
  const bits = kdf(pw, head.subarray(0, 16), 96), keys = []; for (let i = 0; i < 6; i++) keys.push(bits.readUInt32BE(32 + 4 * i));
  const perm = makePerm(n, keys); let k2 = 0;
  const body = () => { let j; do { j = perm(k2++); } while (skip.has(j)); return j; };
  const lb = read(body, 4); for (let i = 0; i < 4; i++) lb[i] ^= bits[56 + i];
  const len = lb.readUInt32BE(0);
  if (len < 19 || len * 8 > n * 0.5) fail('Nothing found. Wrong password, or the picture was changed.');
  let plain; try { plain = gcm(bits.subarray(0, 32), head.subarray(16, 28), read(body, len)); } catch (e) { fail('Nothing found. Wrong password, or the picture was changed.'); }
  const nl = (plain[1] << 8) | plain[2];
  return { kind: plain[0], name: plain.subarray(3, 3 + nl).toString('utf8'), data: plain.subarray(3 + nl) };
}
function ask() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes('Password')) rl.output.write(s); };
    rl.question('Password: ', (a) => { rl.close(); console.log(); resolve(a); });
  });
}
(async () => {
  const [, , cmd, src, outdir = '.'] = process.argv;
  if (!['text', 'file', 'image'].includes(cmd) || !src) fail(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace('#!/usr/bin/env node\n/*', ''));
  const pw = process.env.TREZYN_PASSWORD || await ask();
  if (cmd === 'text') {
    if (!src.trim().startsWith('tz1.')) fail('The text must start with "tz1.".');
    console.log(openSealed(Buffer.from(src.trim().slice(4), 'base64'), pw, 'TZT1').toString('utf8'));
  } else if (cmd === 'file') {
    const plain = openSealed(fs.readFileSync(src), pw, 'TZF1'), nl = (plain[0] << 8) | plain[1];
    save(outdir, plain.subarray(2, 2 + nl).toString('utf8'), plain.subarray(2 + nl));
  } else {
    const r = reveal(fs.readFileSync(src), pw);
    if (r.kind === 0) console.log(r.data.toString('utf8')); else save(outdir, r.name || 'hidden-file', r.data);
  }
})();
