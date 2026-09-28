export function isStandalone(browser, navigator) {
  return browser.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function needsManualInstall(navigator) {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function createPwaClient(browser, navigator, base, enabled) {
  let state = { offline: navigator.onLine === false, installed: isStandalone(browser, navigator), canInstall: false, manual: false, updateAvailable: false, updating: false, message: '' };
  let prompt = null, registration = null, started = false, reloaded = false, lastCheck = 0;
  const listeners = new Set();
  const publish = (patch) => { state = { ...state, ...patch }; for (const fn of listeners) fn(); };
  const cleanups = [];
  const listen = (target, event, callback) => {
    target.addEventListener(event, callback);
    cleanups.push(() => target.removeEventListener(event, callback));
  };
  const check = () => {
    if (!registration || navigator.onLine === false || Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    void registration.update().catch(() => {});
  };
  const standalone = () => {
    const installed = isStandalone(browser, navigator);
    if (installed) prompt = null;
    publish({ installed, canInstall: !installed && !!prompt, manual: enabled && browser.isSecureContext && !installed && needsManualInstall(navigator) });
  };
  const waiting = () => publish({ updateAvailable: !!registration?.waiting });
  const client = {
    getSnapshot: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    start() {
      if (started) return;
      started = true;
      standalone();
      listen(browser, 'offline', () => publish({ offline: true }));
      listen(browser, 'online', () => { publish({ offline: false }); check(); });
      if (!enabled || !browser.isSecureContext) return;
      listen(browser.matchMedia('(display-mode: standalone)'), 'change', standalone);
      listen(browser, 'beforeinstallprompt', (event) => {
        if (state.installed) return;
        event.preventDefault(); prompt = event;
        publish({ canInstall: true, manual: false, message: '' });
      });
      listen(browser, 'appinstalled', () => {
        prompt = null; publish({ installed: true, canInstall: false, manual: false, message: '' });
      });
      if (!navigator.serviceWorker) return;
      listen(navigator.serviceWorker, 'controllerchange', () => {
        // First install never reloads; only an explicitly accepted update does.
        if (state.updating && !reloaded) { reloaded = true; browser.location.reload(); }
      });
      listen(browser, 'focus', check);
      listen(browser.document, 'visibilitychange', () => { if (browser.document.visibilityState === 'visible') check(); });
      void navigator.serviceWorker.register(base + 'sw.js', { scope: base, updateViaCache: 'none' }).then((value) => {
        registration = value;
        waiting();
        const track = () => {
          const worker = registration.installing;
          if (!worker) return;
          listen(worker, 'statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) waiting();
          });
        };
        listen(registration, 'updatefound', track);
        track(); check();
      }).catch(() => publish({ message: 'No se pudo preparar el acceso sin conexión. Podés seguir usando el catálogo.' }));
    },
    async install() {
      const event = prompt;
      if (!event || state.installed) return;
      prompt = null; publish({ canInstall: false, message: '' });
      try {
        await event.prompt();
        const choice = await event.userChoice;
        if (choice.outcome === 'accepted') publish({ message: 'Instalación solicitada. Completá los pasos del navegador.' });
      } catch { publish({ message: 'No se pudo iniciar la instalación. Podés instalar desde el menú del navegador.' }); }
    },
    activate() {
      if (!registration?.waiting || state.updating) return;
      publish({ updating: true, message: '' });
      registration.waiting.postMessage({ type: 'CES_CATALOG_ACTIVATE' });
    },
    stop() { for (const cleanup of cleanups.splice(0)) cleanup(); started = false; },
  };
  return client;
}
