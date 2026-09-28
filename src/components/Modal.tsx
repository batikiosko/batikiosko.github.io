import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({ children, onClose, labelledBy }: { children: ReactNode; onClose: () => void; labelledBy: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    element.querySelector<HTMLElement>('[data-modal-initial-focus]')?.focus();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog ref={dialog} className="bk-dialog" aria-labelledby={labelledBy} aria-modal="true"
      onCancel={(event) => { event.preventDefault(); close.current(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]'))
          .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) close.current(); }}>
      <div onClick={(event) => event.stopPropagation()}>{children}</div>
    </dialog>
  );
}
