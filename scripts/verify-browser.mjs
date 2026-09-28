import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { isAbsolute, relative, resolve, extname } from 'node:path';
import { packageRoot } from './catalog-plugin.mjs';

// Optional real-browser smoke checks, using installed Chromium and native CDP.
// No browser dependencies or downloads, and all browser artifacts stay in this package.
const executable = process.env.CATALOG_BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!executable) throw new Error('Definí CATALOG_BROWSER_PATH con un Chromium instalado.');
const directory = resolve(packageRoot, 'dist-demo');
const artifacts = resolve(packageRoot, '.browser-check');
await mkdir(artifacts, { recursive: true });
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/negocio\//, '');
  const file = resolve(directory, path || 'index.html');
  const local = relative(directory, file);
  if (local.startsWith('..') || isAbsolute(local)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser, socket;
try {
  browser = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${resolve(artifacts, 'profile')}`], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chromium no inició CDP.')), 15000);
    let output = '';
    browser.stderr.on('data', (chunk) => {
      output += chunk;
      const found = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (found) { clearTimeout(timer); resolve(found[1]); }
    });
    browser.on('error', (error) => { clearTimeout(timer); reject(error); });
    browser.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Chromium terminó: ${code}`)); });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let counter = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const job = pending.get(message.id);
    if (!job) return;
    pending.delete(message.id);
    clearTimeout(job.timer);
    message.error ? job.reject(new Error(message.error.message)) : job.resolve(message.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++counter;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const cdp = (method, params) => send(method, params, sessionId);
  const evaluate = async (expression) => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression) => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Browser condition failed: ${expression}; page=${JSON.stringify(await evaluate('({body:document.body.innerText.slice(0,600),requests:window.__requests,active:document.activeElement.outerHTML.slice(0,300),focused:document.hasFocus(),dialog:document.querySelector("dialog")?.outerHTML.slice(0,500)})'))}`);
  };
  const key = async (key, code, windowsVirtualKeyCode) => {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
  };
  await cdp('Page.enable');
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Network.enable');
  await cdp('Network.setBlockedURLs', { urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*'] });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__requests = 0; window.__fail = false; window.__offset = 0;
    const now = Date.now.bind(Date); Date.now = () => now() + window.__offset;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (url, options) => {
      if (String(url).includes('/public/catalog')) {
        window.__requests++;
        if (window.__fail) throw new TypeError('Simulated network failure');
        return new Response(JSON.stringify({currency:'CUP',products:[
          {id:'usd',name:'Producto USD',salePrice:'10',priceCurrency:'USD',categories:['Prueba'],imageUrl:'/imagen-inexistente.jpg',galleryImages:['/otra-imagen-inexistente.jpg']},
          {id:'volume',name:'Oferta por cantidad',salePrice:'100',effectivePrice:'100',onOffer:true,offerFixedPrice:'80',offerMinQuantity:'3',categories:['Prueba']}
        ]}));
      }
      return originalFetch(url, options);
    };` });
  for (const width of [320, 360, 364]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: true });
    await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/negocio/` });
    await until(`document.querySelector('#producto-usd .bk-card-action')`);
    await evaluate(`document.querySelector('#producto-usd').scrollIntoView({behavior:'instant'})`);
    await until(`document.querySelector('#producto-usd .bk-product-placeholder')`);
    const layout = await evaluate(`({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,meta:document.querySelector('meta[name="viewport"]').content,wide:Array.from(document.querySelectorAll('body *')).filter(x=>x.getBoundingClientRect().right>${width}+1).slice(0,35).map(x=>({tag:x.tagName,class:x.className,width:x.getBoundingClientRect().width,right:x.getBoundingClientRect().right,html:x.outerHTML.slice(0,90)}))})`);
    assert.ok(layout.scroll <= width, `page overflow at ${width}: ${JSON.stringify(layout)}`);
    assert.equal(await evaluate(`Array.from(document.querySelector('#inicio > div:last-child').children).every(x => x.getBoundingClientRect().right <= innerWidth + 1)`), true, `hero overflow at ${width}`);
    await evaluate(`document.querySelector('#producto-usd .bk-card-action').focus()`);
    assert.equal(await evaluate(`document.activeElement.matches('#producto-usd .bk-card-action')`), true);
    await key('Enter', 'Enter', 13);
    await until(`document.querySelector('dialog[open] .bk-product-placeholder')`);
    const modalBounds = await evaluate(`(() => { const r=document.querySelector('dialog').getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width,viewport:innerWidth}; })()`);
    assert.ok(modalBounds.left >= 0 && modalBounds.right <= width + 1, `dialog overflow at ${width}: ${JSON.stringify(modalBounds)}`);
    assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), 'Cerrar detalle');
    assert.equal(await evaluate(`(() => { const box=document.querySelector('dialog').getBoundingClientRect(); return Array.from(document.querySelector('.bk-modal-grid').children).every(x => { const r=x.getBoundingClientRect(); return r.left>=box.left-1 && r.right<=box.right+1; }); })()`), true, `modal overflow at ${width}`);
    await evaluate(`document.querySelector('button[aria-label="Foto siguiente"]').click()`);
    await until(`document.querySelector('dialog[open] .bk-product-placeholder') && document.querySelector('button[aria-label="Foto siguiente"]').disabled`);
    for (let i = 0; i < 12; i++) {
      await key('Tab', 'Tab', 9);
      assert.equal(await evaluate(`document.querySelector('dialog').contains(document.activeElement)`), true, 'modal focus trap');
    }
    if (width === 320) {
      const screenshot = await cdp('Page.captureScreenshot', { format: 'png' });
      await writeFile(resolve(artifacts, 'mobile-320.png'), Buffer.from(screenshot.data, 'base64'));
    }
    await key('Escape', 'Escape', 27);
    await until(`!document.querySelector('dialog[open]')`);
    assert.equal(await evaluate(`document.activeElement.matches('#producto-usd .bk-card-action')`), true, 'restore focus');
  }
  assert.equal(await evaluate('window.__requests'), 1);
  await evaluate(`window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'));`);
  assert.equal(await evaluate('window.__requests'), 1, 'fresh data must not refetch');
  await evaluate(`window.__offset=6*60*1000; window.__fail=true; window.dispatchEvent(new Event('focus'));`);
  await until(`document.querySelector('[role="alert"]')`);
  assert.equal(await evaluate(`document.querySelector('#producto-usd') !== null`), true, 'failed refresh retains catalog');
  await evaluate(`window.__fail=false; document.querySelector('[role="alert"] button').click()`);
  await until(`!document.querySelector('[role="alert"]') && window.__requests===3`);
  console.log('[verify:browser] OK: 320/360/364 px, image/gallery fallback, Enter/Tab/Escape, focus restore, fresh-data throttling and recovery after refresh failure.');
  await send('Browser.close');
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) browser.kill();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
