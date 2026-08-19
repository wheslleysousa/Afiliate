/* Affiliate Miner Content Script v1.0.9 — Enhanced Shopee/TikTok Card & PDP Extraction */

let extActive = false;
let isLoggedIn = false;
let autoMine = false;
let autoMineInterval = null;
let pdpCheckInterval = null;
let domObserver = null;
let isOverlayExpanded = true;
let isOverlayHidden = false;
let isFilterAccordionOpen = false;
let currentPageNum = 1;

function isExtensionEnabled() {
  return !!extActive;
}

function hideAllOverlays() {
  stopAutoMining();
  if (domObserver) {
    domObserver.disconnect();
    domObserver = null;
  }
  const overlay = document.getElementById('am-overlay');
  if (overlay) overlay.style.setProperty('display', 'none', 'important');
  const trigger = document.getElementById('am-floating-trigger');
  if (trigger) trigger.style.setProperty('display', 'none', 'important');
  const pdpBtn = document.getElementById('btn-injected-mine-pdp');
  if (pdpBtn) pdpBtn.remove();
  
  // Remove highlighted borders and injected mine buttons from product cards
  document.querySelectorAll('.am-highlight-border').forEach(el => {
    el.classList.remove('am-highlight-border');
    const b = el.querySelector('.am-card-mine-btn');
    if (b) b.remove();
  });
}

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
        isLoggedIn = s.isLoggedIn ?? false;
        extActive = s.extActive ?? false; // Defaults to false on first access
        autoMine = s.autoMine ?? false;
        minedProducts = s.minedProducts || [];
        discardedCount = s.discardedCount || 0;
        if (s.qualityFilters) {
          qualityFilters = { ...qualityFilters, ...s.qualityFilters };
        }
      }
      if (isExtensionEnabled()) {
        injectOverlayCSS();
        renderDraggableOverlay();
        renderFloatingTrigger();
        updatePageHighlighting();
        startPdpButtonWatcher();
        if (autoMine) startAutoMining();
      } else {
        hideAllOverlays();
      }
    });
  } else {
    hideAllOverlays();
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

    .am-card-wrap {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      position: relative !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .am-highlight-border {
      outline: 2.5px solid #2563eb !important;
      outline-offset: -2px !important;
      border-radius: 8px !important;
      transition: outline 0.2s ease !important;
      box-sizing: border-box !important;
    }
    .am-highlight-border:hover {
      outline: 3.5px solid #3b82f6 !important;
      outline-offset: -2px !important;
    }

    .am-card-mine-btn {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      margin: 6px 0 10px 0 !important;
      padding: 8px 12px !important;
      background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 8px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      cursor: pointer !important;
      text-align: center !important;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35) !important;
      transition: all 0.2s ease !important;
      min-height: 34px !important;
      clear: both !important;
      position: relative !important;
      z-index: 10 !important;
    }
    .am-card-mine-btn:hover {
      background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.5) !important;
      transform: translateY(-1px) !important;
    }
    .am-card-mine-btn:active {
      transform: translateY(0) scale(0.98) !important;
    }
    .am-card-mine-btn.mined-success {
      background: linear-gradient(135deg, #10b981, #059669) !important;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4) !important;
    }

    #btn-injected-mine-pdp {
      display: flex !important;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      margin: 12px 0 16px 0 !important;
      clear: both !important;
      position: relative !important;
      padding: 13px 20px !important;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-radius: 12px !important;
      font-size: 14px !important;
      font-weight: 800 !important;
      cursor: pointer !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4) !important;
      transition: all 0.2s ease !important;
      min-height: 44px !important;
      z-index: 100 !important;
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
            <div class="am-header-ver">v${(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : '1.2.2'}</div>
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

        <button id="am-btn-extract-aff" class="am-btn-search" style="margin-top:8px;background:linear-gradient(135deg,#7c3aed,#2563eb)">
          🔗 Extrair link de afiliado
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

  const btnExtractAff = overlay.querySelector('#am-btn-extract-aff');
  if (btnExtractAff) {
    btnExtractAff.onclick = () => extractAffiliateLinkFlow();
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
    // Shopee (Search, Recommendations, Daily Discover, Shop Pages, Flash Sale, Mobile Grid)
    'li.shopee-search-item-result__item',
    'div.shopee-search-item-result__item',
    'div[data-sqe="item"]',
    'a[data-sqe="link"]',
    'a[href*="-i."]',
    'a[href*="/product/"]',
    'div.col-xs-2-4',
    'div[class*="item-card" i]',
    'div[class*="ItemCard" i]',
    'div[class*="item-card__wrap" i]',
    'div[class*="shopee-search-item" i]',
    'div[class*="st-product-card" i]',
    'div[class*="recommend" i] a',
    'div[class*="recommendation" i] a',
    'div[class*="recommendation" i]',
    'div[class*="goods-item" i]',
    'div[class*="product-card" i]',
    'div[class*="ProductCard" i]',
    'div[class*="shop-item" i]',
    'div.shopee-item-card',
    'a.shopee-item-card',

    // TikTok Shop (Search, Feed, Store Showcase, Tabs, Recommendations, Mobile View)
    'div[data-e2e="product-card"]',
    'div[data-e2e="search-product-item"]',
    'div[data-e2e="feed-product-item"]',
    'div[data-e2e*="product" i]',
    'div[data-e2e*="goods" i]',
    'div[data-e2e*="shop" i]',
    'div[data-e2e*="item" i]',
    'div[data-p-id="product_card"]',
    'div[data-testid*="product" i]',
    'div[class*="GoodsCard" i]',
    'div[class*="GoodsItem" i]',
    'div[class*="goods-card" i]',
    'div[class*="goods-item" i]',
    'div[class*="ProductCard" i]',
    'div[class*="product-card" i]',
    'div[class*="ProductItem" i]',
    'div[class*="product-item" i]',
    'div[class*="ShowcaseItem" i]',
    'div[class*="showcase-item" i]',
    'div[class*="showcase" i]',
    'div[class*="FeedItem" i]',
    'div[class*="FeedCard" i]',
    'div[class*="ShopCard" i]',
    'div[class*="shop-item" i]',
    'a[href*="/view/product/"]',
    'a[href*="tiktok.com/view/product"]',
    'a[href*="/commerce/pdp/"]',
    'a[href*="/commerce/"]',
    'a[href*="/pdp/"]',
    'a[href*="/product/"]',

    // Mercado Livre
    '.ui-search-result__wrapper',
    'li.ui-search-layout__item',
    '.poly-card',
    '.ui-search-result',
    'div[class*="ui-search-item" i]',
    'a[href*="/p/MLB"]',
    'a[href*="/MLB-"]',

    // Amazon
    'div[data-component-type="s-search-result"]',
    'div[data-asin]:not([data-asin=""])',

    // Shein & AliExpress & Others
    '.goods-item',
    '.product-list-v2__item',
    'div[class*="search-result-item" i]',
    'a[href*="/item/"]',
    'a[href*="/goods/"]'
  ];
}

function getProductCardContainer(el) {
  if (!el || el.nodeType !== 1) return null;

  const tag = el.tagName;
  if (tag === 'BODY' || tag === 'HTML' || tag === 'MAIN' || tag === 'SECTION' || tag === 'NAV' || tag === 'FOOTER' || tag === 'HEADER') {
    return null;
  }

  // Reject elements inside headers, navigation bars, profile bars, search input bars, category tab bars, overlays, banner carousels
  if (el.closest(
    'header, nav, #header, .header, [data-e2e*="header" i], [data-e2e*="nav" i], ' +
    '[class*="Header" i], [class*="NavBar" i], [class*="nav-bar" i], [class*="navigation" i], ' +
    '[class*="top-bar" i], [class*="CategoryList" i], [class*="category-nav" i], ' +
    '[class*="banner" i], [class*="banner-container" i], [class*="swiper-slide-duplicate" i], ' +
    '#am-overlay, #am-floating-trigger, #am-filter-modal-backdrop, .am-filter-modal-backdrop'
  )) {
    return null;
  }

  // Reject entire list/grid wrappers containing many products
  const isEntireListWrapper = (node) => {
    if (!node || !node.className || typeof node.className !== 'string') return false;
    const c = node.className.toLowerCase();
    return c.includes('shopee-search-item-result__items') || 
           c.includes('ui-search-results') || 
           c.includes('s-main-slot') ||
           c.includes('goods-list') ||
           c.includes('products-grid') ||
           c.includes('search-layout__items') ||
           c.includes('infinite-scroll');
  };

  if (isEntireListWrapper(el)) return null;

  let card = null;

  // 1. Walk up to find known dedicated product card classes
  const parentCard = el.closest(
    'li.shopee-search-item-result__item, div.shopee-search-item-result__item, div[data-sqe="item"], ' +
    '.ui-search-result__wrapper, li.ui-search-layout__item, .poly-card, .ui-search-result, ' +
    'div[data-component-type="s-search-result"], div[data-asin]:not([data-asin=""]), ' +
    'div[data-e2e="product-card"], div[data-e2e="search-product-item"], div[data-e2e="feed-product-item"], ' +
    'div[data-e2e*="product" i], div[data-e2e*="goods" i], ' +
    'div[data-p-id="product_card"], div[class*="GoodsCard" i], div[class*="GoodsItem" i], ' +
    'div[class*="goods-card" i], div[class*="goods-item" i], ' +
    'div[class*="ProductCard" i], div[class*="product-card" i], div[class*="ProductItem" i], div[class*="product-item" i], ' +
    'div[class*="item-card" i], div[class*="ItemCard" i], div.col-xs-2-4, div.shopee-item-card, ' +
    'div[class*="ShowcaseItem" i], div[class*="showcase-item" i], div[class*="showcase" i], ' +
    'div[class*="FeedItem" i], div[class*="FeedCard" i], ' +
    '.goods-item, .product-list-v2__item, article'
  );

  if (parentCard && !isEntireListWrapper(parentCard)) {
    const anchors = parentCard.querySelectorAll('a[href*="-i."], a[href*="/product/"], a[href*="/view/product/"], a[href*="/p/"], a[href*="/dp/"]');
    const uHrefs = new Set();
    anchors.forEach(a => {
      const h = a.getAttribute('href');
      if (h) {
        const b = h.split('?')[0].split('#')[0];
        if (b.length > 5) uHrefs.add(b);
      }
    });
    if (uHrefs.size <= 1) {
      card = parentCard;
    }
  }

  // 2. If no parent card was found and el is an <a> or wrapper:
  if (!card) {
    if (tag === 'A') {
      const href = el.getAttribute('href') || '';
      const isProductLink = href.includes('-i.') || href.includes('/product/') || href.includes('/view/product/') || href.includes('/p/') || href.includes('/dp/') || href.includes('/item/');
      const hasContent = el.querySelector('img, [class*="price" i], [class*="title" i], span, p') || (el.textContent && /R\$/i.test(el.textContent));
      
      if (isProductLink || hasContent) {
        if (el.parentElement && el.parentElement.tagName !== 'BODY' && el.parentElement.tagName !== 'MAIN' && el.parentElement.tagName !== 'SECTION' && !isEntireListWrapper(el.parentElement)) {
          const siblingLinks = el.parentElement.querySelectorAll('a[href*="-i."], a[href*="/product/"], a[href*="/view/product/"], a[href*="/p/"]');
          if (siblingLinks.length <= 1) {
            card = el.parentElement;
          } else {
            card = el;
          }
        } else {
          card = el;
        }
      }
    } else if (el.parentElement && (el.parentElement.tagName === 'A' || el.parentElement.querySelector('a[href]'))) {
      const anchor = el.parentElement.tagName === 'A' ? el.parentElement : el.parentElement.querySelector('a[href]');
      if (anchor) {
        card = getProductCardContainer(anchor);
      }
    }
  }

  if (!card || isEntireListWrapper(card)) return null;

  // Final check: Filter out large wrapper containers holding MULTIPLE different products
  const productAnchors = card.querySelectorAll(
    'a[data-sqe="link"], a[href*="-i."], a[href*="/product/"], a[href*="/p/"], a[href*="/item/"], a[href*="tiktok.com/view/product"], a[href*="/dp/"]'
  );

  const uniqueHrefs = new Set();
  productAnchors.forEach(a => {
    const h = a.getAttribute('href');
    if (h) {
      const base = h.split('?')[0].split('#')[0];
      if (base.length > 5) uniqueHrefs.add(base);
    }
  });

  if (uniqueHrefs.size > 1) {
    return null;
  }

  return card;
}

