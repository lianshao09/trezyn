/* Trezyn service worker. Saves this site's own files in the browser so it opens offline.
   It only handles files from this site and never touches anything you type or open. */
var CACHE = 'trezyn-6621cb9748';
var FILES = ["./", "./apple-touch-icon.png", "./assets/fflate.min.js", "./assets/fonts/OFL-LICENSE.txt", "./assets/fonts/ibm-plex-mono-latin-400-normal.woff2", "./assets/fonts/ibm-plex-mono-latin-500-normal.woff2", "./assets/fonts/ibm-plex-sans-latin-400-normal.woff2", "./assets/fonts/ibm-plex-sans-latin-500-normal.woff2", "./assets/fonts/ibm-plex-sans-latin-600-normal.woff2", "./assets/fonts/ibm-plex-sans-latin-700-normal.woff2", "./assets/icon-192.png", "./assets/icon-512.png", "./assets/icon-maskable-512.png", "./assets/jsqr.js", "./assets/jszip.min.js", "./assets/logo.svg", "./assets/og.png", "./assets/pdf-lib.min.js", "./assets/pdf.min.js", "./assets/pdf.worker.min.js", "./assets/pdfjs/LICENSE.txt", "./assets/pdfjs/iccs/CGATS001Compat-v2-micro.icc", "./assets/pdfjs/iccs/LICENSE", "./assets/pdfjs/pdf.min.js", "./assets/pdfjs/pdf.worker.min.js", "./assets/pdfjs/standard_fonts/FoxitDingbats.pfb", "./assets/pdfjs/standard_fonts/FoxitFixed.pfb", "./assets/pdfjs/standard_fonts/FoxitFixedBold.pfb", "./assets/pdfjs/standard_fonts/FoxitFixedBoldItalic.pfb", "./assets/pdfjs/standard_fonts/FoxitFixedItalic.pfb", "./assets/pdfjs/standard_fonts/FoxitSerif.pfb", "./assets/pdfjs/standard_fonts/FoxitSerifBold.pfb", "./assets/pdfjs/standard_fonts/FoxitSerifBoldItalic.pfb", "./assets/pdfjs/standard_fonts/FoxitSerifItalic.pfb", "./assets/pdfjs/standard_fonts/FoxitSymbol.pfb", "./assets/pdfjs/standard_fonts/LICENSE_FOXIT", "./assets/pdfjs/standard_fonts/LICENSE_LIBERATION", "./assets/pdfjs/standard_fonts/LiberationSans-Bold.ttf", "./assets/pdfjs/standard_fonts/LiberationSans-BoldItalic.ttf", "./assets/pdfjs/standard_fonts/LiberationSans-Italic.ttf", "./assets/pdfjs/standard_fonts/LiberationSans-Regular.ttf", "./assets/pdfjs/wasm/jbig2.wasm", "./assets/pdfjs/wasm/jbig2_nowasm_fallback.js", "./assets/pdfjs/wasm/openjpeg.wasm", "./assets/pdfjs/wasm/openjpeg_nowasm_fallback.js", "./assets/pdfjs/wasm/qcms_bg.wasm", "./assets/qrcode.js", "./assets/stego.js", "./assets/style.css", "./assets/theme.js", "./closed-room.html", "./compress.html", "./convert.html", "./direct-share.html", "./encrypt.html", "./favicon.ico", "./guide-check-qr-code-is-safe.html", "./guide-compress-images-without-losing-quality.html", "./guide-encrypt-a-file-with-a-password.html", "./guide-hide-a-message-in-a-picture.html", "./guide-how-to-make-a-strong-password.html", "./guide-merge-and-split-pdf-files.html", "./guide-redact-pdf-permanently.html", "./guide-remove-location-from-photo.html", "./guide-remove-metadata-from-pdf.html", "./guide-remove-metadata-from-word-excel-powerpoint.html", "./guides.html", "./images-pdf.html", "./index.html", "./manifest.webmanifest", "./password.html", "./pdf-tools.html", "./privacy-check.html", "./privacy.html", "./qr.html", "./remove-metadata.html", "./stego.html"];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('trezyn-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (r.headers.has('range')) return;
  var isPage = r.mode === 'navigate' || (r.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (isPage) {
    /* Pages: try the network first so updates show up, fall back to the saved copy. */
    e.respondWith(fetch(r).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match('./index.html'); });
    }));
  } else {
    /* Other files: saved copy first, then the network. */
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(function (m) {
      return m || fetch(r).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, copy); }); }
        return res;
      });
    }));
  }
});
