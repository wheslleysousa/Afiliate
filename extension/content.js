/* Affiliate Miner Content Script v2.6.5 — Enhanced Extraction & Filter Modal */

let extActive = true;
let autoMine = false;
let autoMineInterval = null;
let pdpCheckInterval = null;
let isOverlayExpanded = true;
let isOverlayHidden = false;
let isFilterAccordionOpen = false;
let currentPageNum = 1;

let qualityFilters = {
  category: '',
  categorySlug: '',
  sortOrder: 'relevance',
  selectedMarketplaces: {
    ml: false,
    shopee: false,
    amazon: false,
    shein: false,
    aliexpress: false,
    tiktok: false
  },
  minPrice: 0,
  maxPrice: null,
  minDiscount: 0,
  minRating: 0,
  minSales: 0,
  noInterest: false,
  freeShipping: false
};

let minedProducts = [];
let discardedCount = 0;
let lastErrorLog = null;

/* ═══════════════════════════════════════
   GLOBAL ERROR CATCHER (AI DIAGNOSTICS)
   ═══════════════════════════════════════ */
window.addEventListener('error', (e) => {
  handleGlobalError(e.error || e.message, 'Global Script Error');
});
window.addEventListener('unhandledrejection', (e) => {
  handleGlobalError(e.reason, 'Unhandled Promise Rejection');
});

function handleGlobalError(err, context = 'Erro na Extensão') {
  lastErrorLog = {
    message: err?.message || String(err),
    stack: err?.stack || 'Sem stack trace',
    context,
    url: window.location.href,
    time: new Date().toLocaleString('pt-BR')
  };
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['affiliateMinerState'], (res) => {
      const state = res.affiliateMinerState || {};
      state.lastError = lastErrorLog;
      chrome.storage.local.set({ affiliateMinerState: state });
    });
  }
  showDiagnosticErrorModal(lastErrorLog);
}

/* ═══════════════════════════════════════
   1. INITIAL STATE SYNC
   ═══════════════════════════════════════ */
function initContentScript() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['affiliateMinerState'], (res) => {
      if (res.affiliateMinerState) {
        const s = res.affiliateMinerState;
        extActive = s.extActive ?? true;
        autoMine = s.autoMine ?? false;
        minedProducts = s.minedProducts || [];
        discardedCount = s.discardedCount || 0;
        if (s.qualityFilters) {
          qualityFilters = { ...qualityFilters, ...s.qualityFilters };
        }
      }
      injectOverlayCSS();
      renderDraggableOverlay();
      renderFloatingTrigger();
      updatePageHighlighting();
      startPdpButtonWatcher();
      if (autoMine && extActive) startAutoMining();
    });
  } else {
    injectOverlayCSS();
    renderDraggableOverlay();
    renderFloatingTrigger();
    updatePageHighlighting();
    startPdpButtonWatcher();
  }
}

function saveStateToStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['affiliateMinerState'], (res) => {
      const current = res.affiliateMinerState || {};
      const updated = {
        ...current,
        extActive,
        autoMine,
        minedProducts,
        discardedCount,
        qualityFilters,
        lastError: lastErrorLog
      };
      chrome.storage.local.set({ affiliateMinerState: updated });
    });
  }
}

/* ═══════════════════════════════════════
   2. INJECT SCOPED STYLES
   ═══════════════════════════════════════ */