/* ═══════════════════════════════════════
   5. HIGHLIGHTING & INJECTED CARD BUTTONS
   ═══════════════════════════════════════ */
function findTikTokStructuralCards() {
  const cards = [];
  const candidates = document.querySelectorAll('div, li, article');
  candidates.forEach(el => {
    // Exclude headers, navbars, floating overlay, modal, PDP main containers
    if (el.closest('header, nav, #header, .header, [data-e2e*="header" i], [data-e2e*="nav" i], [class*="Header" i], [class*="NavBar" i], #am-floating-trigger, #am-overlay, .am-filter-modal-backdrop, #btn-injected-mine-pdp, .am-card-wrap')) return;

    // Check for product image (not avatar)
    const imgs = el.querySelectorAll('img');
    if (imgs.length === 0 || imgs.length > 5) return;
    let hasProductImg = false;
    for (const img of imgs) {
      if (!isLikelyAvatar(img.src || img.dataset.src || '', img)) {
        hasProductImg = true;
        break;
      }
    }
    if (!hasProductImg) return;

    const txt = (el.textContent || '').trim();
    // Must contain BRL price
    if (!/R\$\s*[\d.,]+/i.test(txt)) return;

    // Must contain sales, rating or discount indicator
    if (!/vend|sold|comprad|★|\/5|de 5|off|%|economize/i.test(txt)) return;

    if (txt.length > 600) return;

    // Verify it doesn't contain multiple product prices (multiple products in grid)
    const prices = extractAllPricesFromText(txt);
    if (prices.length > 4) return;

    // Check if any child already has the structural indicators (to ensure minimal container)
    let isMinimal = true;
    for (const child of el.children) {
      if (/R\$\s*[\d.,]+/i.test(child.textContent || '') && child.querySelector('img')) {
        isMinimal = false;
        break;
      }
    }

    if (isMinimal) {
      cards.push(el);
    }
  });
  return cards;
}

function updatePageHighlighting() {
  if (!extActive) {
    document.querySelectorAll('.am-highlight-border').forEach((card) => {
      card.classList.remove('am-highlight-border');
      delete card.dataset.amMined;
      if (card.nextElementSibling && card.nextElementSibling.classList.contains('am-card-mine-btn')) {
        card.nextElementSibling.remove();
      }
    });
    document.querySelectorAll('.am-card-mine-btn').forEach((btn) => btn.remove());
    // Also remove any leftover wrappers if existed previously
    document.querySelectorAll('.am-card-wrap').forEach((wrap) => {
      const card = wrap.querySelector('.am-highlight-border') || wrap.firstElementChild;
      if (card && wrap.parentNode) {
        card.classList.remove('am-highlight-border');
        delete card.dataset.amMined;
        wrap.parentNode.insertBefore(card, wrap);
        wrap.remove();
      }
    });
    return;
  }

  const onPdp = isProductPage();
  const rawElements = document.querySelectorAll(getProductCardSelectors().join(', '));
  const cardSet = new Set();

  rawElements.forEach((rawEl) => {
    const card = getProductCardContainer(rawEl);
    if (card) {
      if (onPdp) {
        // Exclude the main product container on PDP pages so we don't inject a card button on the main PDP
        if (
          card.querySelector('h1#productTitle, .ui-pdp-title, [data-e2e="pdp-title"], .product-briefing, div[class*="page-product__detail" i]') ||
          card.closest('.ui-pdp-container, .product-briefing, div[class*="page-product__detail" i], div[class*="goods-detail" i], div[class*="PdpContainer" i], div[class*="goods-info" i], div[class*="product-info" i]') ||
          card.id === 'btn-injected-mine-pdp' ||
          card.contains(document.getElementById('btn-injected-mine-pdp'))
        ) {
          return;
        }
      }
      cardSet.add(card);
    }
  });

  // Structural scan for TikTok cards
  const platform = getPlatformKey();
  if (platform === 'tiktok' || platform === 'tiktokshop') {
    findTikTokStructuralCards().forEach(card => {
      if (!onPdp || !card.closest('.ui-pdp-container, .product-briefing, div[class*="page-product__detail" i], div[class*="goods-detail" i], div[class*="goods-info" i]')) {
        cardSet.add(card);
      }
    });
  }

  cardSet.forEach((card) => {
    // Evitar destacar containers internos se um pai já estiver destacado
    if (card.parentElement && card.parentElement.closest('.am-highlight-border')) {
      return;
    }

    card.classList.add('am-highlight-border');

    // Dedupe por dataset.amMined e checagem do botão irmão
    const hasNextBtn = card.nextElementSibling && card.nextElementSibling.classList.contains('am-card-mine-btn');
    if (card.dataset.amMined === '1' && hasNextBtn) {
      return;
    }

    // Se o botão não existir ou foi removido por re-render do DOM, cria e insere logo após o card
    card.dataset.amMined = '1';

    const btn = document.createElement('button');
    btn.className = 'am-card-mine-btn';
    btn.setAttribute('type', 'button');
    btn.innerHTML = `⚡ Minerar`;
    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const success = await mineCardProduct(card, true);
      if (success !== false) {
        btn.innerHTML = `✅ Minerado!`;
        btn.classList.add('mined-success');
        setTimeout(() => {
          btn.innerHTML = `⚡ Minerar`;
          btn.classList.remove('mined-success');
        }, 2500);
      }
    };

    // Inserir como irmão logo depois do card (fora do overflow:hidden e fora de <a>)
    card.insertAdjacentElement('afterend', btn);
  });
}

/* ═══════════════════════════════════════
   6. PDP BUTTON WATCHER
   ═══════════════════════════════════════ */
function isProductPage() {
  const url = window.location.href.toLowerCase();
  
  // TikTok Shop Product Detail Page URLs & Patterns
  if (
    url.includes('tiktok.com/view/product') ||
    url.includes('/view/product/') ||
    url.includes('/commerce/pdp/') ||
    url.includes('/pdp/') ||
    url.includes('/product/') ||
    (url.includes('tiktok') && (url.includes('/p/') || url.includes('/view/') || url.includes('/goods/')))
  ) {
    return true;
  }

  // Shopee, Mercado Livre, Amazon, AliExpress, Shein PDP URLs
  if (
    url.includes('/product/') ||
    url.includes('-i.') ||
    url.includes('/p/') ||
    url.includes('/dp/') ||
    url.includes('item.htm') ||
    url.includes('/goods/') ||
    url.includes('/detail/') ||
    url.includes('/universal-link/') ||
    url.includes('/item/')
  ) {
    return true;
  }

  // DOM Checks for Product Detail Pages
  if (document.querySelector(
    'h1#productTitle, #productTitle, .ui-pdp-title, [data-testid*="product-title" i], ' +
    'div[class*="ProductTitle" i], div[data-e2e="pdp-title"], [data-e2e*="pdp" i], ' +
    '.product-briefing, .ui-pdp-container, div[class*="goods-detail" i], ' +
    'div[class*="PdpContainer" i], div[class*="product-detail" i], div[data-e2e="pdp-buy-button"], ' +
    'div[class*="pdp" i] [class*="price" i], div[class*="sku-container" i]'
  )) {
    return true;
  }

  return false;
}

function startPdpButtonWatcher() {
  if (pdpCheckInterval) clearInterval(pdpCheckInterval);
  pdpCheckInterval = setInterval(() => {
    if (!extActive) return;
    if (isProductPage() && !document.getElementById('btn-injected-mine-pdp')) {
      injectPdpButton();
    }
    updatePageHighlighting();
  }, 1000);

  // Real-time MutationObserver for SPAs (Shopee, TikTok Shop, etc.)
  if (!domObserver && typeof MutationObserver !== 'undefined') {
    let updateTimeout = null;
    domObserver = new MutationObserver(() => {
      if (!extActive) return;
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        if (isProductPage() && !document.getElementById('btn-injected-mine-pdp')) {
          injectPdpButton();
        }
        updatePageHighlighting();
      }, 300);
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }
}

