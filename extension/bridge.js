/* Affiliate Miner — ponte app ↔ extensão
   Roda apenas no domínio do app (lkrm.site / onrender). Recebe pedidos via
   window.postMessage e encaminha ao background; devolve o resultado ao app.
   Assim o botão "Atualizar cupons" do app aciona a extensão (que é quem tem
   acesso à loja logada — o app sozinho não consegue por segurança do navegador). */
(function () {
  function announce() {
    try {
      const version = (chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : '';
      document.documentElement.setAttribute('data-affiliate-miner', version || '1');
      window.postMessage({ __afiliateExt: true, version }, '*');
    } catch (e) {}
  }

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.__afiliate !== true || !d.action) return;
    if (d.action === 'PING_EXT') { announce(); return; }
    // Encaminha ações conhecidas ao background
    const allowed = ['EXTRACT_COUPONS', 'CREATE_ML_COUPONS'];
    if (!allowed.includes(d.action)) return;
    try {
      chrome.runtime.sendMessage({ action: d.action, platform: d.platform || 'mercadolivre', quantity: d.quantity, mode: d.mode }, (resp) => {
        const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
        window.postMessage({ __afiliateAck: true, action: d.action, ok: !!(resp && resp.success), resp: resp || { error: err } }, '*');
      });
    } catch (err) {
      window.postMessage({ __afiliateAck: true, action: d.action, ok: false, resp: { error: (err && err.message) || String(err) } }, '*');
    }
  });

  announce();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', announce);
})();
