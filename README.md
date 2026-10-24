# Trezyn

Free, open-source privacy tools that run entirely in your browser.  
No uploads. No tracking. Your files never leave your device.

**Live site:** [https://trezyn.site](https://trezyn.site)

I built this site for my own personal use.  
If you find it useful, feel free to use it too.

## Tools

- **QR code** — Generate QR codes with custom colors, or scan one from an image/camera and check the link before opening it
- **Image compressor** — Compress JPG, PNG and WebP images
- **Image converter** — Convert between PNG, JPG and WebP (with optional resizing)
- **Remove metadata** — View and remove hidden data (GPS, author, etc.) from photos, PDFs, Word, Excel and PowerPoint files
- **Images & PDF** — Convert images to PDF or extract PDF pages as images
- **PDF tools** — Merge, split, rotate, reorder, delete pages, or permanently redact content
- **Encrypt** — Password-protect text or files with AES-256 (runs fully in the browser)
- **Hide data** — Hide an encrypted message or file inside a PNG picture and read it back with the password
- **Password generator** — Create strong random passwords
- **Privacy check** — See what information your browser exposes to websites
- **Closed room** — Private browser-to-browser chat, separate site: [closedroom.site](https://closedroom.site/)
- **Direct share** — Send files directly from one browser to another, separate site: [directshare.site](https://directshare.site/)

Everything is processed locally in your browser. Nothing is uploaded to any server.

## Privacy

- No accounts
- No cookies for tracking
- No analytics
- Files and passwords never leave your device

You can verify this by opening the Network tab in your browser’s developer tools while using any tool.

## Not locked in

Everything Encrypt and Hide produce can be unlocked without this site. The exact formats are in [FORMAT.md](FORMAT.md); `tools/trezyn_tool.py` (Python, needs `cryptography`) and `tools/trezyn-tool.js` (Node.js, no packages) unlock text, `.tzenc` files and hidden PNGs with just the password.

## Credits

- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase (MIT)
- [pdf-lib](https://github.com/Hopding/pdf-lib) by Andrew Dillon (MIT)
- [PDF.js](https://github.com/mozilla/pdf.js) by Mozilla (Apache-2.0)
- [jsQR](https://github.com/cozmo/jsQR) by Cosmo Wolfe (Apache-2.0)
- [JSZip](https://github.com/Stuk/jszip) by Stuart Knightley (MIT)
- IBM Plex Sans & IBM Plex Mono fonts (SIL Open Font License 1.1)

## License

MIT