function injectPdpButton() {
  if (!extActive || document.getElementById('btn-injected-mine-pdp')) return;

  const btn = document.createElement('button');
  btn.id = 'btn-injected-mine-pdp';
  btn.setAttribute('type', 'button');
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    <span>⛏ Minerar Este Produto</span>
  `;
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    mineCurrentPageProduct(true);
  };

  const platform = getPlatformKey();

  // 1. Shopee PDP Anchor
  if (platform === 'shopee') {
    const shopeeGroup = document.querySelector(
      'div.high-end-button-group, div.high-button-section, ' +
      'div[class*="high-end-button" i], div[class*="high-button" i], ' +
      'div.product-briefing div.flex:has(button), div.product-briefing div.btn-tinted'
    );
    if (shopeeGroup) {
      shopeeGroup.insertAdjacentElement('afterend', btn);
      return;
    }
    const shopeeBuyBtn = document.querySelector('button.btn-solid-primary, button[class*="btn-solid-primary" i], div.product-briefing button');
    if (shopeeBuyBtn && shopeeBuyBtn.parentElement) {
      shopeeBuyBtn.parentElement.insertAdjacentElement('afterend', btn);
      return;
    }
    const shopeeBriefing = document.querySelector('.product-briefing, div[class*="product-briefing" i], div[class*="page-product__detail" i]');
    if (shopeeBriefing) {
      shopeeBriefing.appendChild(btn);
      return;
    }
  }

  // 2. TikTok Shop PDP Anchor
  if (platform === 'tiktok' || platform === 'tiktokshop') {
    const allButtons = Array.from(document.querySelectorAll('button, div[role="button"], a[role="button"]'));
    const ttBuyButton = allButtons.find(b => {
      const txt = (b.textContent || '').trim().toLowerCase();
      return (txt === 'comprar agora' || txt.includes('comprar agora') || txt === 'buy now' || txt.includes('buy now') || txt === 'comprar' || txt.includes('adicionar ao carrinho')) &&
             !b.closest('#am-floating-trigger, #am-overlay, .am-card-wrap, #am-pdp-float-bar, .am-card-mine-btn');
    }) || document.querySelector(
      'button[data-e2e*="buy" i], div[data-e2e*="buy" i], button[class*="buy" i], ' +
      'div[class*="BuyButton" i], div[class*="buy-button" i], div[data-e2e*="cart" i], ' +
      'div[class*="ButtonContainer" i], div[class*="button-wrapper" i]'
    );

    if (ttBuyButton) {
      const ttContainer = ttBuyButton.closest('div.flex.flex-col.gap-12, div.flex.flex-col, div[class*="button-group" i], div[class*="ButtonContainer" i]') || ttBuyButton.parentElement;
      if (ttContainer) {
        ttContainer.insertAdjacentElement('afterend', btn);
        return;
      }
    }

    const ttProductInfo = document.querySelector('div[class*="ProductInfo" i], div[class*="goods-info" i], div[class*="goods-detail" i], div[class*="pdp-container" i]');
    if (ttProductInfo) {
      ttProductInfo.appendChild(btn);
      return;
    }
  }

  // 3. Mercado Livre PDP Anchor
  if (platform === 'mercadolivre') {
    const mlActionsContainer = document.querySelector('div.ui-pdp-actions__container, div.ui-pdp-actions, form.ui-pdp-buybox__form, .ui-pdp-actions__button--buy');
    if (mlActionsContainer) {
      const targetWrap = mlActionsContainer.closest('div.ui-pdp-actions') || mlActionsContainer;
      targetWrap.insertAdjacentElement('afterend', btn);
      return;
    }
  }

  // 4. Amazon PDP Anchor
  if (platform === 'amazon') {
    const amzContainer = document.querySelector('#buyNow_feature_div, #addToCart_feature_div, #buy-now-button, #buybox, #desktop_buybox');
    if (amzContainer) {
      amzContainer.insertAdjacentElement('afterend', btn);
      return;
    }
  }

  // 5. Fallback General PDP Anchors
  const optionBoxTarget = document.querySelector(
    'div[class*="Option" i], div[class*="Select" i], div[class*="Sku" i], ' +
    'div[class*="variant" i], div[class*="variation" i], .shopee-selector, ' +
    'div[class*="pdp-option" i], [data-testid*="sku-select" i]'
  );

  const buyNowTarget = document.querySelector(
    '#buy-now-button, #buyNow_feature_div, #buyNow, input[name="submit.buy-now"], ' +
    '#submit.buy-now, [data-action="buy-now"], .ui-pdp-actions__button--buy, ' +
    'div[class*="BuyBox" i], div[class*="buy-box" i], .ui-pdp-actions'
  );

  if (optionBoxTarget && optionBoxTarget.parentNode) {
    optionBoxTarget.insertAdjacentElement('afterend', btn);
  } else if (buyNowTarget && buyNowTarget.parentNode) {
    buyNowTarget.insertAdjacentElement('afterend', btn);
  } else {
    // Fixed floating fallback container for PDP positioned SAFELY ABOVE bottom bars
    let floatBar = document.getElementById('am-pdp-float-bar');
    if (!floatBar) {
      floatBar = document.createElement('div');
      floatBar.id = 'am-pdp-float-bar';
      floatBar.style.cssText = `
        position: fixed !important;
        bottom: 85px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: calc(100% - 32px) !important;
        max-width: 480px !important;
        z-index: 2147483647 !important;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important;
      `;
      document.body.appendChild(floatBar);
    }
    floatBar.appendChild(btn);
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

function isInstallmentOrBadgeElement(el) {
  if (!el) return false;
  const closestBad = el.closest(
    '[class*="installment" i], [class*="parcela" i], [class*="badge" i], ' +
    '[class*="coupon" i], [class*="cupom" i], [class*="shipping" i], [class*="frete" i], ' +
    '[class*="discount" i], [class*="off" i], del, s, .poly-price__old'
  );
  if (closestBad) return true;
  const txt = (el.textContent || '').toLowerCase();
  if (/em\s*at[ée]\s*\d+x|\d+x\s*de\s*r\$|sem\s*juros|com\s*cupom|frete\s*gr[áa]tis/i.test(txt)) return true;
  return false;
}

function extractAllPricesFromText(text) {
  if (!text) return [];
  // Strip out installment strings like "5x R$ 5,97", "12x de R$ 10,00", "sem juros", "off", "cupom"
  let clean = String(text)
    .replace(/(?:em\s+at[ée]\s+|\dou\s+|\b)\d{1,2}\s*x\s*(?:de\s*)?R\$\s*[\d.]{1,12},\d{2}/gi, '')
    .replace(/(?:em\s+at[ée]\s+|\dou\s+|\b)\d{1,2}\s*x\s*(?:de\s*)?R\$\s*[\d.]+/gi, '')
    .replace(/\b\d{1,2}\s*x\b/gi, '')
    .replace(/-\s*\d+\s*%/g, '')
    .replace(/\d+\s*%\s*OFF/gi, '')
    .replace(/cupom[^\n,.]*/gi, '')
    .replace(/frete[^\n,.]*/gi, '');

  const prices = [];

  // Match BRL explicit format: "R$ 189,94", "R$189,94", "R$ 11.06", "R$11.06", "R$17,00", "R$ 2.659,91"
  const brlMatches = [...clean.matchAll(/R\$\s*([\d.,]+)/gi)];
  for (const m of brlMatches) {
    let s = m[1].trim();
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const val = parseFloat(s);
    if (!isNaN(val) && val > 0 && val < 500000 && !prices.includes(val)) {
      prices.push(val);
    }
  }

  // Match standalone currency formats if none found yet
  if (prices.length === 0) {
    const commaMatches = [...clean.matchAll(/(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})/g)];
    for (const m of commaMatches) {
      const val = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      if (!isNaN(val) && val > 0 && val < 500000 && !prices.includes(val)) prices.push(val);
    }
  }

  return prices;
}

function parseRawPriceString(str) {
  if (!str) return 0;
  const prices = extractAllPricesFromText(str);
  if (prices.length > 0) return prices[0];

  // Clean out installment patterns
  let text = String(str)
    .replace(/(?:em\s+at[ée]\s+|\dou\s+|\b)\d{1,2}\s*x\s*(?:de\s*)?R\$\s*[\d.]{1,12},\d{2}/gi, '')
    .replace(/(?:em\s+at[ée]\s+|\dou\s+|\b)\d{1,2}\s*x\s*(?:de\s*)?R\$\s*[\d.]+/gi, '')
    .replace(/-\s*\d+\s*%/g, '')
    .replace(/\d+\s*%\s*OFF/gi, '')
    .replace(/cupom[^\n,.]*/gi, '')
    .replace(/frete[^\n,.]*/gi, '')
    .trim();

  // Match BRL format with R$ explicitly
  const brlMatches = [...text.matchAll(/R\$\s*([\d.]{1,12},\d{2})/gi)];
  if (brlMatches.length > 0) {
    const pList = brlMatches.map(m => {
      const numStr = m[1].replace(/\./g, '').replace(',', '.');
      return parseFloat(numStr) || 0;
    }).filter(p => p > 0);
    if (pList.length > 0) return Math.min(...pList);
  }

  return 0;
}

function extractAndesPrice(container) {
  if (!container) return 0;

  if (typeof container === 'string') {
    return parseRawPriceString(container);
  }

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

  return parseRawPriceString(container.textContent || '');
}

function isLikelyAvatar(url, imgEl = null) {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase();
  if (
    lower.includes('avatar') ||
    lower.includes('user-avatar') ||
    lower.includes('aweme-avatar') ||
    lower.includes('profile') ||
    lower.includes('author') ||
    lower.includes('seller') ||
    lower.includes('user/avatar') ||
    lower.includes('/tos-maliva-avt') ||
    lower.includes('/tos-alisg-avt') ||
    lower.includes('/tos-useast2a-avt') ||
    lower.includes('musically-avatar') ||
    lower.includes('avt-') ||
    lower.includes('-avt-') ||
    lower.includes('/avt/')
  ) {
    return true;
  }
  if (lower.includes('1x1') || lower.includes('pixel') || lower.includes('badge') || lower.includes('logo') || lower.includes('favicon') || lower.includes('icon')) {
    return true;
  }
  if (lower.includes('p16') && (lower.includes('shrink') || lower.includes('100x100') || lower.includes('80x80') || lower.includes('50x50') || lower.includes('avatar') || lower.includes('obj/tos-maliva-avt') || lower.includes('obj/tos-alisg-avt'))) {
    return true;
  }
  if (imgEl && imgEl.nodeType === 1) {
    if (imgEl.closest('header, nav, footer, [class*="review" i], [class*="comment" i], [class*="user" i], [class*="author" i], [class*="seller" i], [class*="profile" i], [data-e2e*="user" i], [class*="avatar" i]')) {
      return true;
    }
    const w = imgEl.naturalWidth || imgEl.width || (imgEl.getBoundingClientRect ? imgEl.getBoundingClientRect().width : 0);
    const h = imgEl.naturalHeight || imgEl.height || (imgEl.getBoundingClientRect ? imgEl.getBoundingClientRect().height : 0);
    if ((w > 0 && w <= 80) || (h > 0 && h <= 80)) {
      return true;
    }
  }
  return false;
}

function extractTikTokDataFromScripts() {
  let pictures = [];
  let title = '';
  let pixPrice = 0;
  let oldPrice = 0;
  let sales = 0;
  let rating = 0;
  let ratings_count = 0;
  let description = '';
  let attributes = [];

  function findDeepValue(obj, keyToFind) {
    if (!obj || typeof obj !== 'object') return null;
    if (obj[keyToFind] !== undefined) return obj[keyToFind];
    for (const key of Object.keys(obj)) {
      const val = findDeepValue(obj[key], keyToFind);
      if (val !== null) return val;
    }
    return null;
  }

  function parseNumericPrice(val) {
    if (!val) return 0;
    if (typeof val === 'number') {
      if (val > 100000) return val / 100000;
      if (val > 10000 && Number.isInteger(val)) return val / 100;
      return val;
    }
    if (typeof val === 'string') {
      return parseRawPriceString(val);
    }
    return 0;
  }

  // 1. __UNIVERSAL_DATA_FOR_REHYDRATION__
  const rehydrationEl = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
  if (rehydrationEl) {
    try {
      const data = JSON.parse(rehydrationEl.textContent || '{}');
      const productInfo = findDeepValue(data, 'productInfo') || findDeepValue(data, 'product_info') || findDeepValue(data, 'productDetail') || findDeepValue(data, 'goods') || data;
      if (productInfo) {
        title = productInfo.title || productInfo.name || findDeepValue(productInfo, 'title') || title;
        description = productInfo.description || productInfo.desc || findDeepValue(productInfo, 'description') || description;
        
        const imgs = productInfo.images || productInfo.product_images || findDeepValue(productInfo, 'images') || findDeepValue(productInfo, 'images_url');
        if (Array.isArray(imgs)) {
          imgs.forEach(img => {
            const src = typeof img === 'string' ? img : (img.url || img.thumb_url || img.src);
            if (src && !isLikelyAvatar(src) && !pictures.includes(src)) pictures.push(src);
          });
        }

        const priceInfo = productInfo.price || findDeepValue(productInfo, 'price') || findDeepValue(data, 'price_info');
        if (priceInfo) {
          const rawPrice = priceInfo.sale_price || priceInfo.price_to || priceInfo.real_price || priceInfo.price || priceInfo.min_price || priceInfo.formatted_price;
          const rawOldPrice = priceInfo.original_price || priceInfo.price_from || priceInfo.price_before_discount || priceInfo.strike_price;
          if (rawPrice) pixPrice = parseNumericPrice(rawPrice) || pixPrice;
          if (rawOldPrice) oldPrice = parseNumericPrice(rawOldPrice) || oldPrice;
        }

        const s = productInfo.sold_count || productInfo.sales || findDeepValue(productInfo, 'sold_count') || findDeepValue(productInfo, 'soldCount');
        if (s) sales = parseInt(s, 10) || sales;

        const r = productInfo.rating || findDeepValue(productInfo, 'rating') || findDeepValue(productInfo, 'rating_star');
        if (r) rating = parseFloat(r) || rating;

        const rc = productInfo.rating_count || findDeepValue(productInfo, 'rating_count') || findDeepValue(productInfo, 'review_count');
        if (rc) ratings_count = parseInt(rc, 10) || ratings_count;

        const attrs = productInfo.attributes || productInfo.specs || productInfo.properties || findDeepValue(productInfo, 'attributes') || findDeepValue(productInfo, 'product_attributes');
        if (Array.isArray(attrs)) {
          attrs.forEach(a => {
            if (a.name && a.value) {
              attributes.push({ name: a.name, value: a.value });
            } else if (a.attribute_name && a.attribute_value) {
              attributes.push({ name: a.attribute_name, value: a.attribute_value });
            }
          });
        }
      }
    } catch (_) {}
  }

  // 2. SIGI_STATE
  const sigiEl = document.getElementById('SIGI_STATE');
  if (sigiEl) {
    try {
      const data = JSON.parse(sigiEl.textContent || '{}');
      const productInfo = findDeepValue(data, 'productInfo') || findDeepValue(data, 'product') || findDeepValue(data, 'goods');
      if (productInfo) {
        if (!title) title = productInfo.title || productInfo.name || findDeepValue(productInfo, 'title') || '';
        if (!description) description = productInfo.description || findDeepValue(productInfo, 'description') || '';
        const imgs = productInfo.images || findDeepValue(productInfo, 'images');
        if (Array.isArray(imgs) && pictures.length === 0) {
          imgs.forEach(img => {
            const src = typeof img === 'string' ? img : (img.url || img.src);
            if (src && !isLikelyAvatar(src) && !pictures.includes(src)) pictures.push(src);
          });
        }
        if (!pixPrice) {
          const rawPrice = findDeepValue(productInfo, 'price') || findDeepValue(productInfo, 'salePrice');
          if (rawPrice) pixPrice = parseNumericPrice(rawPrice) || 0;
        }
      }
    } catch (_) {}
  }

  // 3. RENDER_DATA
  const renderEl = document.getElementById('RENDER_DATA');
  if (renderEl) {
    try {
      let content = renderEl.textContent || '';
      if (content.includes('%')) {
        content = decodeURIComponent(content);
      }
      const data = JSON.parse(content || '{}');
      const productInfo = findDeepValue(data, 'productInfo') || findDeepValue(data, 'product_info') || findDeepValue(data, 'productDetail') || data;
      if (productInfo) {
        if (!title) title = productInfo.title || productInfo.name || findDeepValue(productInfo, 'title') || '';
        if (!description) description = productInfo.description || findDeepValue(productInfo, 'description') || '';
        const imgs = productInfo.images || findDeepValue(productInfo, 'images') || findDeepValue(productInfo, 'product_images');
        if (Array.isArray(imgs) && pictures.length === 0) {
          imgs.forEach(img => {
            const src = typeof img === 'string' ? img : (img.url || img.thumb_url || img.src);
            if (src && !isLikelyAvatar(src) && !pictures.includes(src)) pictures.push(src);
          });
        }
        if (!pixPrice) {
          const rawPrice = productInfo.price?.sale_price || productInfo.price?.price_to || findDeepValue(productInfo, 'price') || findDeepValue(productInfo, 'salePrice');
          if (rawPrice) pixPrice = parseNumericPrice(rawPrice) || 0;
        }
        if (!sales) {
          const s = productInfo.sold_count || findDeepValue(productInfo, 'sold_count');
          if (s) sales = parseInt(s, 10) || 0;
        }
        const attrs = productInfo.attributes || findDeepValue(productInfo, 'attributes') || findDeepValue(productInfo, 'product_attributes');
        if (Array.isArray(attrs) && attributes.length === 0) {
          attrs.forEach(a => {
            if (a.name && a.value) {
              attributes.push({ name: a.name, value: a.value });
            } else if (a.attribute_name && a.attribute_value) {
              attributes.push({ name: a.attribute_name, value: a.attribute_value });
            }
          });
        }
      }
    } catch (_) {}
  }

  // 4. JSON-LD scripts
  document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try {
      const json = JSON.parse(s.textContent || '{}');
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (item['@type'] === 'Product' || item.offers) {
          if (!title) title = item.name || item.title || '';
          if (!description) description = item.description || '';
          if (item.image && pictures.length === 0) {
            const imgs = Array.isArray(item.image) ? item.image : [item.image];
            imgs.forEach(src => {
              if (src && !isLikelyAvatar(src) && !pictures.includes(src)) pictures.push(src);
            });
          }
          if (!pixPrice) {
            const p = item.offers?.price || item.offers?.lowPrice || item.price;
            if (p) pixPrice = parseFloat(p) || 0;
          }
          if (!oldPrice) {
            const op = item.offers?.highPrice || item.offers?.priceBeforeDiscount;
            if (op) oldPrice = parseFloat(op) || 0;
          }
          if (!rating) {
            const r = item.aggregateRating?.ratingValue || item.aggregateRating?.reviewCount;
            if (r) rating = parseFloat(r) || 0;
          }
          if (!ratings_count) {
            const rc = item.aggregateRating?.ratingCount || item.aggregateRating?.reviewCount;
            if (rc) ratings_count = parseInt(rc, 10) || 0;
          }
        }
      }
    } catch (_) {}
  });

  return { pictures, title, pixPrice, oldPrice, sales, rating, ratings_count, description, attributes };
}

async function extractRealProductData(element) {
  try {
    let title = '', pixPrice = 0, oldPrice = 0, discountPercent = 0;
    let rating = 0, sales = 0, freeShipping = false, noInterest = false;
    let image = '', link = window.location.href;
    let coupon = null, installments = null, description = null, pixExplicit = 0, category = null;
    let pictures = [];
    let ratings_count = null, attributes = null;
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
        const shopeeLink = element.tagName === 'A' ? element : element.querySelector('a[href]');
        if (shopeeLink) link = shopeeLink.href;

        // Try API extraction for Shopee Card if itemId & shopId are available in the link
        let cardApiSuccess = false;
        const shopeeMatch = (link || '').match(/-i\.(\d+)\.(\d+)/) || (link || '').match(/i\.(\d+)\.(\d+)/) || (link || '').match(/shopid=(\d+)&itemid=(\d+)/);
        if (shopeeMatch) {
          try {
            const shopId = shopeeMatch[1];
            const itemId = shopeeMatch[2];
            const apiRes = await fetch(`/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`, {
              credentials: 'include',
              headers: {
                'x-api-source': 'pc',
                'x-shopee-language': 'pt-BR'
              }
            });
            if (apiRes.ok) {
              const apiJson = await apiRes.json();
              const item = apiJson.data || apiJson.item;
              if (item) {
                title = item.title || item.name || '';
                description = item.description || '';
                
                const rawPrice = item.price || item.price_min || item.price_max;
                if (rawPrice) pixPrice = rawPrice / 100000;
                
                if (item.price_before_discount > 0) {
                  oldPrice = item.price_before_discount / 100000;
                }
                
                discountPercent = item.raw_discount || 0;
                sales = item.historical_sold || item.sold || item.global_sold_count || 0;
                rating = item.item_rating?.rating_star || 0;
                ratings_count = item.item_rating?.rating_count ? (item.item_rating.rating_count[0] || 0) : 0;
                
                if (Array.isArray(item.attributes)) {
                  attributes = item.attributes.map(attr => ({
                    name: attr.name || attr.key || '',
                    value: attr.value || attr.val || ''
                  }));
                }
                
                if (Array.isArray(item.images)) {
                  pictures = item.images.map(hash => `https://down-br.img.susercontent.com/file/${hash}`);
                  if (pictures.length > 0) {
                    image = pictures[0];
                  }
                }
                cardApiSuccess = true;
              }
            }
          } catch (e) {
            console.warn('Shopee card API fetch failed, using DOM parsing', e);
          }
        }

        if (!cardApiSuccess) {
          const shopeeTitle = element.querySelector('.shopee-search-item-result__name, div[data-sqe="name"], div[class*="product-name"], div[class*="name" i], [class*="title" i], span[class*="name" i]');
          if (shopeeTitle) title = shopeeTitle.textContent.trim();
          
          // Shopee Old Price / Original Strikethrough Price
          const shopeeOldPriceEl = element.querySelector(
            'div[class*="price-before-discount" i], .shopee-item-card__original-price, del, s, ' +
            '[class*="original-price" i], [class*="before-discount" i], [class*="old-price" i], ' +
            'div[class*="line-through" i], span[class*="line-through" i], div[class*="strike" i], ' +
            'div._0Zddfv, div._21p0yE, div._2v0Hgx, span[class*="original" i], [class*="strikethrough" i]'
          );
          if (shopeeOldPriceEl) oldPrice = extractAndesPrice(shopeeOldPriceEl);

          // Shopee Current Sale Price
          const shopeePriceEls = element.querySelectorAll(
            'div[class*="price-after-discount" i], div[class*="current-price" i], div[class*="Price__price" i], ' +
            'div[class*="ProductPrice" i], [class*="price" i] span, [class*="price" i], [data-sqe="price"]'
          );
          for (const el of shopeePriceEls) {
            if (isInstallmentOrBadgeElement(el)) continue;
            if (el.closest('del, s, [class*="before-discount" i], [class*="original-price" i], [class*="line-through" i]')) continue;
            const p = extractAndesPrice(el);
            if (p > 0) { pixPrice = p; break; }
          }

          // Shopee discount badge check
          const shopeeDiscountEl = element.querySelector('div[class*="discount" i], span[class*="percent" i], div[class*="badge" i], [class*="pct" i]');
          if (shopeeDiscountEl) {
            const dm = shopeeDiscountEl.textContent.match(/(\d{1,2})%/);
            if (dm) discountPercent = parseInt(dm[1], 10);
          }

          // Multiple price scanner on card
          const cardPrices = extractAllPricesFromText(cardText);
          if (cardPrices.length >= 2) {
            if (!pixPrice || pixPrice === 0) pixPrice = Math.min(...cardPrices);
            if (!oldPrice || oldPrice === 0) oldPrice = Math.max(...cardPrices);
          }

          // If discount badge exists but old price wasn't caught, compute original price
          if (discountPercent > 0 && oldPrice === 0 && pixPrice > 0) {
            oldPrice = Number((pixPrice / (1 - discountPercent / 100)).toFixed(2));
          }

          const shopeeSalesEl = element.querySelector('div[class*="sold" i], div[class*="vendas" i], div[class*="sold-count" i], [class*="sold" i]');
          if (shopeeSalesEl) sales = parseSalesCount(shopeeSalesEl.textContent);
          if (!sales) sales = parseSalesCount(cardText);

          const shopeeRatingEl = element.querySelector('.shopee-rating-stars, [class*="rating" i], [class*="star" i]');
          if (shopeeRatingEl) {
            const rm = shopeeRatingEl.textContent.match(/(\d[\.,]\d)/);
            if (rm) rating = parseFloat(rm[1].replace(',', '.'));
          }
          if (!rating || rating === 0) {
            const rm = cardText.match(/(\d[\.,]\d)\s*(?:★|estrelas|\/5|de 5)/i);
            if (rm) rating = parseFloat(rm[1].replace(',', '.'));
          }

          const shopeeImg = element.querySelector('img[src*="shopee"], img[src*="susercontent"], img');
          if (shopeeImg) image = shopeeImg.src || shopeeImg.dataset.src || shopeeImg.getAttribute('srcset')?.split(' ')[0] || '';
        }
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

        const amzLink = element.tagName === 'A' ? element : element.querySelector('a[href]');
        if (amzLink) link = amzLink.href;
      }
      else if (platform === 'tiktok' || platform === 'tiktokshop') {
        const ttTitle = element.querySelector('div[class*="ProductTitle" i], p[class*="title" i], div[class*="product-title" i], [class*="title" i], span[class*="title" i]');
        if (ttTitle) title = ttTitle.textContent.trim();
        
        const ttOldPriceEl = element.querySelector(
          'span[class*="PriceBefore" i], span[class*="OriginalPrice" i], span[class*="origin-price" i], ' +
          'span[class*="originPrice" i], span[class*="cross-out" i], span[class*="strikethrough" i], ' +
          'span[class*="line-through" i], [data-testid*="original-price" i], div[class*="OriginalPrice" i], del, s'
        );
        if (ttOldPriceEl) oldPrice = extractAndesPrice(ttOldPriceEl);

        const ttPriceEls = element.querySelectorAll('div[class*="Price" i], span[class*="price" i], [class*="price" i], span[class*="sale-price" i]');
        for (const el of ttPriceEls) {
          if (isInstallmentOrBadgeElement(el)) continue;
          if (el.closest('del, s, [class*="PriceBefore" i], [class*="OriginalPrice" i], [class*="line-through" i]')) continue;
          const p = extractAndesPrice(el);
          if (p > 0) { pixPrice = p; break; }
        }

        const ttDiscountEl = element.querySelector('span[class*="discount" i], div[class*="discount" i], span[class*="percent" i], [class*="badge" i]');
        if (ttDiscountEl) {
          const dm = ttDiscountEl.textContent.match(/(\d{1,2})%/);
          if (dm) discountPercent = parseInt(dm[1], 10);
        }

        // Multi price extraction on TikTok card
        const cardPrices = extractAllPricesFromText(cardText);
        if (cardPrices.length >= 2) {
          if (!pixPrice || pixPrice === 0) pixPrice = Math.min(...cardPrices);
          if (!oldPrice || oldPrice === 0) oldPrice = Math.max(...cardPrices);
        }

        if (discountPercent > 0 && oldPrice === 0 && pixPrice > 0) {
          oldPrice = Number((pixPrice / (1 - discountPercent / 100)).toFixed(2));
        }
        
        const ttSalesEl = element.querySelector('div[class*="Sold" i], span[class*="sold" i], div[class*="sales" i]');
        if (ttSalesEl) sales = parseSalesCount(ttSalesEl.textContent);
        if (!sales) sales = parseSalesCount(cardText);

        const ttRatingMatch = cardText.match(/(\d[\.,]\d)\s*★/i) || cardText.match(/(\d[\.,]\d)\s*\|\s*\d+/i);
        if (ttRatingMatch) {
          rating = parseFloat(ttRatingMatch[1].replace(',', '.'));
        }
        
        const ttImgs = element.querySelectorAll('img');
        for (const imgNode of ttImgs) {
          const src = imgNode.src || imgNode.dataset.src || '';
          if (src && !isLikelyAvatar(src, imgNode)) {
            image = src;
            break;
          }
        }

        const ttLink = element.tagName === 'A' ? element : element.querySelector('a[href]');
        if (ttLink) link = ttLink.href;
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
          '.a-price.a-text-price .a-offscreen, span.a-text-strike, [class*="line-through" i]'
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

      // Check meta tags and JSON-LD first for robust PDP extraction
      let metaPrice = 0;
      const metaPriceEl = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"]');
      if (metaPriceEl) {
        metaPrice = parseFloat(metaPriceEl.getAttribute('content') || '0') || 0;
      }
      if (!metaPrice) {
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
          if (metaPrice > 0) return;
          try {
            const json = JSON.parse(s.textContent || '{}');
            const p = json.offers?.price || json.offers?.lowPrice || json.price || json.lowPrice || (Array.isArray(json.offers) ? json.offers[0]?.price : 0);
            if (p) metaPrice = parseFloat(p) || 0;
          } catch (_) {}
        });
      }
      
      if (platform === 'shopee') {
        let apiSuccess = false;
        const shopeeMatch = window.location.href.match(/-i\.(\d+)\.(\d+)/) || window.location.href.match(/i\.(\d+)\.(\d+)/);
        if (shopeeMatch) {
          try {
            const shopId = shopeeMatch[1];
            const itemId = shopeeMatch[2];
            const apiRes = await fetch(`/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`, {
              credentials: 'include',
              headers: {
                'x-api-source': 'pc',
                'x-shopee-language': 'pt-BR'
              }
            });
            if (apiRes.ok) {
              const apiJson = await apiRes.json();
              const item = apiJson.data || apiJson.item;
              if (item) {
                title = item.title || item.name || '';
                description = item.description || '';
                
                const rawPrice = item.price || item.price_min || item.price_max;
                if (rawPrice) pixPrice = rawPrice / 100000;
                
                if (item.price_before_discount > 0) {
                  oldPrice = item.price_before_discount / 100000;
                }
                
                discountPercent = item.raw_discount || 0;
                sales = item.historical_sold || item.sold || item.global_sold_count || 0;
                rating = item.item_rating?.rating_star || 0;
                ratings_count = item.item_rating?.rating_count ? (item.item_rating.rating_count[0] || 0) : 0;
                
                if (Array.isArray(item.attributes)) {
                  attributes = item.attributes.map(attr => ({
                    name: attr.name || attr.key || '',
                    value: attr.value || attr.val || ''
                  }));
                }
                
                if (Array.isArray(item.images)) {
                  pictures = item.images.map(hash => `https://down-br.img.susercontent.com/file/${hash}`);
                  if (pictures.length > 0) {
                    image = pictures[0];
                  }
                }
                apiSuccess = true;
              }
            }
          } catch (e) {
            console.warn('Shopee API fetch failed, falling back to DOM scraping', e);
          }
        }

        if (!apiSuccess) {
          const shopeeTitle = document.querySelector('div[class*="product-title" i], .product-briefing h1, div[class*="ProductTitle" i], h1, div.shopee-product-title, ._4458f2, title');
          if (shopeeTitle) title = shopeeTitle.textContent.replace(/\s*\|\s*Shopee.*$/i, '').trim();
          
          // Shopee PDP Old Price (Original strikethrough price)
          const shopeeOldPriceEl = document.querySelector(
            'div.AP_iE1 del, div.AP_iE1 s, div[class*="price-before-discount" i], del, s, ' +
            'div[class*="original-price" i], div[class*="before-discount" i], div[class*="old-price" i], ' +
            'span[class*="original" i], div[class*="line-through" i], span[class*="line-through" i], div[class*="strike" i], ' +
            'div._2v0Hgx del, div.product-price del, .shopee-product-detail del, ' +
            '.shopee-product-detail [class*="original" i], div[class*="ProductPrice" i] [class*="original" i], ' +
            'div[class*="ProductPrice" i] del, div[class*="ProductPrice" i] s, div.flex.items-center del, div.flex.items-center s'
          );
          if (shopeeOldPriceEl) oldPrice = extractAndesPrice(shopeeOldPriceEl);

          // Shopee PDP Sale / Current Price (.pyzxvq / div.AP_iE1)
          const shopeePriceEls = document.querySelectorAll(
            'div.AP_iE1 .pyzxvq, .product-briefing .pyzxvq, div.AP_iE1, .pyzxvq, ' +
            'div[class*="price-after-discount" i], div[class*="current-price" i], div[class*="Price__price" i], ' +
            'div[class*="ProductPrice" i], div.product-price, .shopee-product-detail .price, [data-sqe="price"]'
          );
          for (const el of shopeePriceEls) {
            if (isInstallmentOrBadgeElement(el)) continue;
            if (el.closest('del, s, [class*="before-discount" i], [class*="original-price" i], [class*="line-through" i]')) continue;
            const p = extractAndesPrice(el);
            if (p > 0) { pixPrice = p; break; }
          }
          if (!pixPrice && metaPrice > 0) pixPrice = metaPrice;

          // Shopee PDP Discount percentage badge
          const shopeeDiscBadge = document.querySelector(
            'div.AP_iE1 [class*="discount" i], div[class*="discount" i], span[class*="discount" i], span[class*="percent" i], ' +
            'div[class*="badge" i], div._236e7Y, [class*="pct" i]'
          );
          if (shopeeDiscBadge) {
            const dm = shopeeDiscBadge.textContent.match(/(\d{1,2})%/);
            if (dm) discountPercent = parseInt(dm[1], 10);
          }

          // Shopee PDP Rating & Reviews count
          const shopeeRatingEl = document.querySelector('div.FllsTu.JXtSdn, div[class*="rating-star" i], .shopee-rating-stars');
          if (shopeeRatingEl) {
            const rm = shopeeRatingEl.textContent.match(/(\d[\.,]\d)/);
            if (rm) rating = parseFloat(rm[1].replace(',', '.'));
          }

          const shopeeReviewsEl = document.querySelector('div.aEDmfN, div[class*="rating-count" i], div[class*="review-count" i]');
          if (shopeeReviewsEl) {
            ratings_count = parseSalesCount(shopeeReviewsEl.textContent);
          }

          // If discount badge exists but old price wasn't caught, compute original price
          if (discountPercent > 0 && oldPrice === 0 && pixPrice > 0) {
            oldPrice = Number((pixPrice / (1 - discountPercent / 100)).toFixed(2));
          }
          
          const shopeeSalesEl = document.querySelector('div[class*="sold" i], span[class*="sold" i], div[class*="sales" i], .shopee-product-detail .sales-count');
          if (shopeeSalesEl) sales = parseSalesCount(shopeeSalesEl.textContent);

          // Shopee PDP Gallery Images
          const shopeeGalleryImgs = document.querySelectorAll('div.Wi_1Rq img, div.BvNoX2 img.P39yUt, div.BvNoX2 img, div.product-briefing img');
          shopeeGalleryImgs.forEach(img => {
            const src = img.src || img.dataset.src || '';
            if (src && !isLikelyAvatar(src, img) && !pictures.includes(src)) {
              pictures.push(src);
            }
          });
          if (pictures.length > 0) image = pictures[0];
        }
      }
      else if (platform === 'amazon') {
        const amzTitle = document.querySelector('span#productTitle, #title');
        if (amzTitle) title = amzTitle.textContent.trim();
        
        const amzPriceEl = document.querySelector('#price_inside_buybox, .a-price .a-offscreen, #corePrice_feature_div .a-offscreen');
        if (amzPriceEl) pixPrice = extractAndesPrice(amzPriceEl);
        if (!pixPrice && metaPrice > 0) pixPrice = metaPrice;
        
        const amzOldPriceEl = document.querySelector('span.a-text-strike, .a-price.a-text-price .a-offscreen');
        if (amzOldPriceEl) oldPrice = extractAndesPrice(amzOldPriceEl);
        
        const amzSalesEl = document.querySelector('span.social-proofing-faceout-title-text span, #averageCustomerReviews_feature_div');
        if (amzSalesEl) sales = parseSalesCount(amzSalesEl.textContent);

        const amzRatingEl = document.querySelector('span.a-icon-alt, i.a-icon-star span');
        if (amzRatingEl) {
          const rm = amzRatingEl.textContent.match(/(\d[\.,]\d)/);
          if (rm) rating = parseFloat(rm[1].replace(',', '.'));
        }

        const amzCountEl = document.querySelector('#acrCustomerReviewText');
        if (amzCountEl) ratings_count = parseSalesCount(amzCountEl.textContent);

        const amzImgs = document.querySelectorAll('#landingImage, #imgTagWrapperId img, #altImages img, img.a-dynamic-image');
        amzImgs.forEach(img => {
          const src = img.src || img.dataset.src || '';
          if (src && !isLikelyAvatar(src, img) && !pictures.includes(src)) {
            pictures.push(src);
          }
        });
        if (pictures.length > 0) image = pictures[0];
      }
      else if (platform === 'mercadolivre') {
        const mlTitle = document.querySelector('h1.ui-pdp-title, .ui-pdp-title');
        if (mlTitle) title = mlTitle.textContent.trim();

        // ML PDP Original Price
        const mlOldPriceEl = document.querySelector('s.ui-pdp-price__original-value, s.andes-money-amount--previous, .ui-pdp-price__part--original');
        if (mlOldPriceEl) oldPrice = extractAndesPrice(mlOldPriceEl);

        // ML PDP Current Price
        const mlCurrentEl = document.querySelector('.ui-pdp-price__second-line .andes-money-amount, .ui-pdp-price__part--medium .andes-money-amount, div.ui-pdp-price');
        if (mlCurrentEl) pixPrice = extractAndesPrice(mlCurrentEl);

        // ML PDP Discount
        const mlDiscEl = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__discount, .andes-money-amount__discount');
        if (mlDiscEl) {
          const dm = mlDiscEl.textContent.match(/(\d{1,2})%/);
          if (dm) discountPercent = parseInt(dm[1], 10);
        }

        // ML PDP Subtitle / Sales
        const mlSubtitle = document.querySelector('p.ui-pdp-header__subtitle, .ui-pdp-subtitle, span.ui-pdp-subtitle');
        if (mlSubtitle) sales = parseSalesCount(mlSubtitle.textContent);

        // ML PDP Rating & Reviews count
        const mlRatingEl = document.querySelector('.ui-pdp-review__rating');
        if (mlRatingEl) {
          const rm = mlRatingEl.textContent.match(/(\d[\.,]\d)/);
          if (rm) rating = parseFloat(rm[1].replace(',', '.'));
        }
        const mlReviewsEl = document.querySelector('.ui-pdp-review__amount');
        if (mlReviewsEl) ratings_count = parseSalesCount(mlReviewsEl.textContent);

        // ML PDP Gallery Images (Strictly from gallery container)
        const mlGalleryImgs = document.querySelectorAll('.ui-pdp-gallery-container img, .ui-pdp-gallery img, img.ui-pdp-gallery__figure__image');
        mlGalleryImgs.forEach(img => {
          const src = img.src || img.dataset.src || '';
          if (src && !isLikelyAvatar(src, img) && !pictures.includes(src)) {
            pictures.push(src);
          }
        });
        if (pictures.length > 0) image = pictures[0];
      }
      else if (platform === 'tiktok' || platform === 'tiktokshop') {
        const scriptData = extractTikTokDataFromScripts();
        if (scriptData.title) title = scriptData.title;
        if (scriptData.description) description = scriptData.description;
        if (scriptData.pixPrice) pixPrice = scriptData.pixPrice;
        if (scriptData.oldPrice) oldPrice = scriptData.oldPrice;
        if (scriptData.sales) sales = scriptData.sales;
        if (scriptData.rating) rating = scriptData.rating;
        if (scriptData.ratings_count) ratings_count = scriptData.ratings_count;
        if (scriptData.attributes && scriptData.attributes.length > 0) attributes = scriptData.attributes;
        if (scriptData.pictures && scriptData.pictures.length > 0) {
          pictures = scriptData.pictures.filter(src => !isLikelyAvatar(src));
          if (pictures.length > 0) image = pictures[0];
        }

        // DOM Scraping with TikTok's real stable elements
        if (!title) {
          const ttTitle = document.querySelector('h1[class*="ProductTitle" i], h1, div[class*="Title" i], [data-testid*="product-title" i], div[data-e2e="pdp-title"]');
          if (ttTitle) title = ttTitle.textContent.trim();
        }

        // TikTok PDP Current Price: span.Headline-Semibold (int) + next element (cents with '.' or ',')
        if (!pixPrice) {
          const headlineSemibold = document.querySelector('span.Headline-Semibold, span[class*="Headline-Semibold" i], span.H2-Semibold');
          if (headlineSemibold) {
            const intText = (headlineSemibold.textContent || '').replace(/\D/g, '');
            if (intText) {
              let centsText = '00';
              const nextEl = headlineSemibold.nextElementSibling;
              if (nextEl) {
                const nextTxt = (nextEl.textContent || '').trim();
                const centsMatch = nextTxt.match(/[\.,](\d{2})/);
                if (centsMatch) {
                  centsText = centsMatch[1];
                }
              }
              const p = parseFloat(`${intText}.${centsText}`);
              if (!isNaN(p) && p > 0) pixPrice = p;
            }
          }
        }

        if (!oldPrice) {
          const ttOldPriceEl = document.querySelector(
            'span.line-through.text-color-UIText3, span.line-through, span[class*="line-through" i], ' +
            'span[class*="PriceBefore" i], span[class*="OriginalPrice" i], del, s'
          );
          if (ttOldPriceEl) oldPrice = extractAndesPrice(ttOldPriceEl);
        }

        if (!discountPercent) {
          const ttDiscEl = document.querySelector('span[class*="discount" i], div[class*="discount" i], span[class*="percent" i]');
          if (ttDiscEl) {
            const dm = ttDiscEl.textContent.match(/-\s*(\d{1,2})%/);
            if (dm) discountPercent = parseInt(dm[1], 10);
          }
        }

        if (!rating) {
          const ratingEl = document.querySelector('span.H2-Semibold, span.P3-Semibold, div[class*="rating" i], span[class*="rating" i]');
          if (ratingEl) {
            const m = ratingEl.textContent.match(/(\d[\.,]\d)/);
            if (m) {
              const val = parseFloat(m[1].replace(',', '.'));
              if (val >= 1.0 && val <= 5.0) rating = val;
            }
          }
        }

        if (!ratings_count) {
          const rcEl = document.querySelector('span.H3-Regular.text-color-UIText2, span[class*="text-color-UIText2" i]');
          if (rcEl) {
            const rm = rcEl.textContent.match(/\((\d+)\)/);
            if (rm) ratings_count = parseInt(rm[1], 10);
          }
        }

        if (!sales) {
          const allSpans = document.querySelectorAll('span, div');
          for (const s of allSpans) {
            const txt = (s.textContent || '').trim();
            if (/vendido\(s\)|vendidos?|sold/i.test(txt) && txt.length < 40) {
              sales = parseSalesCount(txt);
              if (sales > 0) break;
            }
          }
        }

        // TikTok Gallery Images (Strictly from carousel / slick-slider, never whole page / avatar)
        if (pictures.length === 0) {
          const ttGalleryImgs = document.querySelectorAll(
            '.slick-slider-container .slick-slide.slick-active img.object-contain, ' +
            '.slick-slider-container img.object-contain, ' +
            '.slick-slider-container img, ' +
            'div[data-e2e="pdp-gallery"] img, ' +
            'div[class*="gallery" i] img, div[class*="swiper" i] img'
          );
          ttGalleryImgs.forEach(img => {
            const src = img.src || img.dataset.src || '';
            if (src && !isLikelyAvatar(src, img) && !pictures.includes(src)) {
              pictures.push(src);
            }
          });
          if (pictures.length > 0) image = pictures[0];
        }
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
  
      // Extract All Main & Gallery Pictures on PDP if none extracted from scripts/API
      if (pictures.length === 0) {
        let imgNodes = [];
        if (platform === 'tiktok' || platform === 'tiktokshop') {
          // Strictly target product image galleries on TikTok
          imgNodes = document.querySelectorAll(
            'div[class*="gallery" i] img, div[class*="Gallery" i] img, div[class*="carousel" i] img, ' +
            'div[class*="slider" i] img, div[class*="Media" i] img, div[class*="swiper" i] img, ' +
            'div[class*="image-viewer" i] img, div[class*="ProductImage" i] img, div[class*="product-image" i] img, ' +
            'div[class*="goods-image" i] img, div[data-e2e="pdp-gallery"] img, div[data-e2e*="image" i] img'
          );
          if (imgNodes.length === 0) {
            imgNodes = document.querySelectorAll('div[class*="pdp" i] img, div[class*="goods" i] img');
          }
        } else {
          imgNodes = document.querySelectorAll(
            '.ui-pdp-gallery__figure img, .ui-pdp-gallery__thumbnail img, img.ui-pdp-image, span.ui-pdp-gallery__item img, ' +
            '#gallery img, #landingImage, #imgTagWrapperId img, .a-dynamic-image, ' +
            '.product-briefing img, #altImages img, .crop-image-container img, .main-swiper img, ' +
            'div[class*="product-image" i] img, .picture-wrapper img, img[class*="Gallery" i], ' +
            'div[class*="ImageContainer" i] img, img[src*="shopee.com" i], ' +
            'img[src*="susercontent" i], img[src*="shopeesz" i], div[class*="carousel" i] img, ' +
            'div[class*="slider" i] img, div[class*="gallery" i] img, div[class*="media" i] img, ' +
            'img[src*="alicdn" i], img[src*="shein.com" i]'
          );
        }

        imgNodes.forEach(n => {
          const src = n.src || n.dataset.src || n.getAttribute('srcset')?.split(' ')[0];
          if (src && !src.includes('data:image') && !src.includes('1x1') && !src.includes('pixel') && !src.includes('logo') && !isLikelyAvatar(src, n) && !pictures.includes(src)) {
            if (!n.closest('header, nav, footer, [class*="review" i], [class*="comment" i], [class*="user" i], [class*="seller" i], [class*="author" i], [class*="profile" i]')) {
              const cleanSrc = src.replace(/_100x100\./g, '.').replace(/_80x80\./g, '.').replace(/_tn\./g, '.');
              if (!pictures.includes(cleanSrc)) {
                pictures.push(cleanSrc);
              }
            }
          }
        });
      }
  
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

    // Final Normalization & Cross-Field Validations
    if (oldPrice > 0 && pixPrice > 0 && oldPrice < pixPrice) {
      const temp = oldPrice;
      oldPrice = pixPrice;
      pixPrice = temp;
    }
    if (oldPrice === pixPrice) {
      oldPrice = 0;
      discountPercent = 0;
    }
    if (oldPrice > pixPrice && pixPrice > 0 && discountPercent === 0) {
      discountPercent = Math.round(((oldPrice - pixPrice) / oldPrice) * 100);
    }
    if (discountPercent > 99 || discountPercent < 0) {
      discountPercent = 0;
    }
    if (rating < 1.0 || rating > 5.0) {
      rating = 0;
    }

    const resolvedPlatform = getPlatformKey(link || window.location.href);
    const resolvedMarketplace = getMarketplaceName(resolvedPlatform);

    return {
      id, title, pixPrice, oldPrice, discountPercent,
      rating, sales, freeShipping, noInterest,
      image, link,
      marketplace:  resolvedMarketplace,
      timestamp:    Date.now(),

      platform:     resolvedPlatform,
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
      ratings_count:ratings_count || null,
      attributes:   attributes && attributes.length ? attributes : null,
      specs:        attributes && attributes.length ? attributes : null
    };
  } catch (err) {
    handleGlobalError(err, 'Parsing de Produto');
    return null;
  }
}

