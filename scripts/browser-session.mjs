import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { packageRoot } from './catalog-plugin.mjs';

export async function openBrowser(label) {
  const executable = process.env.CATALOG_BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  if (!executable) throw new Error('Definí CATALOG_BROWSER_PATH con un Chromium instalado.');
  const directory = resolve(packageRoot, '.browser-check', `${label}-${Date.now()}`);
  await mkdir(directory, { recursive: true });
  const browser = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${directory}`], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  try {
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
    const events = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) { events.push(message); return; }
      const job = pending.get(message.id);
      if (!job) return;
      pending.delete(message.id); clearTimeout(job.timer);
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
      const result = await cdp('Runtime.evaluate', { expression: `(async () => (${expression.replace(/;\s*$/, '')}))()`, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const until = async (expression) => {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (await evaluate(`Boolean(${expression})`)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const diagnostic = await evaluate(`({loads:window.__loads,body:document.body.innerText.slice(0,800),waiting:!!(await navigator.serviceWorker.getRegistration())?.waiting,caches:await caches.keys()})`);
      throw new Error(`Browser condition failed: ${expression}; ${JSON.stringify(diagnostic)}`);
    };
    return { cdp, evaluate, until, events, directory, async close() { try { await send('Browser.close'); } finally { socket.close(); if (browser.exitCode === null) browser.kill(); } } };
  } catch (error) { socket?.close(); browser.kill(); throw error; }
}
