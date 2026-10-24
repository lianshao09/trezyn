/* Trezyn image hiding: puts an encrypted message into the least significant bits of a PNG.
   Everything runs in the browser. The PNG is read and written by this code directly, not through
   a canvas, because some browsers add noise to canvas pixels and that would destroy hidden data. */
(function (root) {
  'use strict';
  var ITER = 600000, HEADER = 28, MAXD = 0.5, REC = 0.1;
  var enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });

  /* ---------- PNG ---------- */
  var CRC = (function () {
    var t = new Uint32Array(256), c, n, k;
    for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8, start, end) {
    var c = 0xffffffff;
    for (var i = start; i < end; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function u32(u8, o) { return ((u8[o] << 24) | (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3]) >>> 0; }
  function put32(u8, o, v) { u8[o] = v >>> 24; u8[o + 1] = v >>> 16; u8[o + 2] = v >>> 8; u8[o + 3] = v; }
  async function streamBytes(input, Ctor, format) {
    var s = new Blob([input]).stream().pipeThrough(new Ctor(format));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  function paeth(a, b, c) {
    var p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  }
  async function parsePNG(u8) {
    var sig = [137, 80, 78, 71, 13, 10, 26, 10], i;
    if (u8.length < 33) throw new Error('png');
    for (i = 0; i < 8; i++) if (u8[i] !== sig[i]) throw new Error('png');
    var pos = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0, idat = [], sawEnd = false;
    while (pos + 12 <= u8.length) {
      var len = u32(u8, pos), name = String.fromCharCode(u8[pos + 4], u8[pos + 5], u8[pos + 6], u8[pos + 7]);
      if (pos + 12 + len > u8.length) throw new Error('png');
      if (name === 'IHDR') { w = u32(u8, pos + 8); h = u32(u8, pos + 12); depth = u8[pos + 16]; type = u8[pos + 17]; inter = u8[pos + 20]; }
      else if (name === 'IDAT') idat.push(u8.subarray(pos + 8, pos + 8 + len));
      else if (name === 'IEND') { sawEnd = true; break; }
      pos += 12 + len;
    }
    if (!sawEnd || !w || !h) throw new Error('png');
    if (depth !== 8 || (type !== 2 && type !== 6) || inter !== 0) throw new Error('unsupported');
    if (w * h > 40000000) throw new Error('large');
    var total = 0; idat.forEach(function (c) { total += c.length; });
    var z = new Uint8Array(total), o = 0; idat.forEach(function (c) { z.set(c, o); o += c.length; });
    var raw = await streamBytes(z, DecompressionStream, 'deflate');
    var ch = type === 6 ? 4 : 3, stride = w * ch;
    if (raw.length < (stride + 1) * h) throw new Error('png');
    var px = new Uint8Array(stride * h), y, x, f, a, b, c, v, row, prev;
    for (y = 0; y < h; y++) {
      f = raw[y * (stride + 1)]; row = y * stride; prev = row - stride;
      for (x = 0; x < stride; x++) {
        v = raw[y * (stride + 1) + 1 + x];
        a = x >= ch ? px[row + x - ch] : 0;
        b = y > 0 ? px[prev + x] : 0;
        c = y > 0 && x >= ch ? px[prev + x - ch] : 0;
        if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) v += paeth(a, b, c);
        else if (f !== 0) throw new Error('png');
        px[row + x] = v & 255;
      }
    }
    return { w: w, h: h, ch: ch, px: px };
  }
  async function encodePNG(img) {
    var w = img.w, h = img.h, ch = img.ch, stride = w * ch, raw = new Uint8Array((stride + 1) * h), y;
    for (y = 0; y < h; y++) raw.set(img.px.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
    var z = await streamBytes(raw, CompressionStream, 'deflate');
    var out = new Uint8Array(8 + 25 + 12 + z.length + 12), o = 0;
    out.set([137, 80, 78, 71, 13, 10, 26, 10], 0); o = 8;
    function chunk(name, data) {
      put32(out, o, data.length);
      for (var i = 0; i < 4; i++) out[o + 4 + i] = name.charCodeAt(i);
      out.set(data, o + 8);
      put32(out, o + 8 + data.length, crc32(out, o + 4, o + 8 + data.length));
      o += 12 + data.length;
    }
    var ihdr = new Uint8Array(13); put32(ihdr, 0, w); put32(ihdr, 4, h); ihdr[8] = 8; ihdr[9] = ch === 4 ? 6 : 2;
    chunk('IHDR', ihdr); chunk('IDAT', z); chunk('IEND', new Uint8Array(0));
    return out.subarray(0, o);
  }

  /* ---------- key and positions ---------- */
  function mix(h) {
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0;
  }
  /* A keyed permutation of 0..n-1 without storing a table (Feistel network with cycle walking). */
  function makePerm(n, keys) {
    var bits = 1; while ((1 << bits) < n) bits++;
    if (bits & 1) bits++;
    var half = bits >> 1, mask = (1 << half) - 1;
    return function (i) {
      var x = i, l, r, t, k;
      do {
        l = x >>> half; r = x & mask;
        for (k = 0; k < keys.length; k++) { t = (l ^ (mix((r + Math.imul(k + 1, 0x9e3779b1)) ^ keys[k]) & mask)) & mask; l = r; r = t; }
        x = ((l << half) | r) >>> 0;
      } while (x >= n);
      return x;
    };
  }
  var PUBLIC_KEYS = [0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344, 0xa4093822, 0x299f31d0];
  async function derive(password, salt) {
    var base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
    var bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: ITER, hash: 'SHA-256' }, base, 768));
    var aes = await crypto.subtle.importKey('raw', bits.subarray(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
    var keys = [], i; for (i = 0; i < 6; i++) keys.push(u32(bits, 32 + i * 4));
    return { aes: aes, keys: keys, mask: bits.subarray(56, 60) };
  }

  /* ---------- bit access (RGB channels only, one bit per channel) ---------- */
  function chIndex(img, j) { var p = (j / 3) | 0; return p * img.ch + (j - p * 3); }
  function channels(img) { return img.w * img.h * 3; }
  function Stream(img, perm, skip) { this.img = img; this.perm = perm; this.skip = skip; this.k = 0; }
  Stream.prototype.next = function () {
    var j;
    do { j = this.perm(this.k++); } while (this.skip && this.skip.has(j));
    return chIndex(this.img, j);
  };
  Stream.prototype.write = function (bytes) {
    var px = this.img.px, i, b, bit, idx;
    for (i = 0; i < bytes.length; i++) for (b = 7; b >= 0; b--) { idx = this.next(); px[idx] = (px[idx] & 254) | ((bytes[i] >> b) & 1); }
  };
  Stream.prototype.read = function (n) {
    var px = this.img.px, out = new Uint8Array(n), i, b, v;
    for (i = 0; i < n; i++) { v = 0; for (b = 0; b < 8; b++) v = (v << 1) | (px[this.next()] & 1); out[i] = v; }
    return out;
  };
  function headerStreams(img) {
    var n = channels(img), pub = makePerm(n, PUBLIC_KEYS), skip = new Set(), i;
    for (i = 0; i < HEADER * 8; i++) skip.add(pub(i));
    return { pub: pub, skip: skip };
  }
  function overhead(nameBytes) { return 1 + 2 + nameBytes + 16; }
  function capacity(img) {
    var bits = channels(img);
    return {
      max: Math.max(0, Math.floor((bits * MAXD - HEADER * 8 - 32) / 8)),
      rec: Math.max(0, Math.floor((bits * REC - HEADER * 8 - 32) / 8))
    };
  }
  function concat(parts) {
    var t = 0, i; for (i = 0; i < parts.length; i++) t += parts[i].length;
    var out = new Uint8Array(t), o = 0; for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }
  function randomBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }

  /* kind: 0 text, 1 file */
  async function hide(img, kind, name, data, password) {
    var nm = enc.encode(name || '');
    if (nm.length > 65535) throw new Error('name');
    var cap = capacity(img);
    if (data.length + nm.length + overhead(0) - 16 + 16 > cap.max) throw new Error('capacity');
    var salt = randomBytes(16), iv = randomBytes(12), k = await derive(password, salt);
    var plain = concat([new Uint8Array([kind, nm.length >> 8, nm.length & 255]), nm, data]);
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k.aes, plain));
    var hs = headerStreams(img);
    var out = { w: img.w, h: img.h, ch: img.ch, px: new Uint8Array(img.px) };
    new Stream(out, hs.pub, null).write(concat([salt, iv]));
    var lenBytes = new Uint8Array(4); put32(lenBytes, 0, ct.length);
    for (var i = 0; i < 4; i++) lenBytes[i] ^= k.mask[i];
    var body = new Stream(out, makePerm(channels(img), k.keys), hs.skip);
    body.write(lenBytes); body.write(ct);
    return out;
  }
  async function reveal(img, password) {
    var n = channels(img);
    if (n < (HEADER + 8) * 8 * 2) throw new Error('none');
    var hs = headerStreams(img), head = new Stream(img, hs.pub, null).read(HEADER);
    var salt = head.subarray(0, 16), iv = head.subarray(16, 28), k = await derive(password, salt);
    var body = new Stream(img, makePerm(n, k.keys), hs.skip), lb = body.read(4), i;
    for (i = 0; i < 4; i++) lb[i] ^= k.mask[i];
    var len = u32(lb, 0);
    if (len < 16 + 3 || len * 8 > n * MAXD) throw new Error('none');
    var ct = body.read(len), plain;
    try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, k.aes, ct)); }
    catch (e) { throw new Error('none'); }
    var nl = (plain[1] << 8) | plain[2];
    if (3 + nl > plain.length) throw new Error('none');
    var name = ''; try { name = dec.decode(plain.subarray(3, 3 + nl)); } catch (e2) { name = ''; }
    return { kind: plain[0], name: name, data: plain.subarray(3 + nl) };
  }

  var api = { parsePNG: parsePNG, encodePNG: encodePNG, hide: hide, reveal: reveal, capacity: capacity, overhead: overhead };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TZStego = api;
})(typeof self !== 'undefined' ? self : this);