/* ── Helpers de Formatação e Leitura ── */

function getPlatformKey(targetUrl) {
  const str = String(targetUrl || (typeof window !== 'undefined' ? (window.location.href + ' ' + window.location.hostname) : '')).toLowerCase();
  if (str.includes('tiktok') || str.includes('byteoversea') || str.includes('tiktokv')) return 'tiktokshop';
  if (str.includes('shopee') || str.includes('shope.ee') || str.includes('s.shopee')) return 'shopee';
  if (str.includes('mercadolivre') || str.includes('mercadolibre') || str.includes('meli.la') || str.includes('mliv.re')) return 'mercadolivre';
  if (str.includes('amazon') || str.includes('amzn.to') || str.includes('a.co')) return 'amazon';
  if (str.includes('aliexpress') || str.includes('ali.ski') || str.includes('a.aliexpress')) return 'aliexpress';
  if (str.includes('shein') || str.includes('she.in')) return 'shein';
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
  // Strip out currency price strings and rating scores so numbers in prices don't pollute sales counts
  let t = String(text)
    .replace(/R\$\s*[\d.]{1,12},\d{2}/gi, '')
    .replace(/R\$\s*[\d.]+/gi, '')
    .replace(/\b[1-5][.,]\d\b/g, '')
    .replace(/ /g, ' ')
    .replace(/\n/g, ' ');

  const reList = [
    /(\d+(?:[\.,]\d+)?)\s*(mil|k)\+?\s*(?:produtos?\s*)?(?:vendidos?|vendido\(s\)|comprados?|comprado\(s\)|compras?|vendido|sold|bought|vendas?)/i,
    /(?:vendidos?|vendido\(s\)|comprados?|comprado\(s\)|sold|bought|compras?|vendas?)\s*:?\s*(\d+(?:[\.,]\d+)?)\s*(mil|k)?/i,
    /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(mil|k)?\s*\+?\s*(?:produtos?\s*)?(?:vendidos?|vendido\(s\)|comprados?|comprado\(s\)|compras?|vendido|sold|bought|vendas?)/i,
    /(\d+(?:[\.,]\d+)?)\s*(mil|k)\+\s*(?:vendidos?|vendido\(s\)|comprados?|sold|bought)?/i,
    /(\d+)\+?\s*(?:vendidos?|vendido\(s\)|comprado\(s\)|comprado|sold|bought|vendas)/i,
    /(\d+(?:[\.,]\d+)?)\s*(?:mil|k)?\+?\s*(?:vendidos?|vendido\(s\)|comprados?|sold|bought|comprados no último mês|bought in past month)/i
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
  const semJuros = scopeText.match(/(?:em\s*at[ée]\s*|ou\s*|)\s*(\d{1,2})\s*x\s*(?:de\s*)?R\$\s*([\d.]+[,\.]\d{2})\s*sem\s*juros/i)
                || scopeText.match(/(\d{1,2})\s*x\s*R\$\s*([\d.]+[,\.]\d{2})\s*sem\s*juros/i)
                || scopeText.match(/(\d{1,2})\s*x\s*sem\s*juros/i);
  if (semJuros) {
    if (semJuros[2]) {
      return `${semJuros[1]}x de R$ ${semJuros[2].replace('.', ',')} sem juros`;
    }
    return `${semJuros[1]}x sem juros`;
  }

  const qualquer = scopeText.match(/(?:em\s*at[ée]\s*|ou\s*|)\s*(\d{1,2})\s*x\s*(?:de\s*)?R\$\s*([\d.]+[,\.]\d{2})/i)
                || scopeText.match(/(\d{1,2})\s*x\s*R\$\s*([\d.]+[,\.]\d{2})/i)
                || scopeText.match(/(\d{1,2})\s*x\s*de\s*([\d.]+[,\.]\d{2})/i);
  if (qualquer) return `${qualquer[1]}x de R$ ${qualquer[2].replace('.', ',')}`;

  const mes = scopeText.match(/R\$\s*([\d.]+[,\.]\d{2})\s*\/\s*m[êe]s/i);
  if (mes) return `R$ ${mes[1].replace('.', ',')}/mês`;

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

function getMarketplaceName(urlOrPlatform) {
  const plat = urlOrPlatform ? getPlatformKey(urlOrPlatform) : getPlatformKey();
  if (plat === 'mercadolivre') return 'Mercado Livre';
  if (plat === 'shopee') return 'Shopee';
  if (plat === 'amazon') return 'Amazon';
  if (plat === 'shein') return 'Shein';
  if (plat === 'aliexpress') return 'AliExpress';
  if (plat === 'tiktokshop' || plat === 'tiktok') return 'TikTok Shop';
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

/**
 * Gera o link de afiliado REAL do Mercado Livre (short link meli.la) usando a
 * sessão logada do usuário no próprio Mercado Livre (mesma origem, cookies +
 * CSRF da página). Só funciona se o usuário estiver logado no Mercado Livre
 * Afiliados. Retorna null silenciosamente em qualquer falha (não trava a mineração).
 */
async function generateMercadoLivreAffiliateLink(productUrl) {
  if (!productUrl) return null;
  try {
    const base = 'https://www.mercadolivre.com.br';
    const api  = '/affiliate-program/api/v2/stripe/user';

    // CSRF token da página (meta, script inline ou cookie _csrf)
    let csrf = null;
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) csrf = meta.getAttribute('content');
    if (!csrf) { const m = document.cookie.match(/_csrf=([^;]+)/); if (m) csrf = decodeURIComponent(m[1]); }

    const headers = { 'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json' };
    if (csrf) headers['x-csrf-token'] = csrf;

    // 1) Buscar a tag de afiliado (também valida se está logado no programa)
    const tagsRes = await fetch(`${base}${api}/tags`, { method: 'GET', credentials: 'include', headers });
    if (!tagsRes.ok) return null;
    const tagsData = await tagsRes.json();
    const tags = tagsData.tags || tagsData;
    if (!Array.isArray(tags) || tags.length === 0) return null;
    const affiliateTag = typeof tags[0] === 'object' ? (tags[0].tag || tags[0].name || tags[0].id) : tags[0];
    if (!affiliateTag) return null;

    // 2) Gerar o short link de afiliado (endpoint createLink, campo "tag")
    const linkRes = await fetch(`${base}/affiliate-program/api/v2/affiliates/createLink`, {
      method: 'POST', credentials: 'include', headers,
      body: JSON.stringify({ urls: [String(productUrl).split('#')[0]], tag: affiliateTag })
    });
    if (!linkRes.ok) return null;
    const linkData = await linkRes.json();
    const r0 = (linkData.urls && linkData.urls[0]) || {};
    const short = r0.short_url || r0.short_link || null;

    // Só aceitar short link de afiliado meli.la (o que atribui comissão)
    if (short && short.startsWith('https://meli.la/')) return short;
    return null;
  } catch (e) {
    return null;
  }
}

// ─── Extrair link de afiliado (botão do painel) ──────────────────────────────
function escapeHtmlAff(s) {
  return String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

function showAffiliateResult(title, ok, bodyHtml, rawText) {
  let ov = document.getElementById('am-aff-overlay');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'am-aff-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif';
  const color = ok === true ? '#10b981' : ok === false ? '#ef4444' : '#93a0b5';
  ov.innerHTML = `
    <div style="background:#0e1119;border:1px solid #1e2636;border-radius:16px;max-width:420px;width:100%;max-height:88vh;overflow-y:auto;padding:16px;color:#eef2f9;box-shadow:0 20px 60px rgba(0,0,0,.6)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:14px;font-weight:800;color:${color}">${escapeHtmlAff(title)}</span>
        <button id="am-aff-close" style="background:#151a26;border:1px solid #1e2636;color:#93a0b5;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:15px">×</button>
      </div>
      <div style="font-size:12px;line-height:1.5">${bodyHtml}</div>
      ${rawText ? `<button id="am-aff-copy" style="margin-top:12px;width:100%;padding:10px;border-radius:10px;background:#2563eb;color:#fff;border:none;font-size:12px;font-weight:700;cursor:pointer">Copiar resultado</button>` : ''}
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  const c = ov.querySelector('#am-aff-close'); if (c) c.onclick = () => ov.remove();
  const cp = ov.querySelector('#am-aff-copy'); if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(rawText); cp.textContent = 'Copiado!'; setTimeout(() => { cp.textContent = 'Copiar resultado'; }, 1500); } catch (e) {} };
}

async function extractAmazonAffiliate() {
  const diag = { platform: 'amazon', url: window.location.href, siteStripe: false, trackingId: null, shortLink: null, notes: [] };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 800;
    diag.isMobile = isMobile;
    diag.isProductPage = /\/dp\/|\/gp\/product\//.test(window.location.pathname);
    const wrap = document.querySelector('#amzn-ss-wrap, [id^="amzn-ss"]');
    diag.siteStripe = !!wrap;
    if (!wrap) {
      diag.error = isMobile
        ? 'A SiteStripe da Amazon NÃO existe no celular (é só no computador). No celular, use a TAG: abra o app → Configurações → Amazon e cole sua tag de associado (ex.: suatag-20). O app monta seu link de afiliado sozinho em todos os produtos da Amazon.'
        : (diag.isProductPage
            ? 'SiteStripe não encontrada nesta página de produto. Faça login no Amazon Associados e confirme que a barra SiteStripe aparece no topo.'
            : 'Você não está numa página de PRODUTO. Abra um produto da Amazon (URL com /dp/) logado no Associados e tente de novo. (No celular a SiteStripe não existe — use a tag no app.)');
      return diag;
    }
    // Tag de associado
    const trk = document.querySelector('#amzn-ss-tracking-id');
    if (trk) diag.trackingId = trk.value || (trk.options && trk.selectedIndex >= 0 ? trk.options[trk.selectedIndex].value : null);

    // NÃO clicamos em "Texto do link" (ele navega e troca a página). Em vez disso,
    // procuramos o link curto (amzn.to / link.amazon) já visível no painel que VOCÊ abriu.
    const findShort = () => {
      // 1) campos de formulário (textarea/input) da SiteStripe
      const fields = Array.from(document.querySelectorAll('textarea, input'));
      for (const el of fields) { const v = (el.value || '').trim(); const m = v.match(/https?:\/\/(?:amzn\.to|link\.amazon)\/\S+/i); if (m) return m[0]; }
      // 2) links e textos dentro da barra SiteStripe
      const nodes = Array.from(document.querySelectorAll('[id^="amzn-ss"] a, [id^="amzn-ss"] textarea, [id^="amzn-ss"] input, [id^="amzn-ss"] span, [id*="shortlink" i]'));
      for (const el of nodes) { const v = (el.value || el.getAttribute?.('href') || el.textContent || '').trim(); const m = v.match(/https?:\/\/(?:amzn\.to|link\.amazon)\/\S+/i); if (m) return m[0]; }
      return null;
    };

    // Poll por ~4.5s (você pode ter acabado de abrir o painel "Texto do link")
    for (let i = 0; i < 15 && !diag.shortLink; i++) { diag.shortLink = findShort(); if (!diag.shortLink) await wait(300); }

    // Despeja a estrutura da SiteStripe para eu refinar os seletores, se preciso
    try {
      diag.dump = Array.from(document.querySelectorAll('[id^="amzn-ss"]')).slice(0, 45).map((n) => ({
        id: n.id, tag: n.tagName,
        val: (n.value || '').slice(0, 90),
        href: (n.getAttribute && n.getAttribute('href')) || '',
        txt: (n.textContent || '').trim().slice(0, 40),
      }));
    } catch (e) {}

    if (!diag.shortLink) diag.error = 'A SiteStripe carregou, mas o link curto ainda não estava visível. FAÇA ASSIM: 1) na barra SiteStripe (topo), toque em "Texto do link" para ABRIR o painel que mostra o link curto (amzn.to); 2) SEM fechar esse painel, toque em "Extrair link de afiliado". (A extensão não clica mais sozinha para não trocar de página.) Se ainda não pegar, toque em "Copiar resultado" e me envie.';
    return diag;
  } catch (e) { diag.error = 'Exceção: ' + (e && e.message || String(e)); return diag; }
}

async function extractMLAffiliateDiag() {
  const diag = { platform: 'mercadolivre', url: window.location.href, csrf: false, tagsStatus: null, tags: 0, linkStatus: null, shortLink: null };
  try {
    const base = 'https://www.mercadolivre.com.br';
    const api = '/affiliate-program/api/v2/stripe/user';
    const cleanUrl = window.location.origin + window.location.pathname;
    let csrf = null;
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) csrf = meta.getAttribute('content');
    if (!csrf) { const m = document.cookie.match(/_csrf=([^;]+)/); if (m) csrf = decodeURIComponent(m[1]); }
    diag.csrf = !!csrf;
    const headers = { 'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json' };
    if (csrf) headers['x-csrf-token'] = csrf;
    const tagsRes = await fetch(`${base}${api}/tags`, { method: 'GET', credentials: 'include', headers });
    diag.tagsStatus = tagsRes.status;
    if (tagsRes.ok) {
      const d = await tagsRes.json().catch(() => null);
      const tags = (d && (d.tags || d)) || [];
      diag.tags = Array.isArray(tags) ? tags.length : 0;
      if (Array.isArray(tags) && tags.length) {
        const tagId = tags[0].id || tags[0];
        const linkRes = await fetch(`${base}${api}/links`, { method: 'POST', credentials: 'include', headers, body: JSON.stringify({ url: cleanUrl, tag_id: tagId }) });
        diag.linkStatus = linkRes.status;
        if (linkRes.ok) { const ld = await linkRes.json().catch(() => null); diag.shortLink = (ld && (ld.short_url || ld.short_link || ld.url)) || null; }
        else { diag.linkBody = (await linkRes.text().catch(() => '')).slice(0, 200); }
      }
    } else {
      diag.tagsBody = (await tagsRes.text().catch(() => '')).slice(0, 200);
    }
  } catch (e) { diag.error = e && e.message || String(e); }
  return diag;
}

async function extractAffiliateLinkFlow() {
  const platform = getPlatformKey();
  showAffiliateResult('Extraindo...', null, '<div style="padding:16px;text-align:center;color:#93a0b5">Extraindo link de afiliado, aguarde...</div>', '');
  try {
    if (platform === 'mercadolivre') {
      // Roda no MAIN world via background (contexto real da página) — método do Achadinho
      const r = await new Promise((resolve) => {
        try { chrome.runtime.sendMessage({ action: 'GENERATE_ML_LINK', url: window.location.href }, (resp) => resolve(resp || { success: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'sem resposta do background' })); }
        catch (e) { resolve({ success: false, error: e && e.message || String(e) }); }
      });
      const raw = JSON.stringify(r, null, 2);
      const diagBlock = `<hr style="border-color:#1e2636;margin:10px 0"><p style="font-size:10px;color:#93a0b5">Diagnóstico (toque em "Copiar resultado" e me mande):</p><pre style="font-size:10px;white-space:pre-wrap;color:#cbd5e1">${escapeHtmlAff(raw)}</pre>`;
      if (r && r.success && r.short_link) showAffiliateResult('Mercado Livre ✓', true, `<p>Link de afiliado extraído:</p><a href="${escapeHtmlAff(r.short_link)}" target="_blank" style="color:#60a5fa;word-break:break-all">${escapeHtmlAff(r.short_link)}</a>${diagBlock}`, r.short_link);
      else showAffiliateResult('Mercado Livre ✗', false, `<p>${escapeHtmlAff((r && r.error) || 'Não consegui extrair.')} Confira se está logado e <b>inscrito no Mercado Livre Afiliados</b>.</p>${diagBlock}`, raw);
      return;
    }
    if (platform === 'amazon') {
      // Via API interna da Amazon (getStoreTagMap + getShortUrl) no MAIN world — funciona no mobile
      const r = await new Promise((resolve) => {
        try { chrome.runtime.sendMessage({ action: 'GENERATE_AMAZON_LINK', url: window.location.href.split('#')[0] }, (resp) => resolve(resp || { success: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'sem resposta do background' })); }
        catch (e) { resolve({ success: false, error: e && e.message || String(e) }); }
      });
      const raw = JSON.stringify(r, null, 2);
      const diagBlock = `<hr style="border-color:#1e2636;margin:10px 0"><p style="font-size:10px;color:#93a0b5">Diagnóstico (toque em "Copiar resultado" e me mande):</p><pre style="font-size:10px;white-space:pre-wrap;color:#cbd5e1">${escapeHtmlAff(raw)}</pre>`;
      if (r && r.success && r.short_link) showAffiliateResult('Amazon ✓', true, `<p>Link de afiliado:</p><a href="${escapeHtmlAff(r.short_link)}" target="_blank" style="color:#60a5fa;word-break:break-all">${escapeHtmlAff(r.short_link)}</a>${r.tag ? `<p style="margin-top:8px">Tag de associado: <b>${escapeHtmlAff(r.tag)}</b></p>` : ''}${r.shortened === false ? '<p style="font-size:10px;color:#f59e0b;margin-top:6px">(Link longo — a Amazon não encurtou; mesmo assim é afiliado e paga comissão.)</p>' : ''}${diagBlock}`, r.short_link);
      else showAffiliateResult('Amazon ✗', false, `<p>${escapeHtmlAff((r && r.error) || 'Não consegui gerar o link.')} Confirme que está logado no <b>Amazon Associados</b> nesta aba.</p>${diagBlock}`, raw);
      return;
    }
    if (platform === 'shopee') { showAffiliateResult('Shopee', false, `<p>Na Shopee o link de afiliado (s.shopee) é gerado <b>automaticamente no app</b> pela API oficial — basta configurar o App ID e o Secret nas Configurações. Não precisa extrair aqui.</p>`, 'shopee via API'); return; }
    if (platform === 'tiktokshop') { showAffiliateResult('TikTok Shop', false, `<p>No TikTok Shop o link de afiliado é gerado no app deles. Por enquanto, cole seu link manualmente ao divulgar.</p>`, 'tiktok manual'); return; }
    showAffiliateResult('Plataforma', false, `<p>Extração ainda não suportada nesta plataforma (${escapeHtmlAff(platform)}).</p>`, platform);
  } catch (e) {
    showAffiliateResult('Erro', false, `<p>Erro inesperado: ${escapeHtmlAff(e && e.message || String(e))}</p>`, String(e && e.stack || e));
  }
}

// ─── Extração de CUPONS ───────────────────────────────────────────────────────
async function extractMLCoupons() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
  const result = { platform: 'mercadolivre', coupons: [], pages: 0, error: null };
  try {
    if (!/\/afiliados\/coupons/i.test(location.pathname + location.href)) {
      result.error = 'Abra a página de cupons de afiliado do Mercado Livre e tente de novo.';
      return result;
    }
    const tab = document.querySelector('#coupons-tabs-tab-1');
    if (tab && tab.getAttribute('aria-selected') !== 'true') { try { tab.click(); await sleep(1300); } catch (e) {} }

    const parseDiscount = (raw) => {
      if (!raw) return { discountType: null, discountValue: null };
      const pct = raw.match(/(\d{1,3})\s*%/);
      if (pct) { const v = parseInt(pct[1], 10); if (v >= 1 && v <= 100) return { discountType: 'percent', discountValue: v }; }
      const money = raw.match(/R\$\s*([\d.]+(?:,\d{2})?)/i);
      if (money) return { discountType: 'fixed', discountValue: parseFloat(money[1].replace(/\./g, '').replace(',', '.')) };
      return { discountType: null, discountValue: null };
    };
    const isDisabled = (card) => {
      const badge = card.querySelector('[class*="__badge"] .andes-badge__content') || card.querySelector('.andes-badge__content');
      if (badge && /inativo|expirado/i.test(txt(badge))) return true;
      return /inativo|expirado/i.test(txt(card));
    };

    const seen = new Set();
    let page = 0;
    while (page < 30) {
      page++;
      await sleep(700);
      const cards = Array.from(document.querySelectorAll('.generated-coupon-item'));
      for (const card of cards) {
        const codeEl = card.querySelector('[class*="__inner-content"] b') || card.querySelector('b');
        const code = txt(codeEl).replace(/^#/, '').trim();
        if (!code || seen.has(code)) continue;
        seen.add(code);
        const discountRaw = txt(card.querySelector('[class*="__inner-details-title"]')) || null;
        const d = parseDiscount(discountRaw);
        const linkEl = card.querySelector('[class*="__category-link"] a[href], a[class*="__link"][href]');
        result.coupons.push({
          platform: 'mercadolivre', code, discountRaw,
          discountType: d.discountType, discountValue: d.discountValue,
          expirationRaw: txt(card.querySelector('[class*="__expiration"]')) || null,
          category: txt(card.querySelector('[class*="__category"]:not([class*="__category-link"])')) || null,
          productsUrl: linkEl ? linkEl.href : null,
          expired: isDisabled(card),
          rawText: txt(card).slice(0, 400),
        });
      }
      const next = document.querySelector('.andes-pagination [data-andes-pagination-control="next"], nav[aria-label*="agina" i] a[data-andes-pagination-control="next"]');
      const li = next && next.closest('li');
      const disabled = next && (next.getAttribute('aria-disabled') === 'true' || (li && /disabled/.test(li.className)));
      if (!next || disabled) break;
      try { next.click(); await sleep(1600); } catch (e) { break; }
    }
    result.pages = page;
    return result;
  } catch (e) { result.error = (e && e.message) || String(e); return result; }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'RUN_COUPON_EXTRACTION') {
    extractMLCoupons().then(sendResponse).catch((e) => sendResponse({ coupons: [], error: (e && e.message) || String(e) }));
    return true;
  }
  return false;
});

async function processAndFilterProduct(product, manual = false) {
  if (!product || !product.title) {
    if (manual) showToast('❌ Erro ao extrair dados do produto. Tente novamente.', true);
    return false;
  }

  product = await enrichProductDataInBackground(product);

  // Link de afiliado REAL do Mercado Livre (meli.la) via sessão logada — aditivo e seguro
  try {
    if (product && product.platform === 'mercadolivre' && !product.affiliate_link) {
      // Tenta pelo MAIN world (background) — método confiável do Achadinho; cai para o isolado se falhar
      let mlAff = null;
      try {
        const r = await new Promise((resolve) => {
          const mlUrl = (product.original_link && /^https?:\/\//.test(product.original_link)) ? product.original_link : window.location.href;
          try { chrome.runtime.sendMessage({ action: 'GENERATE_ML_LINK', url: mlUrl }, (resp) => resolve(resp || null)); }
          catch (e) { resolve(null); }
        });
        if (r && r.success && r.short_link) mlAff = r.short_link;
      } catch (e) { /* ignore */ }
      if (!mlAff) mlAff = await generateMercadoLivreAffiliateLink(product.original_link || product.link);
      if (mlAff) product.affiliate_link = mlAff;
    }

    // Amazon: gera o link curto (amzn.to) na hora da mineração, via API interna (MAIN world)
    if (product && product.platform === 'amazon' && !product.affiliate_link) {
      try {
        const r = await new Promise((resolve) => {
          const azUrl = ((product.original_link && /^https?:\/\//.test(product.original_link)) ? product.original_link : window.location.href).split('#')[0];
          try { chrome.runtime.sendMessage({ action: 'GENERATE_AMAZON_LINK', url: azUrl }, (resp) => resolve(resp || null)); }
          catch (e) { resolve(null); }
        });
        if (r && r.success && r.short_link) product.affiliate_link = r.short_link;
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* mantém sem link de afiliado */ }

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

async function mineCurrentPageProduct(manual = true) {
  const prod = await extractRealProductData(null);
  if (prod) {
    await processAndFilterProduct(prod, manual);
  } else {
    showToast('❌ Erro ao minerar produto nesta página.', true);
  }
}

async function mineCardProduct(card, manual = false) {
  const prod = await extractRealProductData(card);
  if (prod) {
    return await processAndFilterProduct(prod, manual);
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

    const rawCards = document.querySelectorAll(getProductCardSelectors().join(', '));
    const processedCards = new Set();

    rawCards.forEach((rawEl) => {
      const card = getProductCardContainer(rawEl);
      if (card && !processedCards.has(card)) {
        processedCards.add(card);
        const rect = card.getBoundingClientRect();
        if (rect.top >= -120 && rect.bottom <= window.innerHeight + 240) {
          if (!card.dataset.amChecked) {
            card.dataset.amChecked = '1';
            mineCardProduct(card, false); // Auto-mine usa filtros
          }
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

  const report = `### ⚠️ Diagnóstico - Affiliate Miner v1.0.9\n**Hora**: ${errLog.time}\n**URL**: ${errLog.url}\n**Contexto**: ${errLog.context}\n\n**Erro**:\n\`\`\`\n${errLog.message}\n${errLog.stack}\n\`\`\`\n*Cole no chat do assistente AI!*`;

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
    if (msg.action === 'UPDATE_LOGIN_STATUS') {
      isLoggedIn = msg.isLoggedIn;
      extActive = msg.extActive;
      if (isExtensionEnabled()) {
        injectOverlayCSS();
        renderDraggableOverlay();
        renderFloatingTrigger();
        updatePageHighlighting();
        startPdpButtonWatcher();
      } else {
        hideAllOverlays();
      }
    } else if (msg.action === 'SET_EXT_ACTIVE') {
      extActive = msg.active;
      chrome.storage.local.get(['affiliateMinerState'], (res) => {
        if (res.affiliateMinerState) {
          isLoggedIn = res.affiliateMinerState.isLoggedIn ?? false;
        }
        if (isExtensionEnabled()) {
          injectOverlayCSS();
          renderDraggableOverlay();
          renderFloatingTrigger();
          updatePageHighlighting();
          startPdpButtonWatcher();
        } else {
          hideAllOverlays();
        }
      });
    } else if (msg.action === 'SET_AUTO_MINE') {
      autoMine = msg.autoMine;
      if (isExtensionEnabled()) {
        renderDraggableOverlay();
        if (autoMine) startAutoMining(); else stopAutoMining();
      } else {
        hideAllOverlays();
      }
    } else if (msg.action === 'SET_FILTERS') {
      qualityFilters = msg.filters;
      if (isExtensionEnabled()) {
        renderDraggableOverlay();
      }
    } else if (msg.action === 'UPDATE_MINED_LIST') {
      minedProducts = msg.minedProducts;
      if (isExtensionEnabled()) {
        renderDraggableOverlay();
      }
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
