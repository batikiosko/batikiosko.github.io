export interface PwaState {
  offline: boolean; installed: boolean; canInstall: boolean; manual: boolean;
  updateAvailable: boolean; updating: boolean; message: string;
}
export interface PwaClient {
  getSnapshot(): PwaState;
  subscribe(fn: () => void): () => void;
  start(): void; stop(): void; install(): Promise<void>; activate(): void;
}
export function isStandalone(browser: Window, navigator: Navigator): boolean;
export function needsManualInstall(navigator: Navigator): boolean;
export function createPwaClient(browser: Window, navigator: Navigator, base: string, enabled: boolean): PwaClient;
