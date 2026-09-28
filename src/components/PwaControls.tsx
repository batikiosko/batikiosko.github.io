import { useState, useSyncExternalStore } from 'react';
import { pwa } from '../pwa/runtime.js';
import { catalogConfig } from '../catalog/runtime.js';
import { Modal } from './Modal.js';

export function PwaControls() {
  const state = useSyncExternalStore(pwa.subscribe, pwa.getSnapshot);
  const [instructions, setInstructions] = useState(false);
  if (!state.offline && !state.canInstall && !state.manual && !state.updateAvailable && !state.message) return null;
  return (
    <aside className="ces-pwa" aria-label="Aplicación del catálogo">
      {state.offline && <p role="status">Sin conexión. Los productos y precios no pueden actualizarse. Si ves productos, corresponden a la última carga de esta sesión.</p>}
      {state.canInstall && !state.installed && <button className="bk-retry" onClick={() => void pwa.install()}>Instalar catálogo</button>}
      {state.manual && !state.installed && <button className="bk-retry" onClick={() => setInstructions(true)}>Cómo instalar</button>}
      {state.updateAvailable && <div className="ces-pwa-update"><span role="status">Hay una nueva versión disponible.</span><button className="bk-retry" disabled={state.updating} onClick={() => pwa.activate()}>{state.updating ? 'Actualizando…' : 'Actualizar'}</button></div>}
      {state.message && <p role="status">{state.message}</p>}
      {instructions && <Modal labelledBy="ces-install-title" onClose={() => setInstructions(false)}>
        <div className="ces-install-help">
          <h2 id="ces-install-title">Instalar {catalogConfig.pwa.name}</h2>
          <p>Abrí el menú Compartir del navegador y elegí «Añadir a la pantalla de inicio». Si no aparece, abrí este catálogo en Safari. La disponibilidad depende del navegador.</p>
          <button className="bk-retry" data-modal-initial-focus onClick={() => setInstructions(false)}>Cerrar instrucciones</button>
        </div>
      </Modal>}
    </aside>
  );
}
