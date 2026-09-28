import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { packageRoot } from './catalog-plugin.mjs';
import { openBrowser } from './browser-session.mjs';
import { inspectPng } from './png-inspect.mjs';

for (const [outDir, base, name] of [['dist', '/', 'Batikiosco'], ['dist-demo', '/negocio/', 'Negocio de prueba CES']]) {
  const directory = resolve(packageRoot, outDir);
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.webmanifest'), 'utf8'));
  const swSource = await readFile(resolve(directory, 'sw.js'), 'utf8');
  const settings = JSON.parse(swSource.match(/const settings = (.*);/)[1]);
  assert.equal(manifest.name, name); assert.equal(manifest.scope, base); assert.equal(settings.base, base);
  assert.match(settings.prefix, /^ces-catalog-[a-f0-9]{16}-$/);
  const metadata = JSON.parse(await readFile(resolve(directory, 'catalog-build.json'), 'utf8'));
  const html = await readFile(resolve(directory, 'index.html'), 'utf8');
  for (const document of [html, await readFile(resolve(directory, 'offline.html'), 'utf8')]) {
    assert.ok(document.includes('<meta name="apple-mobile-web-app-capable" content="yes" />'));
    assert.ok(document.includes(`<meta name="apple-mobile-web-app-title" content="${metadata.pwa.shortName}" />`));
    assert.ok(document.includes(`<link rel="manifest" href="${base}manifest.webmanifest" />`));
  }
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.id, base);
  assert.equal(manifest.start_url, base);
  assert.ok(html.includes(`<link rel="apple-touch-icon" sizes="180x180" href="${metadata.assets.appleTouch}" />`));
  const apple = inspectPng(await readFile(resolve(directory, metadata.assets.appleTouch.slice(base.length))));
  assert.equal(apple.width, 180); assert.equal(apple.height, 180); assert.equal(apple.transparent + apple.partial, 0);
  for (const icon of manifest.icons) {
    const png = await readFile(resolve(directory, icon.src.slice(base.length)));
    const size = Number(icon.sizes.split('x')[0]);
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
    const pixels = inspectPng(png);
    if (icon.purpose === 'any') assert.ok(pixels.transparent > 0, 'real output normal icon must keep alpha');
    else assert.equal(pixels.transparent + pixels.partial, 0, 'real output maskable must be opaque');
  }
  let updated = false;
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith(base)) { res.writeHead(404).end(); return; }
    const file = resolve(directory, decodeURIComponent(pathname.slice(base.length)) || 'index.html');
    const local = relative(directory, file);
    if (local.startsWith('..') || isAbsolute(local)) { res.writeHead(403).end(); return; }
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' })[extname(file)] || 'application/octet-stream');
      const bytes = await readFile(file);
      res.end(local === 'sw.js' && updated ? bytes.toString().replace(settings.version, settings.version + '-verification') : bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await openBrowser('pwa');
    const { cdp, evaluate, until } = browser;
    await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
    await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp('Network.setBlockedURLs', { urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*', 'https://www.googletagmanager.com/*', 'https://*.ingest.us.sentry.io/*'] });
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__installEvents=0; window.addEventListener('beforeinstallprompt',()=>window.__installEvents++);
      if (window.top === window) { window.__loads = Number(sessionStorage.getItem('ces-test-loads') || 0) + 1; sessionStorage.setItem('ces-test-loads', String(window.__loads)); }
      const originalFetch=window.fetch.bind(window); window.fetch=async(url,options)=> {
        if (String(url).includes('/public/catalog')) {
          if (!navigator.onLine || window.__apiFail) throw new TypeError('network offline');
          return new Response(JSON.stringify({currency:'CUP',products:[{id:'test',name:'Producto de verificación',salePrice:'10'}]}));
        }
        return originalFetch(url,options);
      };` });
    const url = `http://127.0.0.1:${server.address().port}${base}`;
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp('Page.navigate', { url });
    await until(`document.querySelector('#producto-test') && navigator.serviceWorker.controller`);
    const appManifest = await cdp('Page.getAppManifest');
    assert.equal(appManifest.errors.length, 0, JSON.stringify(appManifest.errors));
    assert.equal(JSON.parse(appManifest.data).name, name);
    assert.equal(await evaluate(`document.querySelector('meta[name="apple-mobile-web-app-capable"]').content`), 'yes');
    assert.equal(await evaluate(`document.querySelector('meta[name="apple-mobile-web-app-title"]').content`), metadata.pwa.shortName);
    const servedManifest = await evaluate(`(async()=>{
      const link=document.querySelector('link[rel="manifest"]');const response=await fetch(link.href);
      return {url:response.url,status:response.status,type:response.headers.get('content-type'),body:await response.json()};
    })()`);
    assert.equal(servedManifest.status, 200); assert.equal(servedManifest.type, 'application/manifest+json');
    assert.equal(servedManifest.url, new URL('manifest.webmanifest', url).href);
    assert.deepEqual(servedManifest.body, manifest);
    const installability = await cdp('Page.getInstallabilityErrors');
    assert.deepEqual(installability.installabilityErrors, [], JSON.stringify(installability));
    assert.equal(await evaluate('window.__loads'), 1, 'first activation must not reload');
    assert.equal(await evaluate(`(await navigator.serviceWorker.getRegistration()).scope`), url);
    const cacheKeys = await evaluate(`(await caches.open(${JSON.stringify(settings.prefix + settings.version)})).keys().then(keys=>keys.map(r=>r.url))`);
    assert.ok(cacheKeys.every((path) => !path.includes('/public/catalog') && !path.includes('catalog-build.json') && !path.endsWith('/index.html')));

    // Preview the real emitted images; masks affect only the installation tile.
    const previews = await evaluate(`(async()=>{
      const canvas=document.createElement('canvas');canvas.width=1100;canvas.height=270;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#E5E7EB';ctx.fillRect(0,0,1100,270);
      const variants=${JSON.stringify([
        { label: 'Normal (alpha)', src: manifest.icons.find((icon) => icon.sizes === '512x512' && icon.purpose === 'any').src, mask: 'none' },
        { label: 'Android: circle', src: manifest.icons.find((icon) => icon.purpose === 'maskable').src, mask: 'circle' },
        { label: 'Android: rounded', src: manifest.icons.find((icon) => icon.purpose === 'maskable').src, mask: 'rounded' },
        { label: 'Android: squircle', src: manifest.icons.find((icon) => icon.purpose === 'maskable').src, mask: 'squircle' },
        { label: 'Apple 180', src: metadata.assets.appleTouch, mask: 'rounded' },
      ])};
      for(let i=0;i<variants.length;i++){
        const {label,src,mask}=variants[i];const image=new Image();image.src=src;await image.decode();
        const x=i*220+10,y=40,size=200;
        ctx.fillStyle='#111827';ctx.font='15px sans-serif';ctx.fillText(label,x,25);
        ctx.save();ctx.beginPath();
        if(mask==='circle')ctx.arc(x+100,y+100,100,0,Math.PI*2);
        else if(mask==='rounded')ctx.roundRect(x,y,size,size,40);
        else if(mask==='squircle'){
          for(let step=0;step<=360;step++){
            const a=step*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
            const px=x+100+100*Math.sign(c)*Math.sqrt(Math.abs(c)),py=y+100+100*Math.sign(s)*Math.sqrt(Math.abs(s));
            if(step===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
          }ctx.closePath();
        }else ctx.rect(x,y,size,size);
        ctx.clip();
        for(let cy=0;cy<size;cy+=10)for(let cx=0;cx<size;cx+=10){ctx.fillStyle=((cx+cy)/10)%2?'#FFFFFF':'#CBD5E1';ctx.fillRect(x+cx,y+cy,10,10);}
        ctx.drawImage(image,x,y,size,size);ctx.restore();
      }
      return canvas.toDataURL('image/png').split(',')[1];
    })()`);
    await writeFile(resolve(browser.directory, 'icon-masks.png'), Buffer.from(previews, 'base64'));
    console.log(`[verify:pwa] Icon previews: ${resolve(browser.directory, 'icon-masks.png')}`);

    for (const width of [320, 360, 364, 768, 1280]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      await evaluate(`window.dispatchEvent(Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt:async()=>{},userChoice:Promise.resolve({outcome:'dismissed'})}));`);
      await until(`Array.from(document.querySelectorAll('.ces-pwa button')).some(b=>b.textContent==='Instalar catálogo')`);
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `overflow ${name}/${width}`);
      assert.ok(await evaluate(`Array.from(document.querySelectorAll('.ces-pwa button')).every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})`));
      await evaluate(`document.querySelector('.ces-pwa button').focus()`);
      assert.equal(await evaluate(`document.activeElement.closest('.ces-pwa')!==null`), true);
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await until(`!Array.from(document.querySelectorAll('.ces-pwa button')).some(b=>b.textContent==='Instalar catálogo')`);
    }
    await evaluate(`window.dispatchEvent(new Event('appinstalled'))`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.ces-pwa button')).some(b=>b.textContent==='Instalar catálogo')`), false);

    // Verify retained session data is labeled stale immediately when offline.
    await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await until(`document.querySelector('.ces-pwa')?.textContent.includes('Sin conexión')`);
    assert.ok(await evaluate(`document.querySelector('#producto-test')!==null`));
    await cdp('Page.reload');
    await until(`document.querySelector('.ces-pwa')?.textContent.includes('Sin conexión') && document.body.textContent.includes('No pudimos cargar el catálogo')`);
    assert.equal(await evaluate(`document.querySelector('[id^="producto-"]')!==null`), false, 'no invented or persisted products offline');
    await writeFile(resolve(browser.directory, 'offline.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await until(`document.querySelector('#producto-test') && !document.body.textContent.includes('Sin conexión')`);

    // Serve a distinct worker version without changing repository files.
    await evaluate(`Promise.all([caches.open('unrelated-verification-cache'), caches.open('ces-catalog-another-scope-v1')])`);
    updated = true;
    await evaluate(`(await navigator.serviceWorker.getRegistration()).update()`);
    await until(`Array.from(document.querySelectorAll('.ces-pwa button')).some(b=>b.textContent==='Actualizar')`);
    const loads = await evaluate('window.__loads');
    await evaluate(`Array.from(document.querySelectorAll('.ces-pwa button')).find(b=>b.textContent==='Actualizar').click()`);
    await until(`window.__loads===${loads + 1} && document.querySelector('#producto-test')`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(await evaluate('window.__loads'), loads + 1, 'no update reload loop');
    const after = await evaluate('caches.keys()');
    assert.deepEqual(after.filter((key) => key.startsWith(settings.prefix)), [settings.prefix + settings.version + '-verification']);
    assert.ok(after.includes('unrelated-verification-cache')); assert.ok(after.includes('ces-catalog-another-scope-v1'));
    // Simulated iOS/manual installation: real OS installation is unavailable in headless.
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
      Object.defineProperty(navigator,'userAgent',{value:'iPhone'});
      Object.defineProperty(navigator,'standalone',{get:()=>sessionStorage.getItem('ces-test-standalone')==='true'});
      window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();event.stopImmediatePropagation()});` });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
    await cdp('Page.reload');
    await until(`Array.from(document.querySelectorAll('.ces-pwa button')).some(b=>b.textContent==='Cómo instalar')`);
    await evaluate(`Array.from(document.querySelectorAll('.ces-pwa button')).find(b=>b.textContent==='Cómo instalar').click()`);
    await until(`document.querySelector('dialog[open]')`);
    assert.ok(await evaluate(`(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()`));
    assert.equal(await evaluate(`document.activeElement.textContent`), 'Cerrar instrucciones');
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.ok(await evaluate(`document.querySelector('dialog').contains(document.activeElement)`));
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await until(`!document.querySelector('dialog[open]')`);
    await evaluate(`sessionStorage.setItem('ces-test-standalone','true')`);
    await cdp('Page.reload');
    await until(`document.querySelector('#producto-test')`);
    assert.equal(await evaluate(`document.querySelector('.ces-pwa')!==null`), false, 'standalone does not invite installation');
    const exceptions = browser.events.filter((event) => event.method === 'Runtime.exceptionThrown');
    assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
    const consoleErrors = browser.events.filter((event) => event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error');
    assert.equal(consoleErrors.length, 0, JSON.stringify(consoleErrors));
    console.log(`[verify:pwa] ${name} ${base}: manifest/installability OK, worker/scope, 320/360/364/768/1280, optional install, simulated iOS instructions/standalone, offline reload/recovery, accepted update/single reload and scoped cache cleanup. Native prompt events: ${await evaluate('window.__installEvents')}.`);
  } finally {
    await browser?.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  }
}
