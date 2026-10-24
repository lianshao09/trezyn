# Trezyn file formats

Nothing Trezyn locks depends on Trezyn. With the password and this document, anyone can unlock the data with any software. Ready-made, dependency-light decoders are in `tools/` (`trezyn_tool.py`, `trezyn-tool.js`) and are tested against the website's output.

## Common key derivation
- Password: Unicode NFKC normalised, then UTF-8 bytes.
- PBKDF2-HMAC-SHA256, **600,000** iterations, 16-byte random salt.
- Cipher: AES-256-GCM, 12-byte IV, 16-byte tag appended to the ciphertext, no additional data.

## 1. Encrypt: text (`tz1.…`)
`"tz1." + base64( "TZT1" | salt[16] | iv[12] | ciphertext+tag )`
- key = PBKDF2(password, salt) → 32 bytes. Plaintext = UTF-8 text.

## 2. Encrypt: files (`.tzenc`)
`"TZF1" | salt[16] | iv[12] | ciphertext+tag`
- key as above. Plaintext = `nameLen` (uint16 big-endian) | name (UTF-8) | file bytes.

## 3. Hide in image (PNG)
Carrier: PNG, 8-bit RGB (type 2) or RGBA (type 6), not interlaced. Output has only IHDR, IDAT, IEND (filter 0). Alpha is never touched.

**Bit positions.** Take only the R, G, B bytes, in order: channel index `j` (0 … N−1, N = width·height·3) is pixel `j div 3`, colour `j mod 3`. Each stores one bit in its least significant bit. Bytes are written most significant bit first.

**Permutation `perm(keys, N)`** (keyed shuffle of 0…N−1, Feistel with cycle walking):
- bits = smallest even number ≥ log2(N) (start at 1, increase while 2^bits < N, then add 1 if odd); half = bits/2; mask = 2^half − 1.
- For index i: x = i; repeat { l = x >> half; r = x & mask; for k = 0…5: t = (l XOR (mix((r + imul32(k+1, 0x9e3779b1)) XOR keys[k]) & mask)) & mask; l = r; r = t; x = (l << half) | r } until x < N. Return x. All arithmetic is unsigned 32-bit.
- `mix(h)`: h ^= h>>16; h *= 0x85ebca6b; h ^= h>>13; h *= 0xc2b2ae35; h ^= h>>16 (32-bit).

**Header (28 bytes = salt[16] | iv[12])**, stored at positions `perm(PUBLIC, N)(0 … 223)`, in order. PUBLIC keys = `0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344, 0xa4093822, 0x299f31d0`.

**Keys.** `D = PBKDF2(password, salt) → 96 bytes`. AES key = D[0:32]; six round keys = D[32:56] as big-endian uint32; length mask = D[56:60].

**Body.** Positions `perm(roundKeys, N)(0, 1, 2 …)` skipping any position used by the header. Read 4 bytes: big-endian length L XOR length mask. Then L bytes of AES-256-GCM ciphertext+tag (key D[0:32], IV from header). Valid only if 19 ≤ L and 8·L ≤ N/2.

**Plaintext.** kind (0 = text, 1 = file) | nameLen (uint16 BE) | name (UTF-8) | data (text is UTF-8).

There is no marker: a wrong password and a picture with nothing hidden look identical by design.

## License
MIT, like the rest of the project.