function injectOverlayCSS() {
  if (document.getElementById('am-injected-styles')) return;
  const style = document.createElement('style');
  style.id = 'am-injected-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap');

    #am-overlay {
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      width: 370px;
      min-width: 310px;
      max-width: 92vw;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
      user-select: none !important;
      background-color: #07090f !important;
      border: 1px solid #2563eb !important;
      border-radius: 16px !important;
      box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 25px rgba(37,99,235,0.4) !important;
      overflow: hidden !important;
      transition: width 0.2s ease !important;
    }
    #am-overlay * { box-sizing: border-box !important; margin: 0; padding: 0; }

    .am-panel {
      background-color: #07090f !important;
      color: #eef2f9 !important;
      width: 100% !important;
      display: flex !important;
      flex-direction: column !important;
    }

    .am-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 11px 14px !important;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      cursor: move !important; flex-shrink: 0 !important;
    }
    .am-header-left { display: flex !important; align-items: center !important; gap: 8px !important; }
    .am-logo-icon {
      width: 28px !important; height: 28px !important;
      background: rgba(255,255,255,0.2) !important;
      border-radius: 8px !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
      color: #fff !important; font-weight: 900 !important; font-size: 14px !important;
    }
    .am-header-title { font-size: 13px !important; font-weight: 800 !important; color: #ffffff !important; letter-spacing: 0.5px !important; }
    .am-header-ver { font-size: 9px !important; color: #dbeafe !important; font-weight: 600 !important; }
    .am-header-actions { display: flex !important; align-items: center !important; gap: 6px !important; }
    .am-btn-icon {
      width: 26px !important; height: 26px !important;
      background: rgba(255,255,255,0.18) !important;
      border: 1px solid rgba(255,255,255,0.3) !important;
      border-radius: 6px !important; color: #fff !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
      cursor: pointer !important; font-size: 11px !important; font-weight: 800 !important;
      transition: background 0.2s !important;
    }
    .am-btn-icon:hover { background: rgba(255,255,255,0.35) !important; }

    .am-body {
      padding: 12px 14px !important;
      display: flex !important; flex-direction: column !important; gap: 10px !important;
      background-color: #07090f !important;
      max-height: 540px !important; overflow-y: auto !important;
    }
    .am-body::-webkit-scrollbar { width: 5px !important; }
    .am-body::-webkit-scrollbar-thumb { background: #26304a !important; border-radius: 4px !important; }

    .am-label {
      font-size: 10px !important; font-weight: 800 !important; color: #93a0b5 !important;
      text-transform: uppercase !important; letter-spacing: 0.5px !important;
      margin-bottom: 4px !important; display: block !important;
    }

    .am-mkt-grid {
      display: grid !important;
      grid-template-columns: repeat(3, 1fr) !important;
      gap: 6px !important;
    }
    .am-mkt-card {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 5px !important;
      padding: 7px 6px !important;
      background: #111622 !important;
      border: 1px solid #26304a !important;
      border-radius: 8px !important;
      color: #94a3b8 !important;
      font-size: 10px !important;
      font-weight: 800 !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      user-select: none !important;
    }
    .am-mkt-card:hover {
      border-color: #3b82f6 !important;
      color: #ffffff !important;
      background: #192233 !important;
    }
    .am-mkt-card.selected.ml { border-color: #ffe600 !important; background: rgba(255, 230, 0, 0.16) !important; color: #ffe600 !important; box-shadow: 0 0 10px rgba(255,230,0,0.2) !important; }
    .am-mkt-card.selected.shopee { border-color: #ee4d2d !important; background: rgba(238, 77, 45, 0.16) !important; color: #ff6b4a !important; box-shadow: 0 0 10px rgba(238,77,45,0.2) !important; }
    .am-mkt-card.selected.amazon { border-color: #ff9900 !important; background: rgba(255, 153, 0, 0.16) !important; color: #ffb74d !important; box-shadow: 0 0 10px rgba(255,153,0,0.2) !important; }
    .am-mkt-card.selected.shein { border-color: #ec4899 !important; background: rgba(236, 72, 153, 0.16) !important; color: #f472b6 !important; box-shadow: 0 0 10px rgba(236,72,153,0.2) !important; }
    .am-mkt-card.selected.aliexpress { border-color: #ef4444 !important; background: rgba(239, 68, 68, 0.16) !important; color: #f87171 !important; box-shadow: 0 0 10px rgba(239,68,68,0.2) !important; }
    .am-mkt-card.selected.tiktok { border-color: #25f4ee !important; background: rgba(37, 244, 238, 0.16) !important; color: #25f4ee !important; box-shadow: 0 0 10px rgba(37,244,238,0.2) !important; }
    .am-mkt-icon { font-size: 12px !important; }
    .am-mkt-name { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }

    .am-select, .am-input {
      width: 100% !important;
      background: #151a26 !important; color: #ffffff !important;
      border: 1px solid #26304a !important; border-radius: 8px !important;
      padding: 8px 10px !important; font-size: 11px !important; font-weight: 700 !important;
      outline: none !important;
    }
    .am-select option { background: #151a26 !important; color: #fff !important; }
    .am-input:focus, .am-select:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(37,99,235,0.3) !important; }

    .am-btn-search {
      width: 100% !important; padding: 10px 12px !important;
      background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
      color: #fff !important; border: none !important; border-radius: 8px !important;
      font-size: 12px !important; font-weight: 800 !important; cursor: pointer !important;
      display: flex !important; align-items: center !important; justify-content: center !important; gap: 6px !important;
      box-shadow: 0 4px 12px rgba(37,99,235,0.3) !important;
    }
    .am-btn-search:hover { background: #1d4ed8 !important; }

    .am-accordion-btn {
      width: 100% !important;
      padding: 9px 12px !important;
      background: #151a26 !important;
      border: 1px solid #26304a !important;
      border-radius: 8px !important;
      color: #93a0b5 !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
    }
    .am-accordion-btn:hover { border-color: #3b82f6 !important; color: #fff !important; }
    .am-accordion-content {
      display: flex !important; flex-direction: column !important; gap: 8px !important;
      padding: 10px !important; background: #0b0f19 !important; border: 1px solid #1e2636 !important;
      border-radius: 8px !important; margin-top: 4px !important;
    }

    .am-chips-row { display: flex !important; gap: 4px !important; overflow-x: auto !important; padding-top: 3px !important; scrollbar-width: none !important; }
    .am-chip-btn {
      background: #151a26 !important; color: #3b82f6 !important; border: 1px solid #26304a !important;
      padding: 2px 7px !important; border-radius: 10px !important; font-size: 10px !important; font-weight: 700 !important;
      cursor: pointer !important; white-space: nowrap !important; flex-shrink: 0 !important;
    }
    .am-chip-btn:hover { background: #2563eb !important; color: #fff !important; border-color: #2563eb !important; }

    .am-control-bar {
      display: flex !important; align-items: center !important; justify-content: space-between !important;
      background: #151a26 !important; padding: 10px 12px !important; border-radius: 10px !important;
      border: 1px solid #1e2636 !important;
    }
    .am-btn-automine {
      padding: 8px 14px !important; border-radius: 8px !important; border: none !important;
      font-size: 11px !important; font-weight: 800 !important; cursor: pointer !important; color: #fff !important;
      display: flex !important; align-items: center !important; gap: 6px !important;
      transition: all 0.2s !important;
    }
    .am-btn-automine.active {
      background: linear-gradient(135deg, #eab308, #ca8a04) !important;
      color: #000 !important;
      box-shadow: 0 0 15px rgba(234, 179, 8, 0.4) !important;
      animation: amPulse 1.8s infinite !important;
    }
    .am-btn-automine.inactive {
      background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
    }

    @keyframes amPulse {
      0% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.6); }
      70% { box-shadow: 0 0 0 10px rgba(234, 179, 8, 0); }
      100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); }
    }

    .am-metrics { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
    .am-metric-card {
      background: #151a26 !important; border-radius: 8px !important; padding: 8px !important;
      text-align: center !important; border: 1px solid #1e2636 !important;
    }
    .am-metric-num { font-size: 18px !important; font-weight: 900 !important; }
    .am-metric-num.emerald { color: #22c55e !important; }
    .am-metric-num.rose { color: #ef4444 !important; }

    .am-check-row { display: flex !important; justify-content: space-between !important; font-size: 11px !important; font-weight: 700 !important; color: #cbd5e1 !important; }
    .am-check-row label { display: flex !important; align-items: center !important; gap: 4px !important; cursor: pointer !important; }
    .am-check-row input { accent-color: #2563eb !important; }

    #am-floating-trigger {
      position: fixed !important; bottom: 20px !important; right: 20px !important;
      z-index: 2147483647 !important;
      background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
      color: #fff !important; border: none !important; border-radius: 30px !important;
      padding: 10px 18px !important; font-size: 12px !important; font-weight: 800 !important;
      box-shadow: 0 10px 25px rgba(0,0,0,0.6), 0 0 15px rgba(37,99,235,0.45) !important;
      cursor: pointer !important; display: flex !important; align-items: center !important; gap: 6px !important;
    }

    .am-highlight-border {
      position: relative !important;
      outline: 2px solid #2563eb !important;
      outline-offset: -2px !important;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.15) !important;
      border-radius: 8px !important;
      transition: all 0.25s ease-in-out !important;
    }
    .am-highlight-border:hover {
      outline: 3px solid #3b82f6 !important;
      outline-offset: -2px !important;
      box-shadow: 0 8px 25px rgba(37, 99, 235, 0.35) !important;
    }

    .am-card-mine-btn {
      width: calc(100% - 12px) !important;
      margin: 6px auto !important;
      padding: 8px 12px !important;
      background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 8px !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 5px !important;
      box-shadow: 0 3px 10px rgba(37, 99, 235, 0.35) !important;
      position: relative !important;
      z-index: 99 !important;
      transition: all 0.2s ease !important;
    }
    .am-card-mine-btn:hover {
      transform: translateY(-1px) !important;
      background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
      box-shadow: 0 5px 14px rgba(59, 130, 246, 0.5) !important;
    }
    .am-card-mine-btn.mined-success {
      background: linear-gradient(135deg, #10b981, #059669) !important;
    }

    #btn-injected-mine-pdp {
      width: 100% !important;
      margin: 10px 0 !important;
      padding: 13px 20px !important;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 12px !important;
      font-size: 14px !important;
      font-weight: 800 !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4) !important;
      transition: all 0.2s ease !important;
      z-index: 999999 !important;
    }
    #btn-injected-mine-pdp:hover {
      transform: translateY(-2px) !important;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      box-shadow: 0 8px 25px rgba(59, 130, 246, 0.6) !important;
    }

    /* Filter Modal Popup Overlay */
    .am-filter-modal-backdrop {
      position: fixed !important;
      inset: 0 !important;
      background: rgba(3, 7, 18, 0.75) !important;
      backdrop-filter: blur(6px) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 16px !important;
    }
    .am-filter-modal-backdrop.am-hidden {
      display: none !important;
    }
    .am-filter-modal-box {
      width: 360px !important;
      max-width: 92vw !important;
      max-height: 88vh !important;
      background: #0b0f19 !important;
      border: 1px solid #2563eb !important;
      border-radius: 16px !important;
      box-shadow: 0 25px 60px rgba(0,0,0,0.95), 0 0 30px rgba(37,99,235,0.35) !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      font-family: 'Plus Jakarta Sans', sans-serif !important;
    }
    .am-filter-modal-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 13px 16px !important;
      background: #111625 !important;
      border-bottom: 1px solid #1e2638 !important;
    }
    .am-filter-modal-close-btn {
      background: none !important;
      border: none !important;
      color: #94a3b8 !important;
      font-size: 22px !important;
      cursor: pointer !important;
      line-height: 1 !important;
    }
    .am-filter-modal-close-btn:hover { color: #ffffff !important; }
    .am-filter-modal-body {
      padding: 14px 16px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 12px !important;
      overflow-y: auto !important;
    }
    .am-filter-modal-footer {
      display: flex !important;
      gap: 10px !important;
      padding: 12px 16px !important;
      background: #111625 !important;
      border-top: 1px solid #1e2638 !important;
    }
    .am-modal-btn-primary {
      flex: 1 !important;
      padding: 10px !important;
      background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
      color: #fff !important;
      border: none !important;
      border-radius: 8px !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      cursor: pointer !important;
      box-shadow: 0 4px 12px rgba(37,99,235,0.3) !important;
    }
    .am-modal-btn-primary:hover { background: #1d4ed8 !important; }
    .am-modal-btn-secondary {
      padding: 10px 16px !important;
      background: #1e2638 !important;
      color: #94a3b8 !important;
      border: none !important;
      border-radius: 8px !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
    }
    .am-modal-btn-secondary:hover { color: #fff !important; background: #26304a !important; }

    .am-btn-open-modal {
      width: 100% !important;
      padding: 10px 14px !important;
      background: #111625 !important;
      border: 1px solid #2563eb !important;
      border-radius: 10px !important;
      color: #60a5fa !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      box-shadow: 0 2px 8px rgba(37,99,235,0.2) !important;
    }
    .am-btn-open-modal:hover {
      background: #1e2638 !important;
      color: #ffffff !important;
      border-color: #3b82f6 !important;
      transform: translateY(-1px) !important;
    }

    /* Toast Flutuante */
    #am-toast {
      position: fixed !important;
      bottom: 24px !important;
      left: 50% !important;
      transform: translateX(-50%) translateY(100px) !important;
      background: #0f172a !important;
      border: 1px solid #3b82f6 !important;
      color: #ffffff !important;
      padding: 10px 18px !important;
      border-radius: 30px !important;
      font-family: 'Plus Jakarta Sans', sans-serif !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(59,130,246,0.3) !important;
      z-index: 2147483647 !important;
      opacity: 0 !important;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
      pointer-events: none !important;
    }
    #am-toast.error-toast {
      background: #7f1d1d !important;
      border-color: #ef4444 !important;
      color: #ffffff !important;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(239,68,68,0.4) !important;
    }
    #am-toast.visible {
      transform: translateX(-50%) translateY(0) !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);
}

/* ═══════════════════════════════════════
   3. RENDER OVERLAY (RESTRUCTURED & INTUITIVE)
   ═══════════════════════════════════════ */
function renderDraggableOverlay() {
  let overlay = document.getElementById('am-overlay');

  if (!extActive || isOverlayHidden) {
    if (overlay) overlay.style.display = 'none';
    return;
  }

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'am-overlay';
    document.body.appendChild(overlay);
    makeElementDraggable(overlay);
  }

  overlay.style.display = 'block';
  const minedCount = minedProducts.length;

  if (!isOverlayExpanded) {
    overlay.style.width = '240px';
    overlay.innerHTML = `
      <div class="am-panel">
        <div class="am-header" id="am-drag-handle">
          <div class="am-header-left">
            <div class="am-logo-icon">⚡</div>
            <span class="am-header-title">MINER (${minedCount})</span>
          </div>
          <div class="am-header-actions">
            <button class="am-btn-icon" id="am-btn-expand" title="Expandir Painel">➕</button>
            <button class="am-btn-icon" id="am-btn-hide" title="Esconder">👁️</button>
          </div>
        </div>
      </div>
    `;
    overlay.querySelector('#am-btn-expand').onclick = () => { isOverlayExpanded = true; renderDraggableOverlay(); };
    overlay.querySelector('#am-btn-hide').onclick = () => { hideOverlay(); };
    return;
  }

  overlay.style.width = '370px';
  overlay.innerHTML = `
    <div class="am-panel">
      <!-- HEADER -->
      <div class="am-header" id="am-drag-handle">
        <div class="am-header-left">
          <div class="am-logo-icon">⚡</div>
          <div>
            <div class="am-header-title">AFFILIATE MINER</div>
            <div class="am-header-ver">v2.6.5</div>
          </div>
        </div>
        <div class="am-header-actions">
          <button class="am-btn-icon" id="am-btn-collapse" title="Minimizar">➖</button>
          <button class="am-btn-icon" id="am-btn-hide" title="Esconder Overlay">👁️</button>
        </div>
      </div>

      <!-- BODY -->
      <div class="am-body">
        
        <!-- Marketplace Selection (Logo Cards) -->
        <div>
          <span class="am-label">🛍️ Lojas Habilitadas para Minerar</span>
          <div class="am-mkt-grid">
            <button type="button" class="am-mkt-card ${qualityFilters.selectedMarketplaces.ml ? 'selected ml' : ''}" id="mkt-ml" title="Mercado Livre">
              <span class="am-mkt-icon">🟡</span>
              <span class="am-mkt-name">Mercado Livre</span>
            </button>
            <button type="button" class="am-mkt-card ${qualityFilters.selectedMarketplaces.shopee ? 'selected shopee' : ''}" id="mkt-shopee" title="Shopee">
              <span class="am-mkt-icon">🟠</span>
              <span class="am-mkt-name">Shopee</span>
            </button>
            <button type="button" class="am-mkt-card ${qualityFilters.selectedMarketplaces.amazon ? 'selected amazon' : ''}" id="mkt-amazon" title="Amazon">
              <span class="am-mkt-icon">📦</span>
              <span class="am-mkt-name">Amazon</span>
            </button>
            <button type="button" class="am-mkt-card ${qualityFilters.selectedMarketplaces.shein ? 'selected shein' : ''}" id="mkt-shein" title="Shein">
              <span class="am-mkt-icon">👗</span>
              <span class="am-mkt-name">Shein</span>
            </button>
            <button type="button" class="am-mkt-card ${qualityFilters.selectedMarketplaces.aliexpress ? 'selected aliexpress' : ''}" id="mkt-aliexpress" title="AliExpress">
              <span class="am-mkt-icon">🔴</span>
              <span class="am-mkt-name">AliExpress</span>
            </button>
            <button type="button" class="am-mkt-card ${qualityFilters.selectedMarketplaces.tiktok ? 'selected tiktok' : ''}" id="mkt-tiktok" title="TikTok Shop">
              <span class="am-mkt-icon">🎵</span>
              <span class="am-mkt-name">TikTok</span>
            </button>
          </div>
        </div>

        <!-- Keyword Search & Action Bar -->
        <div>
          <span class="am-label">🔍 Palavra-chave / Produto</span>
          <input type="text" id="am-input-kw" class="am-input" value="${qualityFilters.category || ''}" placeholder="Ex: Fone Bluetooth, iPhone, Air Fryer..." />
        </div>

        <button id="am-btn-do-search" class="am-btn-search">
          🔍 Pesquisar
        </button>

        <!-- Auto Mine Control Card -->
        <div class="am-control-bar">
          <div>
            <div style="font-size:11px; font-weight:800; color:#fff;">Mineração Automática</div>
            <div style="font-size:9px; color:#94a3b8;">${autoMine ? '▶ Minando e trocando de páginas...' : 'Scroll celular & extração contínua'}</div>
          </div>
          <button id="am-btn-automine" class="am-btn-automine ${autoMine ? 'active' : 'inactive'}">
            ${autoMine ? '⏸ Pausar Mineração' : '▶ Ligar Mineração'}
          </button>
        </div>

        <!-- Metrics Grid -->
        <div class="am-metrics">
          <div class="am-metric-card">
            <span style="font-size:9px; font-weight:800; color:#94a3b8; display:block;">APROVADOS</span>
            <span class="am-metric-num emerald">${minedCount}</span>
          </div>
          <div class="am-metric-card">
            <span style="font-size:9px; font-weight:800; color:#94a3b8; display:block;">DESCARTADOS</span>
            <span class="am-metric-num rose">${discardedCount}</span>
          </div>
        </div>

        <!-- Filter Modal Trigger Button -->
        <div>
          <button id="am-btn-open-filter-modal" class="am-btn-open-modal">
            <span>⚙️ Filtros Avançados</span>
          </button>
        </div>

      </div>
    </div>
  `;

  bindOverlayListeners(overlay);
}

function hideOverlay() {
  isOverlayHidden = true;
  const overlay = document.getElementById('am-overlay');
  if (overlay) overlay.style.display = 'none';
  renderFloatingTrigger();
}

function showOverlay() {
  isOverlayHidden = false;
  const trigger = document.getElementById('am-floating-trigger');
  if (trigger) trigger.style.display = 'none';
  renderDraggableOverlay();
}

function renderFloatingTrigger() {
  let trigger = document.getElementById('am-floating-trigger');
  if (!extActive || !isOverlayHidden) {
    if (trigger) trigger.style.display = 'none';
    return;
  }
  if (!trigger) {
    trigger = document.createElement('button');
    trigger.id = 'am-floating-trigger';
    trigger.innerHTML = `<span>⚡ Affiliate Miner</span>`;
    trigger.onclick = () => showOverlay();
    document.body.appendChild(trigger);
  }
  trigger.style.display = 'flex';
}

function triggerAutomatedSearch() {
  const kw   = (qualityFilters.category || '').trim();
  const cat  = qualityFilters.categorySlug || '';
  const sort = qualityFilters.sortOrder || 'relevance';
  const term = kw || cat;
  const platform = getPlatformKey();

  let targetUrl;

  switch (platform) {
    case 'amazon':
      targetUrl = term
        ? `https://www.amazon.com.br/s?k=${encodeURIComponent(term)}`
        : 'https://www.amazon.com.br/deals';
      break;
    case 'shopee':
      targetUrl = term
        ? `https://shopee.com.br/search?keyword=${encodeURIComponent(term)}`
        : 'https://shopee.com.br/daily_discover';
      break;
    case 'aliexpress':
      targetUrl = term
        ? `https://pt.aliexpress.com/wholesale?SearchText=${encodeURIComponent(term)}`
        : 'https://pt.aliexpress.com/';
      break;
    case 'shein':
      targetUrl = term
        ? `https://www.shein.com.br/pdsearch/${encodeURIComponent(term)}`
        : 'https://www.shein.com.br/';
      break;
    case 'tiktok':
      targetUrl = term
        ? `https://www.tiktok.com/search?q=${encodeURIComponent(term)}`
        : 'https://www.tiktok.com/';
      break;
    case 'mercadolivre':
    default: {
      targetUrl = term
        ? `https://lista.mercadolivre.com.br/${encodeURIComponent(term)}`
        : 'https://www.mercadolivre.com.br/ofertas';
      if (sort === 'sales')       targetUrl += '_Order_sales_desc';
      else if (sort === 'price_asc')  targetUrl += '_Order_price_asc';
      else if (sort === 'price_desc') targetUrl += '_Order_price_desc';
      break;
    }
  }

  window.location.href = targetUrl;
}

function bindOverlayListeners(overlay) {
  overlay.querySelector('#am-btn-collapse').onclick = () => { isOverlayExpanded = false; renderDraggableOverlay(); };
  overlay.querySelector('#am-btn-hide').onclick = () => { hideOverlay(); };

  const btnOpenFilter = overlay.querySelector('#am-btn-open-filter-modal');
  if (btnOpenFilter) {
    btnOpenFilter.onclick = () => openFilterModal();
  }

  overlay.querySelector('#am-btn-automine').onclick = () => {
    autoMine = !autoMine;
    saveStateToStorage();
    if (autoMine) startAutoMining(); else stopAutoMining();
    renderDraggableOverlay();
  };

  const btnSearch = overlay.querySelector('#am-btn-do-search');
  if (btnSearch) {
    btnSearch.onclick = () => triggerAutomatedSearch();
  }

  ['ml', 'shopee', 'amazon', 'shein', 'aliexpress', 'tiktok'].forEach(mkt => {
    const btn = overlay.querySelector(`#mkt-${mkt}`);
    if (btn) {
      btn.onclick = (e) => {
        e.preventDefault();
        qualityFilters.selectedMarketplaces[mkt] = !qualityFilters.selectedMarketplaces[mkt];
        saveStateToStorage();
        renderDraggableOverlay();
      };
    }
  });

  const kwInput = overlay.querySelector('#am-input-kw');
  if (kwInput) {
    kwInput.oninput = () => { qualityFilters.category = kwInput.value.trim(); saveStateToStorage(); };
    kwInput.onkeydown = (e) => {
      if (e.key === 'Enter') triggerAutomatedSearch();
    };
  }
}

function closeFilterModal() {
  const modal = document.getElementById('am-filter-modal');
  if (modal) {
    modal.classList.add('am-hidden');
    modal.style.setProperty('display', 'none', 'important');
    modal.remove();
  }
}

function openFilterModal() {
  closeFilterModal();

  const modal = document.createElement('div');
  modal.id = 'am-filter-modal';
  modal.className = 'am-filter-modal-backdrop';
  modal.innerHTML = `
    <div class="am-filter-modal-box">
      <div class="am-filter-modal-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;">⚙️</span>
          <span style="font-weight:800;font-size:13px;color:#fff;">Filtros Avançados de Mineração</span>
        </div>
        <button id="am-filter-modal-close" class="am-filter-modal-close-btn">&times;</button>
      </div>

      <div class="am-filter-modal-body">
        <!-- Category Dropdown -->
        <div>
          <span class="am-label">Categoria de Produtos</span>
          <select id="am-modal-category" class="am-select">
            <option value="">🔥 Todas as Categorias</option>
            <option value="celulares" ${qualityFilters.categorySlug === 'celulares' ? 'selected' : ''}>📱 Celulares e Smartphones</option>
            <option value="informatica" ${qualityFilters.categorySlug === 'informatica' ? 'selected' : ''}>💻 Informática e Notebooks</option>
            <option value="eletronicos" ${qualityFilters.categorySlug === 'eletronicos' ? 'selected' : ''}>🎧 Eletrônicos, Áudio e Vídeo</option>
            <option value="eletrodomesticos" ${qualityFilters.categorySlug === 'eletrodomesticos' ? 'selected' : ''}>🏠 Eletrodomésticos</option>
            <option value="beleza" ${qualityFilters.categorySlug === 'beleza' ? 'selected' : ''}>💄 Beleza e Cuidado Pessoal</option>
            <option value="moda" ${qualityFilters.categorySlug === 'moda' ? 'selected' : ''}>👕 Calçados, Roupas e Bolsas</option>
            <option value="casa" ${qualityFilters.categorySlug === 'casa' ? 'selected' : ''}>🛋️ Casa, Móveis e Decoração</option>
            <option value="esportes" ${qualityFilters.categorySlug === 'esportes' ? 'selected' : ''}>⚽ Esportes e Fitness</option>
            <option value="brinquedos" ${qualityFilters.categorySlug === 'brinquedos' ? 'selected' : ''}>🧸 Brinquedos e Hobbies</option>
            <option value="ferramentas" ${qualityFilters.categorySlug === 'ferramentas' ? 'selected' : ''}>🛠️ Ferramentas</option>
            <option value="acessorios-veiculos" ${qualityFilters.categorySlug === 'acessorios-veiculos' ? 'selected' : ''}>🚗 Acessórios para Veículos</option>
            <option value="alimentos-bebidas" ${qualityFilters.categorySlug === 'alimentos-bebidas' ? 'selected' : ''}>🍕 Alimentos e Bebidas</option>
            <option value="bebes" ${qualityFilters.categorySlug === 'bebes' ? 'selected' : ''}>🍼 Bebês e Maternidade</option>
            <option value="games" ${qualityFilters.categorySlug === 'games' ? 'selected' : ''}>🎮 Games e Consoles</option>
            <option value="saude" ${qualityFilters.categorySlug === 'saude' ? 'selected' : ''}>⚕️ Saúde e Suplementos</option>
            <option value="pet-shop" ${qualityFilters.categorySlug === 'pet-shop' ? 'selected' : ''}>🐶 Pet Shop e Animais</option>
            <option value="livros" ${qualityFilters.categorySlug === 'livros' ? 'selected' : ''}>📚 Livros e Revistas</option>
          </select>
        </div>

        <!-- Sort Order Selector -->
        <div>
          <span class="am-label">Ordenar Resultados Por</span>
          <select id="am-modal-sort" class="am-select">
            <option value="relevance" ${qualityFilters.sortOrder === 'relevance' ? 'selected' : ''}>🌟 Mais Relevantes</option>
            <option value="sales" ${qualityFilters.sortOrder === 'sales' ? 'selected' : ''}>⭐ Mais Vendidos</option>
            <option value="price_asc" ${qualityFilters.sortOrder === 'price_asc' ? 'selected' : ''}>⬇️ Menor Preço</option>
            <option value="price_desc" ${qualityFilters.sortOrder === 'price_desc' ? 'selected' : ''}>⬆️ Maior Preço</option>
          </select>
        </div>

        <!-- Min Sales Input & Chips -->
        <div>
          <span class="am-label">Mínimo de Vendas</span>
          <input type="number" id="am-modal-minsales" class="am-input" value="${qualityFilters.minSales || ''}" placeholder="Ex: 100" />
          <div class="am-chips-row">
            <button class="am-chip-btn" data-target="modal-minsales" data-val="50">50</button>
            <button class="am-chip-btn" data-target="modal-minsales" data-val="100">100</button>
            <button class="am-chip-btn" data-target="modal-minsales" data-val="250">250</button>
            <button class="am-chip-btn" data-target="modal-minsales" data-val="500">500</button>
            <button class="am-chip-btn" data-target="modal-minsales" data-val="1000">1k</button>
          </div>
        </div>

        <!-- Min Discount Input & Chips -->
        <div>
          <span class="am-label">Desconto Mínimo (%)</span>
          <input type="number" id="am-modal-mindisc" class="am-input" value="${qualityFilters.minDiscount || ''}" placeholder="Ex: 20" />
          <div class="am-chips-row">
            <button class="am-chip-btn" data-target="modal-mindisc" data-val="10">10%</button>
            <button class="am-chip-btn" data-target="modal-mindisc" data-val="20">20%</button>
            <button class="am-chip-btn" data-target="modal-mindisc" data-val="30">30%</button>
            <button class="am-chip-btn" data-target="modal-mindisc" data-val="50">50%</button>
          </div>
        </div>

        <!-- Price & Rating Inputs -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
          <div>
            <span class="am-label">Preço Máx (R$)</span>
            <input type="number" id="am-modal-maxprice" class="am-input" value="${qualityFilters.maxPrice ?? ''}" placeholder="Sem limite" />
          </div>
          <div>
            <span class="am-label">Avaliação Min (★)</span>
            <input type="number" step="0.1" id="am-modal-minrating" class="am-input" value="${qualityFilters.minRating || ''}" placeholder="Ex: 4.5" />
          </div>
        </div>

        <div class="am-check-row">
          <label><input type="checkbox" id="am-modal-chk-nointerest" ${qualityFilters.noInterest ? 'checked' : ''} /> Sem Juros</label>
          <label><input type="checkbox" id="am-modal-chk-freeship" ${qualityFilters.freeShipping ? 'checked' : ''} /> Frete Grátis</label>
        </div>
      </div>

      <div class="am-filter-modal-footer">
        <button id="am-modal-btn-reset" class="am-modal-btn-secondary">Limpar</button>
        <button id="am-modal-btn-apply" class="am-modal-btn-primary">Aplicar Filtros</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.style.display = 'flex';
  bindFilterModalListeners(modal);
}

function bindFilterModalListeners(modal) {
  const closeBtn = modal.querySelector('#am-filter-modal-close');
  if (closeBtn) closeBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); closeFilterModal(); };

  modal.onclick = (e) => {
    if (e.target === modal) closeFilterModal();
  };

  const minSalesInput = modal.querySelector('#am-modal-minsales');
  const minDiscInput = modal.querySelector('#am-modal-mindisc');

  modal.querySelectorAll('.am-chip-btn').forEach(chip => {
    chip.onclick = (e) => {
      e.preventDefault();
      const target = chip.dataset.target;
      const val = chip.dataset.val;
      if (target === 'modal-minsales' && minSalesInput) {
        minSalesInput.value = val;
      } else if (target === 'modal-mindisc' && minDiscInput) {
        minDiscInput.value = val;
      }
    };
  });

  const resetBtn = modal.querySelector('#am-modal-btn-reset');
  if (resetBtn) {
    resetBtn.onclick = (e) => {
      e.preventDefault();
      qualityFilters.categorySlug = '';
      qualityFilters.sortOrder = 'relevance';
      qualityFilters.minSales = 0;
      qualityFilters.minDiscount = 0;
      qualityFilters.maxPrice = null;
      qualityFilters.minRating = 0;
      qualityFilters.noInterest = false;
      qualityFilters.freeShipping = false;
      saveStateToStorage();
      closeFilterModal();
      showToast('🧹 Filtros resetados!');
      reapplyFiltersToMinedList(false);
      renderDraggableOverlay();
    };
  }

  const applyBtn = modal.querySelector('#am-modal-btn-apply');
  if (applyBtn) {
    applyBtn.onclick = (e) => {
      e.preventDefault();
      const catSelect = modal.querySelector('#am-modal-category');
      const sortSelect = modal.querySelector('#am-modal-sort');
      const maxPriceInput = modal.querySelector('#am-modal-maxprice');
      const minRatingInput = modal.querySelector('#am-modal-minrating');
      const noInterestChk = modal.querySelector('#am-modal-chk-nointerest');
      const freeShipChk = modal.querySelector('#am-modal-chk-freeship');

      if (catSelect) qualityFilters.categorySlug = catSelect.value;
      if (sortSelect) qualityFilters.sortOrder = sortSelect.value;
      if (minSalesInput) qualityFilters.minSales = parseInt(minSalesInput.value, 10) || 0;
      if (minDiscInput) qualityFilters.minDiscount = parseFloat(minDiscInput.value) || 0;
      if (maxPriceInput) qualityFilters.maxPrice = maxPriceInput.value !== '' ? parseFloat(maxPriceInput.value) : null;
      if (minRatingInput) qualityFilters.minRating = parseFloat(minRatingInput.value) || 0;
      if (noInterestChk) qualityFilters.noInterest = !!noInterestChk.checked;
      if (freeShipChk) qualityFilters.freeShipping = !!freeShipChk.checked;

      saveStateToStorage();
      closeFilterModal();
      showToast('✅ Filtros aplicados com sucesso!');
      reapplyFiltersToMinedList(false);
      renderDraggableOverlay();
    };
  }
}

/* ═══════════════════════════════════════
   4. DRAGGABLE HELPER
   ═══════════════════════════════════════ */
function makeElementDraggable(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  const getHandle = () => elmnt.querySelector('#am-drag-handle') || elmnt;

  elmnt.addEventListener('mousedown', (e) => {
    const handle = getHandle();
    if (!handle.contains(e.target)) return;
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.closest('button')) return;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
    document.onmousemove = (ev) => {
      ev.preventDefault();
      pos1 = pos3 - ev.clientX;
      pos2 = pos4 - ev.clientY;
      pos3 = ev.clientX;
      pos4 = ev.clientY;
      elmnt.style.top = (elmnt.offsetTop - pos2) + 'px';
      elmnt.style.left = (elmnt.offsetLeft - pos1) + 'px';
      elmnt.style.right = 'auto';
    };
  });
}

function getProductCardSelectors() {
  return [
    // Mercado Livre
    '.ui-search-result__wrapper',
    'li.ui-search-layout__item',
    '.poly-card',
    '.ui-search-result',
    // Shopee
    '.shopee-search-item-result__item',
    'ul.shopee-search-item-result__items > li',
    'div[data-sqe="item"]',
    'div.col-sp-2-4',
    '.shopee-item-card',
    'div[class*="shopee-item-card"]',
    // Amazon
    'div[data-component-type="s-search-result"]',
    'div[data-asin]:not([data-asin=""])',
    '.s-result-item',
    'div[class*="s-result-item"]',
    // TikTok Shop
    'div[class*="ProductCard"]',
    'div[class*="product-card"]',
    'div[class*="ProductItem"]',
    'div[class*="product-item"]',
    'div[class*="RecommendItem"]',
    'div[class*="CardContainer"]',
    'div[class*="CardWrap"]',
    'div[class*="product_card"]',
    'div[class*="product-list-item"]',
    'div[class*="DivCard"]',
    '[data-testid*="product"]',
    // Shein & AliExpress & Others
    'div[class*="search-result-item"]',
    '.goods-item',
    '.product-item'
  ];
}

/* ═══════════════════════════════════════
   5. HIGHLIGHTING & INJECTED CARD BUTTONS
   ═══════════════════════════════════════ */
function updatePageHighlighting() {
  if (!extActive) {
    document.querySelectorAll('.am-highlight-border').forEach((card) => {
      card.classList.remove('am-highlight-border');
      const b = card.querySelector('.am-card-mine-btn');
      if (b) b.remove();
    });
    return;
  }

  const rawCards = document.querySelectorAll(getProductCardSelectors().join(', '));
  rawCards.forEach((card) => {
    // Evitar destacar containers internos se um pai já estiver destacado
    if (card.closest('.am-highlight-border') && !card.classList.contains('am-highlight-border')) {
      return;
    }

    card.classList.add('am-highlight-border');

    if (!card.querySelector('.am-card-mine-btn')) {
      const btn = document.createElement('button');
      btn.className = 'am-card-mine-btn';
      btn.innerHTML = `⚡ Minerar`;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const success = mineCardProduct(card, true);
        if (success !== false) {
          btn.innerHTML = `✅ Minerado!`;
          btn.classList.add('mined-success');
          setTimeout(() => {
            btn.innerHTML = `⚡ Minerar`;
            btn.classList.remove('mined-success');
          }, 2500);
        }
      };
      card.appendChild(btn);
    }
  });
}

/* ═══════════════════════════════════════
   6. PDP BUTTON WATCHER
   ═══════════════════════════════════════ */
function startPdpButtonWatcher() {
  if (pdpCheckInterval) clearInterval(pdpCheckInterval);
  pdpCheckInterval = setInterval(() => {
    if (!extActive) return;
    const buyContainer = document.querySelector(
      '#buyNow_feature_div, #buy-now-button, #submit.buy-now, input[name="submit.buy-now"], ' +
      '#buyNow, [data-action="buy-now"], ' +
      '.ui-pdp-actions, .buy-box, .shopee-buy-button-box, #buyBox, ' +
      '#rightCol, #centerCol, .ui-pdp-container__row--right, .ui-pdp-actions__container, ' +
      '[data-testid="buy-box"], form.ui-pdp-actions, .ui-pdp-price__buy, ' +
      'div[class*="page-product"], div[class*="product-briefing"], div[class*="purchase-box"], ' +
      '#add-to-cart-button, #corePrice_feature_div, ' +
      'div[class*="buy-bar"], div[class*="action-bar"], button[class*="buy"]'
    );
    if (buyContainer && !document.getElementById('btn-injected-mine-pdp')) {
      injectPdpButton(buyContainer);
    }
    updatePageHighlighting();
  }, 1000);
}

function injectPdpButton(buyContainer) {
  if (!extActive || document.getElementById('btn-injected-mine-pdp')) return;
  const btn = document.createElement('button');
  btn.id = 'btn-injected-mine-pdp';
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    <span>⛏ Minerar Este Produto</span>
  `;
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    mineCurrentPageProduct(true);
  };

  // Specific Amazon / Buy Now placement logic:
  const buyNowTarget = document.querySelector(
    '#buy-now-button, #buyNow_feature_div, #buyNow, input[name="submit.buy-now"], ' +
    '#submit.buy-now, [data-action="buy-now"], .shopee-buy-button-box, .ui-pdp-actions__button--buy'
  );

  if (buyNowTarget && buyNowTarget.parentNode) {
    if (buyNowTarget.nextSibling) {
      buyNowTarget.parentNode.insertBefore(btn, buyNowTarget.nextSibling);
    } else {
      buyNowTarget.parentNode.appendChild(btn);
    }
  } else if (buyContainer) {
    buyContainer.appendChild(btn);
  }
}

/* ═══════════════════════════════════════
   7. EXTRACTION ENGINE & ADVANCED MULTI-STRATEGY PARSER
   ═══════════════════════════════════════ */
function showToast(message, isError = false) {
  let toast = document.getElementById('am-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'am-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  if (isError) {
    toast.classList.add('error-toast');
  } else {
    toast.classList.remove('error-toast');
  }
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function extractAndesPrice(container) {
  if (!container) return 0;

  const fractionEl = container.querySelector('.andes-money-amount__fraction, .a-price-whole');
  if (fractionEl) {
    const intPart = parseInt(fractionEl.textContent.replace(/\./g, '').replace(/,/g, ''), 10) || 0;
    const centsEl = container.querySelector('.andes-money-amount__cents, .a-price-fraction');
    if (centsEl) {
      const centsText = centsEl.textContent.replace(/\D/g, '');
      const cents = parseInt(centsText, 10) || 0;
      return intPart + (cents / 100);
    }
    return intPart;
  }

  const raw = (container.textContent || '').trim();
  if (/%/.test(raw)) return 0;

  // Clean currency symbols and spaces
  let cleaned = raw.replace(/[R$\s]+/g, '').replace(/\u00A0/g, '').trim();

  // Match comma as decimal (BRL format: 1.234,56 or 234,56)
  const mBrl = cleaned.match(/(\d[\d.]*),(\d{2})/);
  if (mBrl) return parseFloat(mBrl[1].replace(/\./g, '') + '.' + mBrl[2]);

  // Match dot as decimal (USD format: 1,234.56 or 234.56)
  const mUsd = cleaned.match(/(\d[\d,]*)\.(\d{2})/);
  if (mUsd) return parseFloat(mUsd[1].replace(/,/g, '') + '.' + mUsd[2]);

  // Match simple numbers with no decimals
  const mSimple = cleaned.match(/^(\d[\d.]*)$/);
  if (mSimple) return parseFloat(mSimple[1].replace(/\./g, ''));

  const mSimpleComma = cleaned.match(/^(\d[\d,]*)$/);
  if (mSimpleComma) return parseFloat(mSimpleComma[1].replace(/,/g, ''));

  // General regex search for price-like structures
  const mGeneral = cleaned.match(/(\d+[\d.,]*)/);
  if (mGeneral) {
    let priceStr = mGeneral[1];
    if (priceStr.includes(',') && priceStr.includes('.')) {
      if (priceStr.indexOf('.') < priceStr.indexOf(',')) {
        return parseFloat(priceStr.replace(/\./g, '').replace(',', '.'));
      } else {
        return parseFloat(priceStr.replace(/,/g, ''));
      }
    } else if (priceStr.includes(',')) {
      const parts = priceStr.split(',');
      if (parts[parts.length - 1].length === 2) {
        return parseFloat(priceStr.replace(',', '.'));
      } else {
        return parseFloat(priceStr.replace(/,/g, ''));
      }
    } else if (priceStr.includes('.')) {
      const parts = priceStr.split('.');
      if (parts[parts.length - 1].length === 2) {
        return parseFloat(priceStr);
      } else {
        return parseFloat(priceStr.replace(/\./g, ''));
      }
    }
    return parseFloat(priceStr) || 0;
  }

  return 0;
}

function extractRealProductData(element) {
  try {
    let title = '', pixPrice = 0, oldPrice = 0, discountPercent = 0;
    let rating = 0, sales = 0, freeShipping = false, noInterest = false;
    let image = '', link = window.location.href;
    let coupon = null, installments = null, description = null, pixExplicit = 0, category = null;
    let pictures = [];
    const id = 'prod_' + Date.now() + '_' + Math.floor(Math.random() * 9999);

    if (element) {
      const scopeEl = element.closest(
        'li.ui-search-layout__item, .ui-search-layout__item, .ui-search-result__wrapper, ' +
        '.poly-card, [data-sqe="item"], .shopee-search-item-result__item, ' +
        '[data-component-type="s-search-result"], div[data-asin], li, article'
      ) || element;
      const cardText = scopeEl.textContent || element.textContent || '';
      const platform = getPlatformKey();

      // Platform-specific listing card pre-parsing
      if (platform === 'shopee') {
        const shopeeTitle = element.querySelector('.shopee-search-item-result__name, div[data-sqe="name"], div[class*="product-name"], div[class*="name" i], .shopee-item-card__name');
        if (shopeeTitle) title = shopeeTitle.textContent.trim();
        
        const shopeePriceEl = element.querySelector('div[class*="price-after-discount" i], div[class*="current-price" i], div[class*="Price__price" i], [class*="price" i] span, [class*="price" i]');
        if (shopeePriceEl) pixPrice = extractAndesPrice(shopeePriceEl);
        
        const shopeeOldPriceEl = element.querySelector('div[class*="price-before-discount" i], .shopee-item-card__original-price, del');
        if (shopeeOldPriceEl) oldPrice = extractAndesPrice(shopeeOldPriceEl);
        
        const shopeeSalesEl = element.querySelector('div[class*="sold" i], div[class*="vendas" i], div[class*="sold-count" i], [class*="sold" i]');
        if (shopeeSalesEl) sales = parseSalesCount(shopeeSalesEl.textContent);
        
        const shopeeImg = element.querySelector('img');
        if (shopeeImg) image = shopeeImg.src || shopeeImg.dataset.src || '';
      } 
      else if (platform === 'amazon') {
        const amzTitle = element.querySelector('h2 a span, span.a-text-normal, [data-cy="title-recipe"] h2 span, h2 span, h3 span');
        if (amzTitle) title = amzTitle.textContent.trim();
        
        const amzPriceEl = element.querySelector('.a-price .a-offscreen, span.a-price, span.a-color-price');
        if (amzPriceEl) pixPrice = extractAndesPrice(amzPriceEl);
        
        const amzOldPriceEl = element.querySelector('span.a-text-strike, .a-price.a-text-price .a-offscreen');
        if (amzOldPriceEl) oldPrice = extractAndesPrice(amzOldPriceEl);
        
        const amzSalesEl = element.querySelector('span.a-size-small.a-color-secondary, [class*="social-proofing" i]');
        if (amzSalesEl) sales = parseSalesCount(amzSalesEl.textContent);
        
        const amzImg = element.querySelector('img.s-image, img');
        if (amzImg) image = amzImg.src || amzImg.dataset.src || '';
      }
      else if (platform === 'tiktok') {
        const ttTitle = element.querySelector('div[class*="ProductTitle" i], p[class*="title" i], div[class*="product-title" i], [class*="title" i]');
        if (ttTitle) title = ttTitle.textContent.trim();
        
        const ttPriceEl = element.querySelector('div[class*="Price" i], span[class*="price" i], [class*="price" i]');
        if (ttPriceEl) pixPrice = extractAndesPrice(ttPriceEl);
        
        const ttOldPriceEl = element.querySelector('span[class*="PriceBefore" i], span[class*="OriginalPrice" i], del');
        if (ttOldPriceEl) oldPrice = extractAndesPrice(ttOldPriceEl);
        
        const ttSalesEl = element.querySelector('div[class*="Sold" i], span[class*="sold" i], div[class*="sales" i]');
        if (ttSalesEl) sales = parseSalesCount(ttSalesEl.textContent);
        
        const ttImg = element.querySelector('img');
        if (ttImg) image = ttImg.src || ttImg.dataset.src || '';
      }

      // 1. Title Extraction Fallback
      if (!title) {
        const titleEl = element.querySelector(
          '.ui-search-item__title, .poly-component__title, [data-sqe="name"], ' +
          '[data-testid="item-title"], .shopee-search-item-result__name, ' +
          '#productTitle, #title, h1#title, h2 a span, span.a-text-normal, [data-cy="title-recipe"] h2 span, h2 span, h2, h3'
        ) || scopeEl.querySelector(
          '.ui-search-item__title, .poly-component__title, [data-sqe="name"], ' +
          '[data-testid="item-title"], .shopee-search-item-result__name, ' +
          '#productTitle, #title, h1#title, h2 a span, span.a-text-normal, [data-cy="title-recipe"] h2 span, h2 span, h2, h3'
        );
        if (titleEl) {
          title = titleEl.textContent.trim();
        } else {
          // Fallbacks for Shopee and Amazon
          const imgAlt = scopeEl.querySelector('img')?.alt || scopeEl.querySelector('img')?.title;
          const linkTitle = scopeEl.querySelector('a[title]')?.getAttribute('title');
          if (imgAlt && imgAlt.length > 5) title = imgAlt.trim();
          else if (linkTitle && linkTitle.length > 5) title = linkTitle.trim();
          else {
            const firstHead = scopeEl.querySelector('h1, h2, h3, a');
            if (firstHead) title = firstHead.textContent.replace(/\s+/g, ' ').trim();
          }
        }
      }
  
      // 2. Old Price Extraction Fallback
      if (!oldPrice) {
        const oldEls = element.querySelectorAll(
          '.poly-price__old, .ui-search-price__part--original, s, del, ' +
          '.a-price.a-text-price .a-offscreen, span.a-text-strike'
        );
        for (const el of oldEls) {
          const p = extractAndesPrice(el);
          if (p > oldPrice) oldPrice = p;
        }
      }
  
      // 3. Current Price Extraction Fallback
      if (!pixPrice) {
        const candidatePrices = [];
        const amountEls = element.querySelectorAll(
          '.andes-money-amount, .a-price .a-offscreen, [class*="price" i]'
        );
        for (const el of amountEls) {
          if (el.closest('.poly-price__old, .ui-search-price__part--original, s, del, ' +
                         '.ui-search-installments, .poly-price__credit-card, [class*="installment" i], ' +
                         '.poly-price__discount, .ui-search-price__discount, [class*="discount" i], ' +
                         '[class*="coupon" i], [class*="cupom" i], [class*="shipping" i], [class*="frete" i]')) continue;
          const txt = (el.textContent || '').toLowerCase();
          if (txt.includes('%') || txt.includes('cupom') || txt.includes('frete')) continue;
          const p = extractAndesPrice(el);
          if (p > 0 && p !== oldPrice) {
            candidatePrices.push(p);
          }
        }
  
        if (candidatePrices.length > 0) {
          pixPrice = Math.min(...candidatePrices);
        } else {
          const currentContainer = element.querySelector(
            '.poly-component__price, .poly-price__current, .ui-search-price__second-line, ' +
            '.a-price, [class*="price" i]'
          );
          pixPrice = extractAndesPrice(currentContainer);
        }
      }
  
      if (pixPrice > oldPrice && oldPrice > 0) {
        const temp = pixPrice;
        pixPrice = oldPrice;
        oldPrice = temp;
      }
  
      // 4. Discount Extraction
      if (oldPrice > pixPrice && pixPrice > 0) {
        discountPercent = Math.round(((oldPrice - pixPrice) / oldPrice) * 100);
      }
  
      if (discountPercent === 0) {
        const discountEl = element.querySelector(
          '.poly-price__discount, .ui-search-price__discount, .savingsPercentage, [class*="discount" i]'
        );
        if (discountEl && !discountEl.textContent.toLowerCase().includes('cupom')) {
          const dm = discountEl.textContent.match(/(\d{1,2})%/);
          if (dm) discountPercent = parseInt(dm[1], 10);
        }
      }
  
      if (discountPercent > 99 || discountPercent < 0) discountPercent = 0;
  
      if (discountPercent > 0 && oldPrice === 0 && pixPrice > 0) {
        oldPrice = parseFloat((pixPrice / (1 - discountPercent / 100)).toFixed(2));
      }
  
      // 5. Rating Extraction Fallback
      if (!rating) {
        const ratingSelectors = [
          '.poly-reviews__rating', '.ui-search-reviews__rating',
          '.shopee-rating-stars', 'i.a-icon-star-small span', 'i.a-icon-star span'
        ];
        for (const sel of ratingSelectors) {
          if (rating > 0) break;
          const el = element.querySelector(sel);
          if (el) {
            const rm = el.textContent.match(/(\d[\.,]\d)/);
            if (rm) rating = parseFloat(rm[1].replace(',', '.'));
          }
        }
  
        if (rating === 0) {
          const rmText = cardText.match(/Classifica[cç][aã]o\s*(\d[\.,]\d)/i)
                      || cardText.match(/(\d[\.,]\d)\s*de\s*5\s*estrelas/i)
                      || cardText.match(/(\d[\.,]\d)\s*out of 5 stars/i)
                      || cardText.match(/(\d[\.,]\d)\s*\|\s*\+?\s*\d/i);
          if (rmText) {
            const val = parseFloat(rmText[1].replace(',', '.'));
            if (val >= 1.0 && val <= 5.0) rating = val;
          }
        }
      }
  
      // 6. Sales Extraction Fallback
      if (!sales) {
        sales = parseSalesCount(cardText);
      }

      // 7. Shipping & Interest
      if (/frete\s*gr[áa]tis|chegar[áa]\s*gr[áa]tis|envio\s*gr[áa]tis|entrega\s*gr[áa]tis|free\s*shipping/i.test(cardText)) freeShipping = true;
      if (cardText.toLowerCase().includes('sem juros') || cardText.toLowerCase().includes('sem juro')) noInterest = true;

      // 8. Image & Link
      const imgEl = element.querySelector('img');
      if (imgEl) image = imgEl.src || imgEl.dataset.src || imgEl.srcset?.split(' ')[0] || '';

      const linkEl = element.querySelector('a[href]');
      if (linkEl) link = linkEl.href;

      installments = extractInstallmentsText(cardText);
      coupon       = extractCouponText(element, cardText);
      pixExplicit  = extractPixPriceNum(cardText, 0);
      category     = extractCategoryText();
    } else {
      // Single PDP Extraction (Product Detail Page)
      const platform = getPlatformKey();
      
      if (platform === 'shopee') {
        const shopeeTitle = document.querySelector('div[class*="product-title" i], .product-briefing h1, div[class*="ProductTitle" i], h1');
        if (shopeeTitle) title = shopeeTitle.textContent.trim();
        
        const shopeePriceEl = document.querySelector('div[class*="price" i], span[class*="price" i], div[class*="ProductPrice" i], .shopee-product-detail .price');
        if (shopeePriceEl) pixPrice = extractAndesPrice(shopeePriceEl);
        
        const shopeeOldPriceEl = document.querySelector('div[class*="price-before-discount" i], del, .shopee-product-detail del');
        if (shopeeOldPriceEl) oldPrice = extractAndesPrice(shopeeOldPriceEl);
        
        const shopeeSalesEl = document.querySelector('div[class*="sold" i], span[class*="sold" i], div[class*="sales" i], .shopee-product-detail .sales-count');
        if (shopeeSalesEl) sales = parseSalesCount(shopeeSalesEl.textContent);
      }
      else if (platform === 'amazon') {
        const amzTitle = document.querySelector('span#productTitle, #title');
        if (amzTitle) title = amzTitle.textContent.trim();
        
        const amzPriceEl = document.querySelector('#price_inside_buybox, .a-price .a-offscreen, #corePrice_feature_div .a-offscreen');
        if (amzPriceEl) pixPrice = extractAndesPrice(amzPriceEl);
        
        const amzOldPriceEl = document.querySelector('span.a-text-strike, .a-price.a-text-price .a-offscreen');
        if (amzOldPriceEl) oldPrice = extractAndesPrice(amzOldPriceEl);
        
        const amzSalesEl = document.querySelector('span.social-proofing-faceout-title-text span, #averageCustomerReviews_feature_div');
        if (amzSalesEl) sales = parseSalesCount(amzSalesEl.textContent);
      }
      else if (platform === 'tiktok') {
        const ttTitle = document.querySelector('h1[class*="ProductTitle" i], h1, div[class*="Title" i], [data-testid*="product-title" i]');
        if (ttTitle) title = ttTitle.textContent.trim();
        
        const ttPriceEl = document.querySelector('div[class*="Price" i], span[class*="price" i], [data-testid*="product-price" i]');
        if (ttPriceEl) pixPrice = extractAndesPrice(ttPriceEl);
        
        const ttOldPriceEl = document.querySelector('span[class*="PriceBefore" i], span[class*="OriginalPrice" i], del');
        if (ttOldPriceEl) oldPrice = extractAndesPrice(ttOldPriceEl);
        
        const ttSalesEl = document.querySelector('div[class*="Sold" i], span[class*="sold" i], div[class*="sales" i]');
        if (ttSalesEl) sales = parseSalesCount(ttSalesEl.textContent);
      }

      // 1. PDP Title Fallback
      if (!title) {
        const titleEl = document.querySelector(
          '.ui-pdp-title, #productTitle, h1.title, .product-title, ' +
          '[data-pl="product-title"], [data-sqe="name"], h1'
        );
        if (titleEl) title = titleEl.textContent.trim();
      }
  
      // 2. PDP Old Price Fallback
      if (!oldPrice) {
        const pdpOldContainer = document.querySelector('.ui-pdp-price__part--original, .a-price.a-text-price, s, del');
        oldPrice = extractAndesPrice(pdpOldContainer);
      }
  
      // 3. PDP Current Price Fallback
      if (!pixPrice) {
        const pdpCandidatePrices = [];
        const pdpAmountEls = document.querySelectorAll(
          '.ui-pdp-price__part--medium .andes-money-amount, .a-price .a-offscreen, .ui-pdp-price__second-line .andes-money-amount'
        );
        for (const el of pdpAmountEls) {
          if (el.closest('.ui-pdp-price__part--original, s, del, .ui-pdp-price__subtitles, [class*="installments" i]')) continue;
          if ((el.textContent || '').includes('%')) continue;
          const p = extractAndesPrice(el);
          if (p > 0 && p !== oldPrice) pdpCandidatePrices.push(p);
        }
  
        if (pdpCandidatePrices.length > 0) {
          pixPrice = Math.min(...pdpCandidatePrices);
        } else {
          const pdpCurrentContainer = document.querySelector('.ui-pdp-price__part--medium, .a-price, .ui-pdp-price__second-line');
          pixPrice = extractAndesPrice(pdpCurrentContainer);
        }
      }
  
      if (pixPrice > oldPrice && oldPrice > 0) {
        const temp = pixPrice;
        pixPrice = oldPrice;
        oldPrice = temp;
      }
  
      if (oldPrice > pixPrice && pixPrice > 0) {
        discountPercent = Math.round(((oldPrice - pixPrice) / oldPrice) * 100);
      }
  
      // 4. Rating Fallback
      if (!rating) {
        const ratingEl = document.querySelector('.ui-pdp-review__rating, .ui-pdp-reviews__rating, .shopee-rating-stars, i.a-icon-star span');
        if (ratingEl) {
          const rm = ratingEl.textContent.match(/\d+[\.,]?\d*/);
          if (rm) rating = parseFloat(rm[0].replace(',', '.'));
        }
      }
  
      const bodyText = document.body.textContent;
      
      // 5. Sales Fallback
      if (!sales) {
        sales = parseSalesCount(bodyText);
      }
  
      if (/frete\s*gr[áa]tis|chegar[áa]\s*gr[áa]tis|envio\s*gr[áa]tis|entrega\s*gr[áa]tis|free\s*shipping/i.test(bodyText)) freeShipping = true;
      if (bodyText.toLowerCase().includes('sem juros')) noInterest = true;
  
      // Extract All Main & Gallery Pictures on PDP
      const imgNodes = document.querySelectorAll(
        '.ui-pdp-gallery__figure img, #gallery img, #landingImage, #imgTagWrapperId img, ' +
        '.product-briefing img, #altImages img, .crop-image-container img, .main-swiper img, ' +
        'div[class*="product-image" i] img, .picture-wrapper img, img[class*="Gallery" i], ' +
        'div[class*="ImageContainer" i] img, img[src*="tiktokcdn" i], img[src*="shopee.com" i]'
      );
      imgNodes.forEach(n => {
        const src = n.src || n.dataset.src;
        if (src && !src.includes('data:image') && !pictures.includes(src)) {
          pictures.push(src);
        }
      });
  
      if (pictures.length > 0) image = pictures[0];
      if (!image) {
        const ogImg = document.querySelector('meta[property="og:image"]');
        if (ogImg) image = ogImg.getAttribute('content') || '';
      }
  
      installments = extractInstallmentsText(bodyText);
      coupon       = extractCouponText(document, bodyText);
      pixExplicit  = extractPixPriceNum(bodyText, 0);
      description  = extractDescriptionText();
      category     = extractCategoryText();
    }

    if (image && !pictures.includes(image)) pictures.unshift(image);

    return {
      id, title, pixPrice, oldPrice, discountPercent,
      rating, sales, freeShipping, noInterest,
      image, link,
      marketplace: getMarketplaceName(),
      timestamp: Date.now(),

      platform:     getPlatformKey(),
      original_link:cleanLinkUrl(link),
      image_url:    image || null,
      pictures:     pictures.length ? pictures : (image ? [image] : []),
      price_to:     numToAppPrice(pixPrice),
      price_from:   oldPrice > 0 ? numToAppPrice(oldPrice) : null,
      pix_price:    pixExplicit > 0 ? numToAppPrice(pixExplicit)
                     : (pixPrice > 0 ? numToAppPrice(pixPrice) : null),
      installments: installments,
      installments_interest_free: !!(installments && /sem\s*juros/i.test(installments)),
      coupon:       coupon,
      shipping:     freeShipping ? 'Frete grátis' : null,
      free_shipping:!!freeShipping,
      stars:        rating > 0 ? String(rating) : null,
      sales_count:  sales > 0 ? (sales >= 1000 ? `${(sales/1000).toFixed(1).replace('.', ',')}k` : String(sales)) : null,
      discount_pct: discountPercent > 0 ? discountPercent : null,
      description:  description,
      category:     category,
      extractedAt:  new Date().toISOString(),
    };
  } catch (err) {
    handleGlobalError(err, 'Parsing de Produto');
    return null;
  }
}

/* ── Helpers de Formatação e Leitura ── */

function getPlatformKey() {
  const host = window.location.hostname;
  if (host.includes('mercadolivre') || host.includes('mercadolibre')) return 'mercadolivre';
  if (host.includes('shopee'))    return 'shopee';
  if (host.includes('amazon'))    return 'amazon';
  if (host.includes('aliexpress'))return 'aliexpress';
  if (host.includes('shein'))     return 'shein';
  if (host.includes('tiktok'))    return 'tiktok';
  return 'mercadolivre';
}

function cleanLinkUrl(url) {
  try {
    const u = new URL(url);
    ['tracking_id','tag','smtt','aff_id','url_from','affiliate_id',
     'utm_source','utm_medium','utm_campaign'].forEach(p => u.searchParams.delete(p));
    if (u.hash.startsWith('#D[')) u.hash = '';
    return u.toString();
  } catch { return url; }
}

function numToAppPrice(num) {
  if (!num || num <= 0) return '';
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

function parseSalesCount(text) {
  if (!text) return 0;
  const t = String(text).replace(/ /g, ' ').replace(/\n/g, ' ');

  const reList = [
    /(\d+(?:[\.,]\d+)?)\s*(mil|k)\+?\s*(?:produtos?\s*)?(?:vendidos?|comprados?|compras?|vendido|sold|bought)/i,
    /(?:vendidos?|comprados?|sold|bought|compras?)\s*:?\s*(\d+(?:[\.,]\d+)?)\s*(mil|k)?/i,
    /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(mil|k)?\s*\+?\s*(?:produtos?\s*)?(?:vendidos?|comprados?|compras?|vendido|sold|bought)/i,
    /(\d+(?:[\.,]\d+)?)\s*(mil|k)\+/i,
    /(\d+)\+?\s*(?:vendido|comprado|sold|bought)/i,
    /(\d+(?:[\.,]\d+)?)\s*(?:mil|k)?\+?\s*(?:vendido|comprado|sold|bought|comprados no último mês|bought in past month)/i
  ];

  for (const re of reList) {
    const m = t.match(re);
    if (m) {
      let rawNumStr = m[1] || '0';
      const hasKOrMil = !!m[2] && /mil|k/i.test(m[2]);

      if (hasKOrMil) {
        rawNumStr = rawNumStr.replace(',', '.');
        let num = parseFloat(rawNumStr);
        if (!isNaN(num) && num > 0) return Math.round(num * 1000);
      } else {
        const intPart = rawNumStr.replace(/\./g, '');
        const decPart = m[2] && !hasKOrMil ? '.' + m[2] : '';
        let num = parseFloat(intPart + decPart);
        if (!isNaN(num) && num > 0) {
          if (m[3] && /mil|k/i.test(m[3])) num *= 1000;
          return Math.round(num);
        }
      }
    }
  }
  return 0;
}

function extractInstallmentsText(scopeText) {
  if (!scopeText) return null;
  const semJuros = scopeText.match(/(?:em\s*at[ée]\s*)?(\d{1,2})\s*x\s*(?:de\s*)?R\$\s*([\d.]+,\d{2})\s*sem\s*juros/i);
  if (semJuros) return `${semJuros[1]}x de R$ ${semJuros[2]} sem juros`;
  const qualquer = scopeText.match(/(?:em\s*at[ée]\s*)?(\d{1,2})\s*x\s*(?:de\s*)?R\$\s*([\d.]+,\d{2})/i);
  if (qualquer) return `${qualquer[1]}x de R$ ${qualquer[2]}`;
  return null;
}

function extractCouponText(scope, scopeText) {
  try {
    if (scope && scope.querySelector) {
      const badge = scope.querySelector(
        '#couponBadge, .couponBadge, .vpc-coupon-badge, [class*="coupon" i], [class*="cupom" i], [class*="voucher" i]'
      );
      if (badge) {
        const t = (badge.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length <= 50) return t;
      }
    }
  } catch (_) {}
  if (scopeText) {
    const m = scopeText.match(/(R\$\s*[\d.,]+\s*com\s*cupom(?:[^\n,.]{0,20})?)/i)
           || scopeText.match(/(cupom\s*de\s*R\$\s*[\d.,]+)/i)
           || scopeText.match(/cupom[:\s]*([A-Z0-9]{4,15})/i)
           || scopeText.match(/c[óo]digo[:\s]*([A-Z0-9]{4,15})/i);
    if (m) return m[1].trim();
  }
  return null;
}

function extractPixPriceNum(scopeText, fallback) {
  if (scopeText) {
    const m = scopeText.match(/R\$\s*([\d.]+,\d{2})\s*(?:no\s*)?pix/i)
           || scopeText.match(/pix[:\s]*R\$\s*([\d.]+,\d{2})/i);
    if (m) {
      const v = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      if (v > 0) return v;
    }
  }
  return fallback || 0;
}

function extractCategoryText() {
  const crumbSel = [
    '.andes-breadcrumb__item', '.ui-pdp-breadcrumb a', '[typeof="BreadcrumbList"] a',
    '.a-breadcrumb .a-list-item', '#wayfinding-breadcrumbs_container a', '#nav-subnav a',
    'nav[aria-label*="readcrumb" i] a', '.breadcrumb a', '.page-product__breadcrumb a',
    '.shopee-breadcrumb a', 'a.page-product__breadcrumb-item', '._249C03',
    '.breadcrumb-item', '[data-testid="breadcrumb"] a'
  ];
  const nodes = document.querySelectorAll(crumbSel.join(', '));
  const parts = [];
  nodes.forEach(n => {
    const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
    if (t && !/^(in[íi]cio|home|voltar|todas as categorias|p[aá]gina inicial)$/i.test(t) && t.length <= 50) {
      parts.push(t);
    }
  });
  if (parts.length) return parts[parts.length - 1].slice(0, 60);

  // Fallback 1: Check page title or URL
  const metaCategory = document.querySelector('meta[name="keywords"], meta[property="product:category"]');
  if (metaCategory) {
    const content = metaCategory.getAttribute('content') || '';
    if (content) {
      const kw = content.split(',')[0].trim();
      if (kw && kw.length <= 50) return kw.slice(0, 60);
    }
  }

  // Fallback 2: Check URL path for category hints
  const path = window.location.pathname.toLowerCase();
  if (path.includes('moda') || path.includes('roupa') || path.includes('calcado')) return 'Moda & Vestuário';
  if (path.includes('beleza') || path.includes('maquiagem') || path.includes('cosmetico')) return 'Beleza & Cuidados Pessoais';
  if (path.includes('casa') || path.includes('decoracao') || path.includes('cozinha')) return 'Casa & Decoração';
  if (path.includes('eletronico') || path.includes('audio') || path.includes('tv')) return 'Eletrônicos';
  if (path.includes('celular') || path.includes('smartphone')) return 'Celulares';
  if (path.includes('esporte') || path.includes('fitness')) return 'Esportes & Lazer';
  if (path.includes('brinquedo') || path.includes('bebe')) return 'Brinquedos & Bebês';

  return null;
}

function extractDescriptionText() {
  let desc = '';
  const meta = document.querySelector('meta[property="og:description"], meta[name="description"]');
  if (meta) desc = (meta.getAttribute('content') || '').trim();
  const sel = document.querySelector(
    '.ui-pdp-description__content, #productDescription, #feature-bullets, ' +
    '.product-description, [class*="description" i]'
  );
  if (sel) {
    const t = (sel.textContent || '').replace(/\s+/g, ' ').trim();
    if (t.length > desc.length) desc = t;
  }
  return desc ? desc.slice(0, 1200) : null;
}

function getMarketplaceName() {
  const host = window.location.hostname;
  if (host.includes('mercadolivre') || host.includes('mercadolibre')) return 'Mercado Livre';
  if (host.includes('shopee')) return 'Shopee';
  if (host.includes('amazon')) return 'Amazon';
  if (host.includes('shein')) return 'Shein';
  if (host.includes('aliexpress')) return 'AliExpress';
  if (host.includes('tiktok')) return 'TikTok Shop';
  return 'E-commerce';
}

async function enrichProductDataInBackground(product) {
  if (!product || !product.link || product.link === window.location.href) return product;
  if (product.sales > 0 && product.rating > 0 && product.discountPercent > 0) return product;

  try {
    const res = await fetch(product.link, { credentials: 'omit' });
    const htmlText = await res.text();
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');

    if (product.rating === 0) {
      const rEl = doc.querySelector('.ui-pdp-review__rating, .ui-pdp-reviews__rating, .shopee-rating-stars');
      if (rEl) {
        const rm = rEl.textContent.match(/\d+[\.,]?\d*/);
        if (rm) product.rating = parseFloat(rm[0].replace(',', '.'));
      }
    }

    if (product.sales === 0 && doc.body) {
      const v = parseSalesCount(doc.body.textContent);
      if (v > 0) product.sales = v;
    }
  } catch (e) {}
  return product;
}

/* ═══════════════════════════════════════
   8. SMART FILTERING ENGINE
   ═══════════════════════════════════════ */
function filterRejectReason(product) {
  const f = qualityFilters || {};
  const num = (v) => (typeof v === 'number' ? v : parseFloat(v)) || 0;

  if (f.selectedMarketplaces) {
    const hasAnyChecked = Object.values(f.selectedMarketplaces).some(v => v === true);
    if (hasAnyChecked) {
      const pKey = getPlatformKey();
      const mktKeyMap = {
        mercadolivre: 'ml',
        shopee: 'shopee',
        amazon: 'amazon',
        shein: 'shein',
        aliexpress: 'aliexpress',
        tiktok: 'tiktok'
      };
      const targetKey = mktKeyMap[pKey] || pKey;
      if (!f.selectedMarketplaces[targetKey]) {
        return `plataforma ${getMarketplaceName()} desativada nos filtros`;
      }
    }
  }

  const sales    = num(product.sales);
  const discount = num(product.discountPercent != null ? product.discountPercent : product.discount_pct);
  const rating   = num(product.rating != null ? product.rating : product.stars);
  const price    = num(product.pixPrice);

  if (f.category && String(f.category).trim() !== '') {
    const kw = String(f.category).toLowerCase().trim();
    if (!String(product.title || '').toLowerCase().includes(kw)) return `palavra-chave "${f.category}"`;
  }
  if (f.minPrice > 0) {
    if (!(price > 0)) return 'preço não identificado';
    if (price < f.minPrice) return `preço R$ ${price} < mín. R$ ${f.minPrice}`;
  }
  if (f.maxPrice > 0) {
    if (!(price > 0)) return 'preço não identificado';
    if (price > f.maxPrice) return `preço R$ ${price} > máx. R$ ${f.maxPrice}`;
  }
  if (f.minDiscount > 0) {
    if (!(discount > 0)) return `sem desconto (mín. ${f.minDiscount}%)`;
    if (discount < f.minDiscount) return `desconto ${discount}% < mín. ${f.minDiscount}%`;
  }
  if (f.minRating > 0) {
    if (!(rating > 0)) return `sem avaliação (mín. ${f.minRating}★)`;
    if (rating < f.minRating) return `avaliação ${rating}★ < mín. ${f.minRating}★`;
  }
  if (f.minSales > 0) {
    if (!(sales > 0)) return `sem nº de vendas (mín. ${f.minSales})`;
    if (sales < f.minSales) return `vendas ${sales} < mín. ${f.minSales}`;
  }
  if (f.freeShipping && !(product.freeShipping || product.free_shipping)) return 'exige Frete Grátis';
  if (f.noInterest && !product.noInterest) return 'exige Sem Juros';

  return null;
}

function reapplyFiltersToMinedList(silent) {
  if (!minedProducts.length) return;
  const kept = [];
  let removed = 0;
  for (const p of minedProducts) {
    if (filterRejectReason(p)) removed++;
    else kept.push(p);
  }
  if (removed > 0) {
    minedProducts = kept;
    discardedCount += removed;
    saveStateToStorage();
    renderDraggableOverlay();
    if (!silent) showToast(`🧹 ${removed} produto(s) removido(s) por não atender aos filtros`);
  }
}

let reapplyTimer = null;
function scheduleReapply() {
  clearTimeout(reapplyTimer);
  reapplyTimer = setTimeout(() => reapplyFiltersToMinedList(false), 900);
}

async function processAndFilterProduct(product, manual = false) {
  if (!product || !product.title) {
    if (manual) showToast('❌ Erro ao extrair dados do produto. Tente novamente.', true);
    return false;
  }

  product = await enrichProductDataInBackground(product);

  // CRITICAL REQUIREMENT: Se for clique MANUAL (manual = true), BYPASS nos filtros de qualidade!
  if (!manual) {
    const reason = filterRejectReason(product);
    if (reason) {
      discardedCount++;
      saveStateToStorage();
      renderDraggableOverlay();
      return false;
    }
  }

  // Duplicate Check
  const isDuplicate = minedProducts.some(
    (p) => p.title === product.title || (p.link && product.link && cleanLinkUrl(p.link) === cleanLinkUrl(product.link))
  );

  if (isDuplicate) {
    if (manual) showToast('⚠️ Produto já está na lista de minerados!');
    return false;
  }

  minedProducts.push(product);
  saveStateToStorage();
  renderDraggableOverlay();
  showToast('✅ Produto minerado com sucesso!');
  return true;
}

function mineCurrentPageProduct(manual = true) {
  const prod = extractRealProductData(null);
  if (prod) {
    processAndFilterProduct(prod, manual);
  } else {
    showToast('❌ Erro ao minerar produto nesta página.', true);
  }
}

function mineCardProduct(card, manual = false) {
  const prod = extractRealProductData(card);
  if (prod) {
    return processAndFilterProduct(prod, manual);
  } else {
    if (manual) showToast('❌ Erro ao extrair produto do card.', true);
    return false;
  }
}

/* ═══════════════════════════════════════
   9. AUTO-SCROLL & PAGINATION ENGINE
   ═══════════════════════════════════════ */
function goToNextPage() {
  const platform = getPlatformKey();
  let nextEl = null;

  if (platform === 'mercadolivre') {
    nextEl = document.querySelector(
      '.andes-pagination__button--next a, a.andes-pagination__link[title*="Próxim"], ' +
      'a.andes-pagination__link[title*="Siguiente"], .ui-search-pagination__next a'
    );
  } else if (platform === 'shopee') {
    nextEl = document.querySelector(
      '.shopee-icon-button--right, button.shopee-button-no-outline--right, ' +
      '[class*="pagination"] button:last-child, .shopee-page-controller__next-btn'
    );
  } else if (platform === 'amazon') {
    nextEl = document.querySelector(
      'a.s-pagination-next, .s-pagination-item.s-pagination-next, ' +
      'a#pagnNextLink, a[class*="pagination-next"]'
    );
  } else if (platform === 'aliexpress') {
    nextEl = document.querySelector('.comet-pagination-next, .next-pagination-item.next');
  } else if (platform === 'shein') {
    nextEl = document.querySelector('.s-pagination-next, a.page-next');
  } else if (platform === 'tiktok') {
    nextEl = document.querySelector('button[aria-label*="Next" i], [class*="pagination"] button:last-child');
  }

  if (!nextEl) {
    nextEl = document.querySelector(
      'a[title*="Próxim" i], button[aria-label*="Próxim" i], ' +
      'a[aria-label*="Next" i], button[aria-label*="Next" i], ' +
      '.pagination-next a, [class*="pagination"] [class*="next"]'
    );
  }

  if (nextEl) {
    if (nextEl.href && nextEl.tagName === 'A') {
      showToast('📄 Avançando para a próxima página de produtos...');
      window.location.href = nextEl.href;
      return true;
    } else if (typeof nextEl.click === 'function') {
      showToast('📄 Avançando para a próxima página de produtos...');
      nextEl.click();
      return true;
    }
  }

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('page')) {
      const curPage = parseInt(url.searchParams.get('page'), 10) || 1;
      url.searchParams.set('page', String(curPage + 1));
      showToast(`📄 Carregando página ${curPage + 1}...`);
      window.location.href = url.toString();
      return true;
    } else if (platform === 'mercadolivre' && url.pathname.includes('_Desde_')) {
      const m = url.pathname.match(/_Desde_(\d+)/);
      if (m) {
        const offset = parseInt(m[1], 10) + 50;
        const newPath = url.pathname.replace(/_Desde_\d+/, `_Desde_${offset}`);
        showToast('📄 Carregando próxima página...');
        window.location.href = url.origin + newPath + url.search;
        return true;
      }
    }
  } catch (_) {}

  return false;
}

function startAutoMining() {
  reapplyFiltersToMinedList(true);
  if (autoMineInterval) clearInterval(autoMineInterval);

  autoMineInterval = setInterval(() => {
    if (!extActive || !autoMine) return;

    window.scrollBy({ top: 280, behavior: 'smooth' });

    const cards = document.querySelectorAll(getProductCardSelectors().join(', '));
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      if (rect.top >= -80 && rect.bottom <= window.innerHeight + 180) {
        if (!card.dataset.amChecked) {
          card.dataset.amChecked = '1';
          mineCardProduct(card, false); // Auto-mine usa filtros
        }
      }
    });

    // Quando chega ao final da página
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
      showToast('🔄 Fim da página alcançado. Trocando de página...');
      const navigated = goToNextPage();
      if (!navigated) {
        showToast('🏁 Todos os produtos foram minerados! Pausando auto-mineração.');
        autoMine = false;
        saveStateToStorage();
        stopAutoMining();
        renderDraggableOverlay();
      }
    }
  }, 2200);
}

function stopAutoMining() {
  if (autoMineInterval) { clearInterval(autoMineInterval); autoMineInterval = null; }
}

/* ═══════════════════════════════════════
   10. DIAGNOSTIC ERROR MODAL
   ═══════════════════════════════════════ */
function showDiagnosticErrorModal(errLog) {
  let modal = document.getElementById('am-error-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'am-error-modal';
    document.body.appendChild(modal);
  }

  const report = `### ⚠️ Diagnóstico - Affiliate Miner v2.6.2\n**Hora**: ${errLog.time}\n**URL**: ${errLog.url}\n**Contexto**: ${errLog.context}\n\n**Erro**:\n\`\`\`\n${errLog.message}\n${errLog.stack}\n\`\`\`\n*Cole no chat do assistente AI!*`;

  modal.innerHTML = `
    <div class="am-err-box">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:800;color:#f59e0b;font-size:14px;">⚠️ Erro Detectado</span>
        <button id="am-err-close" style="background:none;border:none;color:#64748b;font-size:20px;cursor:pointer;">&times;</button>
      </div>
      <p style="font-size:11px;color:#94a3b8;">Copie o relatório e envie ao assistente AI para correção rápida.</p>
      <textarea id="am-err-text" readonly>${report}</textarea>
      <button class="am-err-copy-btn" id="am-err-copy">📋 Copiar Relatório para o AI</button>
    </div>
  `;
  modal.classList.add('open');
  modal.querySelector('#am-err-close').onclick = () => modal.classList.remove('open');
  modal.querySelector('#am-err-copy').onclick = () => {
    modal.querySelector('#am-err-text').select();
    document.execCommand('copy');
    showToast('📋 Relatório copiado!');
  };
}

/* ═══════════════════════════════════════
   11. CHROME MESSAGE LISTENER
   ═══════════════════════════════════════ */
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'SET_EXT_ACTIVE') {
      extActive = msg.active;
      renderDraggableOverlay();
      renderFloatingTrigger();
      updatePageHighlighting();
      if (!extActive) stopAutoMining();
    } else if (msg.action === 'SET_AUTO_MINE') {
      autoMine = msg.autoMine;
      renderDraggableOverlay();
      if (autoMine && extActive) startAutoMining(); else stopAutoMining();
    } else if (msg.action === 'SET_FILTERS') {
      qualityFilters = msg.filters;
      renderDraggableOverlay();
    } else if (msg.action === 'UPDATE_MINED_LIST') {
      minedProducts = msg.minedProducts;
      renderDraggableOverlay();
    }
  });
}

/* ═══════════════════════════════════════
   BOOT
   ═══════════════════════════════════════ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}
