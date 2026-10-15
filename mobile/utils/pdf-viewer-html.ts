// The page the in-app PDF viewer runs in a WebView: pdf.js (bundled, so it
// works offline) draws each page onto a canvas. No text layer, no links, no
// download or print: just pages. The app sends the PDF in base64 chunks with
// window.__add(...) and then window.__open(); the page reports back with
// postMessage: {type:'ready'|'pages'|'page'|'error'}.
import { PDFJS_LIB, PDFJS_WORKER } from './pdfjs-source';

/** A JS string literal that is safe inside an HTML <script>. */
const literal = (text: string) => JSON.stringify(text).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');

const VIEWER = `
var chunks = [];
function post(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
window.__add = function (c) { chunks.push(c); };
window.__open = function () {
  try {
    var parts = chunks.map(function (c) { var s = atob(c), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; });
    chunks = [];
    var total = parts.reduce(function (n, p) { return n + p.length; }, 0), data = new Uint8Array(total), at = 0;
    parts.forEach(function (p) { data.set(p, at); at += p.length; });
    pdfjsLib.getDocument({ data: data }).promise.then(show, function () { post({ type: 'error', message: 'This file could not be opened.' }); });
  } catch (e) { post({ type: 'error', message: 'This file could not be opened.' }); }
};
function show(doc) {
  post({ type: 'pages', count: doc.numPages });
  var root = document.getElementById('pages'), width = Math.max(200, window.innerWidth - 16), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var box = e.target, n = Number(box.dataset.page);
      if (box.dataset.state) { post({ type: 'page', page: n }); return; }
      box.dataset.state = 'drawing';
      doc.getPage(n).then(function (page) {
        var base = page.getViewport({ scale: 1 }), viewport = page.getViewport({ scale: width / base.width });
        var canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width * dpr); canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = Math.floor(viewport.width) + 'px'; canvas.style.height = Math.floor(viewport.height) + 'px';
        box.style.height = 'auto'; box.appendChild(canvas);
        return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport, transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0] }).promise;
      }).catch(function () {});
    });
  }, { rootMargin: '1200px 0px' });
  for (var i = 1; i <= doc.numPages; i++) {
    var box = document.createElement('div');
    box.className = 'page'; box.dataset.page = String(i);
    box.style.width = width + 'px'; box.style.height = Math.round(width * 1.414) + 'px';
    root.appendChild(box); observer.observe(box);
  }
  var pageObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) post({ type: 'page', page: Number(e.target.dataset.page) }); });
  }, { threshold: 0.5 });
  root.querySelectorAll('.page').forEach(function (b) { pageObserver.observe(b); });
}
document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([PDFJS_WORKER_SOURCE], { type: 'text/javascript' }));
post({ type: 'ready' });
`;

let html: string | null = null;
export function pdfViewerHtml() {
  html ??= `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=4, user-scalable=yes">
<style>
html, body { margin: 0; background: #3f3f46; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
#pages { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 8px 0 24px; }
.page { background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35); }
canvas { display: block; }
</style>
<script>${PDFJS_LIB.replace(/<\/script/gi, '<\\/script')}</script>
</head><body><div id="pages"></div>
<script>var PDFJS_WORKER_SOURCE = ${literal(PDFJS_WORKER)};${VIEWER}</script>
</body></html>`;
  return html;
}

/** Split base64 into pieces small enough to send into the WebView. */
export function base64Chunks(base64: string, size = 512 * 1024) {
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += size) chunks.push(base64.slice(i, i + size));
  return chunks;
}
