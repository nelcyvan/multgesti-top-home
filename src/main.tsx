// home/multgesti/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { registerSW } from 'virtual:pwa-register';


// NAT público: HTTPS só na :1200. Sem porta o app quebra fora da rede local.
if (
  typeof window !== "undefined" &&
  window.location.protocol === "https:" &&
  (window.location.hostname === "tophc.com.br" || window.location.hostname === "www.tophc.com.br") &&
  !window.location.port
) {
  const { pathname, search, hash } = window.location;
  window.location.replace(`https://${window.location.hostname}:1200${pathname}${search}${hash}`);
}


registerSW({
  immediate: true,
  onNeedRefresh() {
    // Nova versão disponível — recarrega para aplicar o update
    window.location.reload();
  },
  onOfflineReady() {
    console.log('[PWA] Pronto para uso offline (assets em cache)');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);