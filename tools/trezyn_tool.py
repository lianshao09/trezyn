#!/usr/bin/env python3
"""Trezyn standalone tool: unlock what Trezyn locked, without the website.

Needs Python 3.8+ and the 'cryptography' package:  pip install cryptography

  python3 trezyn_tool.py text  "tz1.AbCd..."          unlock text from the Encrypt tool
  python3 trezyn_tool.py file  secret.pdf.tzenc [dir]  unlock a file from the Encrypt tool
  python3 trezyn_tool.py image hidden.png [dir]        read a message or file hidden by the Hide tool

It asks for the password without showing it. The exact formats are in FORMAT.md.
"""
import base64, getpass, hashlib, os, struct, sys, unicodedata, zlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ITER = 600000
M32 = 0xFFFFFFFF


def kdf(password, salt, nbytes):
    return hashlib.pbkdf2_hmac('sha256', unicodedata.normalize('NFKC', password).encode('utf-8'), salt, ITER, nbytes)


def open_sealed(data, password, magic):
    if len(data) < 4 + 16 + 12 + 16 or data[:4] != magic:
        sys.exit('This is not data locked with Trezyn.')
    salt, iv, ct = data[4:20], data[20:32], data[32:]
    try:
        return AESGCM(kdf(password, salt, 32)).decrypt(iv, ct, None)
    except Exception:
        sys.exit('Wrong password, or the data was changed.')


def safe_name(n):
    bad = '\\/:*?"<>|' + ''.join(chr(i) for i in range(32))
    n = ''.join('_' if c in bad else c for c in n).strip()
    return n or 'file'


def save(outdir, name, data):
    os.makedirs(outdir, exist_ok=True)
    path = os.path.join(outdir, safe_name(name))
    with open(path, 'wb') as f:
        f.write(data)
    print('Saved', path)


# ---------- PNG (8-bit RGB or RGBA, not interlaced) ----------
def parse_png(raw):
    if raw[:8] != b'\x89PNG\r\n\x1a\n':
        sys.exit('This is not a PNG file.')
    pos, idat, hdr = 8, [], None
    while pos + 12 <= len(raw):
        ln = struct.unpack('>I', raw[pos:pos + 4])[0]
        name = raw[pos + 4:pos + 8]
        body = raw[pos + 8:pos + 8 + ln]
        if name == b'IHDR':
            hdr = struct.unpack('>IIBBBBB', body)
        elif name == b'IDAT':
            idat.append(body)
        elif name == b'IEND':
            break
        pos += 12 + ln
    if not hdr:
        sys.exit('Damaged PNG.')
    w, h, depth, ctype, _, _, inter = hdr
    if depth != 8 or ctype not in (2, 6) or inter != 0:
        sys.exit('Only plain 8-bit RGB or RGBA PNG files are supported (the files the Hide tool makes).')
    ch = 4 if ctype == 6 else 3
    data = zlib.decompress(b''.join(idat))
    stride = w * ch
    out = bytearray(stride * h)
    for y in range(h):
        f = data[y * (stride + 1)]
        line = bytearray(data[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        prev = out[(y - 1) * stride:y * stride] if y else bytearray(stride)
        if f == 1:
            for x in range(ch, stride):
                line[x] = (line[x] + line[x - ch]) & 255
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x - ch] if x >= ch else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - ch] if x >= ch else 0
                b = prev[x]
                c = prev[x - ch] if x >= ch else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        elif f != 0:
            sys.exit('Damaged PNG.')
        out[y * stride:(y + 1) * stride] = line
    return w, h, ch, out


# ---------- keyed permutation (Feistel with cycle walking) ----------
def mix(h):
    h &= M32
    h ^= h >> 16
    h = (h * 0x85EBCA6B) & M32
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & M32
    h ^= h >> 16
    return h


def make_perm(n, keys):
    bits = 1
    while (1 << bits) < n:
        bits += 1
    if bits & 1:
        bits += 1
    half = bits >> 1
    mask = (1 << half) - 1

    def perm(i):
        x = i
        while True:
            l, r = x >> half, x & mask
            for k, key in enumerate(keys):
                t = (l ^ (mix(((r + (((k + 1) * 0x9E3779B1) & M32)) & M32) ^ key) & mask)) & mask
                l, r = r, t
            x = ((l << half) | r) & M32
            if x < n:
                return x
    return perm


PUBLIC_KEYS = [0x243F6A88, 0x85A308D3, 0x13198A2E, 0x03707344, 0xA4093822, 0x299F31D0]
HEADER = 28


def reveal(raw_png, password):
    w, h, ch, px = parse_png(raw_png)
    n = w * h * 3
    ch_index = lambda j: (j // 3) * ch + (j % 3)
    pub = make_perm(n, PUBLIC_KEYS)
    skip = {pub(i) for i in range(HEADER * 8)}

    def read(stream, count):
        out = bytearray()
        for _ in range(count):
            v = 0
            for _ in range(8):
                v = (v << 1) | (px[ch_index(stream())] & 1)
            out.append(v)
        return bytes(out)

    k = [0]
    def pub_stream():
        j = pub(k[0]); k[0] += 1; return j
    head = read(pub_stream, HEADER)
    salt, iv = head[:16], head[16:28]
    bits = kdf(password, salt, 96)
    keys = [struct.unpack('>I', bits[32 + 4 * i:36 + 4 * i])[0] for i in range(6)]
    perm = make_perm(n, keys)
    k2 = [0]
    def body_stream():
        while True:
            j = perm(k2[0]); k2[0] += 1
            if j not in skip:
                return j
    lb = bytes(a ^ b for a, b in zip(read(body_stream, 4), bits[56:60]))
    ln = struct.unpack('>I', lb)[0]
    if ln < 19 or ln * 8 > n * 0.5:
        sys.exit('Nothing found. Wrong password, or the picture was changed.')
    ct = read(body_stream, ln)
    try:
        plain = AESGCM(bits[:32]).decrypt(iv, ct, None)
    except Exception:
        sys.exit('Nothing found. Wrong password, or the picture was changed.')
    nl = (plain[1] << 8) | plain[2]
    return plain[0], plain[3:3 + nl].decode('utf-8', 'replace'), plain[3 + nl:]


def ask():
    return getpass.getpass('Password: ')


def main(argv):
    if len(argv) < 3 or argv[1] not in ('text', 'file', 'image'):
        sys.exit(__doc__)
    cmd, src = argv[1], argv[2]
    outdir = argv[3] if len(argv) > 3 else '.'
    if cmd == 'text':
        s = src.strip()
        if not s.startswith('tz1.'):
            sys.exit('The text must start with "tz1.".')
        plain = open_sealed(base64.b64decode(s[4:]), ask(), b'TZT1')
        print(plain.decode('utf-8'))
    elif cmd == 'file':
        plain = open_sealed(open(src, 'rb').read(), ask(), b'TZF1')
        nl = (plain[0] << 8) | plain[1]
        save(outdir, plain[2:2 + nl].decode('utf-8', 'replace'), plain[2 + nl:])
    else:
        kind, name, data = reveal(open(src, 'rb').read(), ask())
        if kind == 0:
            print(data.decode('utf-8'))
        else:
            save(outdir, name or 'hidden-file', data)


if __name__ == '__main__':
    main(sys.argv)
