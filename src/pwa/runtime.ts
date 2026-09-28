import { createPwaClient } from './client.mjs';

export const pwa = createPwaClient(window, navigator, import.meta.env.BASE_URL, import.meta.env.PROD);
pwa.start();
