# Trezyn

Free, open-source privacy tools that run entirely in your browser.  
No uploads. No tracking. Your files never leave your device.

**Live:** [https://trezyn.site](https://trezyn.site)

A site with nine tools:

- `qr.html`: two tabs: QR code generator (colors, size, error correction, PNG download) and QR reader (picture, paste or camera, with link safety checks).
- `compress.html`: image compressor for JPG, PNG and WebP.
- `convert.html`: image converter between PNG, JPG and WebP, with optional resizing.
- `images-pdf.html`: two tabs, images to PDF and PDF to images.
- `pdf-tools.html`: four tabs: merge, split, organize (rotate, reorder, delete pages) and redact (cover parts with black boxes).
- `remove-metadata.html`: three tabs, remove hidden data from photos (EXIF, GPS), PDFs (author, software, dates) and Word, Excel and PowerPoint files.
- `encrypt.html`: locks and unlocks text and files with a password (AES-256-GCM). Needs https to work, because browsers only allow encryption on secure pages.
- `privacy-check.html`: shows what a website can read from the visitor's browser. The optional network check contacts api.ipify.org and a Google STUN server only when the visitor presses the button.
- `password.html`: random password generator.

Everything runs in the visitor's browser, so the site is fully static. It works on any hosting, including the Papaki 1.0 free plan. Files and passwords never leave the visitor's device. No PHP or database is needed.

## Google (domain already set to trezyn.site)

1. Open Google Search Console and add trezyn.site.
2. Submit https://trezyn.site/sitemap.xml.

## Upload

1. At Papaki: pick the domain, click **Shared Hosting – Learn more**, then click **FREE** under **Free Hosting**.
2. Connect the domain to the hosting (Domain association → Associations → Associate a domain name).
3. Upload **everything in this folder** to the site folder (usually `public_html`) with File Manager or FTP. `.htaccess` is a hidden file, make sure it uploads too.
4. Open your domain.

## Renaming

The word "Trezyn" appears in the header, the title and the footer of every page. Replace it with your own name.

## Logo and favicon

The logo is `assets/logo.webp`. The browser tab icon is `favicon.ico` (16, 32 and 48 px), `assets/icon-192.png` and `apple-touch-icon.png` (for iPhone and iPad home screens). To change them, replace those files with the same names and sizes.

## Credits

- `assets/qrcode.js`: qrcode-generator by Kazuhiko Arase (MIT license).
- `assets/pdf-lib.min.js`: pdf-lib by Andrew Dillon (MIT license).
- `assets/pdf.min.js` and `assets/pdf.worker.min.js`: PDF.js by Mozilla (Apache-2.0 license).
- `assets/jsqr.js`: jsQR by Cosmo Wolfe (Apache-2.0 license).
- `assets/jszip.min.js`: JSZip by Stuart Knightley (MIT license).

Note: opening the pages straight from your disk (file://) may block PDF.js. On the hosting it works normally.

## HTTPS

Turn on the free SSL certificate for your domain in the Papaki panel. Browsers only allow encryption (the Encrypt tool) on https pages, and https also helps with Google.

## Fonts, guides and settings

- `assets/fonts/`: IBM Plex Sans and IBM Plex Mono, SIL Open Font License 1.1 (license file included). Hosted here, so no request goes to Google.
- `privacy.html` explains how the site works and how to check it. `guides.html` and `guide-*.html` are the written guides.
- `assets/theme.js` stores the theme choice and the last settings of dropdowns, sliders and tick boxes in the visitor's local storage. Text, passwords and files are never stored.
- `.htaccess` sets a Content-Security-Policy. If a page stops working on your host after upload, check the browser console for "Refused to..." messages.
