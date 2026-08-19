/* Affiliate Miner Popup JS — versão sincronizada com o manifest (v1.3.5)
   MUDANÇAS recentes:
   - Login agora usa Firebase Auth real (REST API)
   - "Enviar Todos" agora sincroniza com Firestore real
   - Logout limpa tokens de autenticação
   - Tab "Criar Conta" abre o app no navegador
   - storage.onChanged sincroniza novos produtos automaticamente
   - Tudo mais permanece idêntico ao original
*/

const FIREBASE_API_KEY  = 'AIzaSyDw59KOShDxjw0AKiQDYtHDJSVD5Ru1-KU';
const FIREBASE_PROJECT  = 'afiliateoficial2026';
const FIREBASE_DATABASE = 'ai-studio-afiliate-06286741-5088-42ae-9702-cf4c78eb1a07';
const APP_URL           = 'https://afiliate.onrender.com';
const FS_BASE           = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIREBASE_DATABASE}/documents`;

document.addEventListener('DOMContentLoaded', () => {
  // Versão dinâmica (sempre igual ao manifest)
  try {
    const vb = document.getElementById('v-badge');
    if (vb && chrome.runtime && chrome.runtime.getManifest) vb.textContent = 'v' + chrome.runtime.getManifest().version;
  } catch (e) {}
  // ── Elements (idêntico ao original) ──────────────────────
  const screenLoading  = document.getElementById('screen-loading');
  const screenLogin    = document.getElementById('screen-login');
  const screenMain     = document.getElementById('screen-main');

  const tabLogin       = document.getElementById('tab-login');
  const tabRegister    = document.getElementById('tab-register');
  const btnLogin       = document.getElementById('btn-login');
  const btnLoginText   = document.getElementById('btn-login-text');
  const registerNote   = document.getElementById('register-note');
  const btnLogout      = document.getElementById('btn-logout');

  const loginEmailInput    = document.getElementById('login-email');
  const loginPasswordInput = document.getElementById('login-password');
  const userDisplayEmail   = document.getElementById('user-display-email');

  const btnTogglePassword = document.getElementById('btn-toggle-password');
  const iconEye           = document.getElementById('icon-eye');
  const iconEyeOff        = document.getElementById('icon-eye-off');
  const noAccountBox      = document.getElementById('no-account-box');
  const btnCreateAccount  = document.getElementById('btn-create-account');

  const toggleExtActive = document.getElementById('toggle-ext-active');
  const toggleAutoMine  = document.getElementById('toggle-auto-mine');
  const automineBadge   = document.getElementById('automine-badge');

  const metricMined     = document.getElementById('metric-mined');
  const metricDiscarded = document.getElementById('metric-discarded');
  const metricRate      = document.getElementById('metric-rate');

  const filterCategory    = document.getElementById('filter-category');
  const filterMinPrice    = document.getElementById('filter-min-price');
  const filterMaxPrice    = document.getElementById('filter-max-price');
  const filterMinDiscount = document.getElementById('filter-min-discount');
  const filterMinRating   = document.getElementById('filter-min-rating');
  const filterMinSales    = document.getElementById('filter-min-sales');
  const filterNoInterest  = document.getElementById('filter-no-interest');
  const filterFreeShipping= document.getElementById('filter-free-shipping');

  const historyCountBadge = document.getElementById('history-count-badge');
  const historyList       = document.getElementById('history-list');
  const btnClearHistory   = document.getElementById('btn-clear-history');
  const btnSendAll        = document.getElementById('btn-send-all');
  const btnSendText       = document.getElementById('btn-send-text');

  // Cupons: a extração agora é feita pelo botão único "Extrair cupons" do painel
  // flutuante na loja (content.js), abaixo de "Extrair link de afiliado".

  const btnShowDiagModal  = document.getElementById('btn-show-diag-modal');
  const modalErrorReport  = document.getElementById('modal-error-report');
  const btnCloseErrorModal= document.getElementById('btn-close-error-modal');
  const errorReportText   = document.getElementById('error-report-text');
  const btnCopyErrorReport= document.getElementById('btn-copy-error-report');

  let isRegisterMode = false;

  // ── State (adicionados: uid, idToken, refreshToken, tokenExpiresAt) ──
  let state = {
    isLoggedIn:      false,
    userEmail:       '',
    uid:             '',
    idToken:         '',
    refreshToken:    '',
    tokenExpiresAt:  0,
    extActive:       false,
    autoMine:        false,
    discardedCount:  0,
    minedProducts:   [],
    qualityFilters: {
      category: '', minPrice: 0, maxPrice: null,
      minDiscount: 0, minRating: 0, minSales: 0,
      noInterest: false, freeShipping: false,
      selectedMarketplaces: { ml: false, shopee: false, amazon: false, shein: false, aliexpress: false }
    },
    lastError: null
  };

  // ── Helpers (idênticos ao original) ─────────────────────
  function notifyActiveTab(action, data = {}) {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action, ...data }).catch(() => {});
        }
      });
    }
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function loadState() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['affiliateMinerState'], (res) => {
        if (res.affiliateMinerState) {
          state = { ...state, ...res.affiliateMinerState };
        }
        updateUI();

        // ── NOVO: escutar mudanças no storage e sincronizar novos produtos ──
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== 'local' || !changes.affiliateMinerState) return;
          const newS = changes.affiliateMinerState.newValue;
          const oldS = changes.affiliateMinerState.oldValue;
          if (!newS) return;

          const oldCount = oldS?.minedProducts?.length ?? 0;
          const newCount = newS.minedProducts?.length ?? 0;

          state = { ...state, ...newS };
          updateUI();

          // NB: A sincronização automática de novos produtos é feita EXCLUSIVAMENTE
          // pelo background.js (service worker), que roda mesmo com o popup fechado.
          // Aqui apenas atualizamos a UI para não duplicar escritas nem inflar o
          // contador diário (dailyStats). O envio manual continua em "Enviar Todos".
          void newCount; void oldCount;
        });
      });
    } else {
      const local = localStorage.getItem('affiliateMinerState');
      if (local) state = JSON.parse(local);
      updateUI();
    }
  }

  function saveState() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ affiliateMinerState: state });
    } else {
      localStorage.setItem('affiliateMinerState', JSON.stringify(state));
    }
  }

  function updateUI() {
    if (screenLoading) screenLoading.classList.remove('active');

    // Notify the active tab of current login & activation status
    notifyActiveTab('UPDATE_LOGIN_STATUS', { isLoggedIn: !!state.isLoggedIn, extActive: !!state.extActive });

    if (!state.isLoggedIn) {
      if (screenLogin) screenLogin.classList.add('active');
      if (screenMain)  screenMain.classList.remove('active');
      return;
    }

    if (screenLogin) screenLogin.classList.remove('active');
    if (screenMain)  screenMain.classList.add('active');

    if (userDisplayEmail) userDisplayEmail.textContent = state.userEmail || 'Conectado';

    if (toggleExtActive) toggleExtActive.checked = !!state.extActive;
    if (toggleAutoMine)  toggleAutoMine.checked  = !!state.autoMine;
    if (automineBadge)   automineBadge.style.display = state.autoMine ? 'inline-block' : 'none';

    if (filterCategory)    filterCategory.value    = state.qualityFilters.category    || '';
    if (filterMinPrice)    filterMinPrice.value    = state.qualityFilters.minPrice    ?? 0;
    if (filterMaxPrice)    filterMaxPrice.value    = state.qualityFilters.maxPrice    ?? '';
    if (filterMinDiscount) filterMinDiscount.value = state.qualityFilters.minDiscount ?? 0;
    if (filterMinRating)   filterMinRating.value   = state.qualityFilters.minRating   ?? 0;
    if (filterMinSales)    filterMinSales.value    = state.qualityFilters.minSales    ?? 0;
    if (filterNoInterest)  filterNoInterest.checked  = !!state.qualityFilters.noInterest;
    if (filterFreeShipping)filterFreeShipping.checked= !!state.qualityFilters.freeShipping;

    const minedCount    = state.minedProducts ? state.minedProducts.length : 0;
    const discardedCount= state.discardedCount || 0;
    const totalProcessed= minedCount + discardedCount;
    const rate          = totalProcessed > 0 ? Math.round((minedCount / totalProcessed) * 100) : 100;

    if (metricMined)     metricMined.textContent     = minedCount;
    if (metricDiscarded) metricDiscarded.textContent  = discardedCount;
    if (metricRate)      metricRate.textContent       = `${rate}%`;

    if (historyCountBadge) historyCountBadge.textContent = minedCount;
    if (btnSendText) btnSendText.textContent = `Enviar Todos (${minedCount}) para o Afiliate`;

    renderHistoryList();
  }

  function renderHistoryList() {
    if (!historyList) return;
    historyList.innerHTML = '';

    if (!state.minedProducts || state.minedProducts.length === 0) {
      historyList.innerHTML = `
        <div class="history-empty">
          <p>Nenhum produto minerado salvo ainda.</p>
          <span style="font-size:10px; color:#64748b; margin-top:4px; display:block;">Ative a extensão e os produtos minerados reais aparecerão aqui.</span>
        </div>
      `;
      return;
    }

    state.minedProducts.forEach((prod) => {
      const card = document.createElement('div');
      card.className = 'product-card';

      // Suporta tanto campos antigos (pixPrice, oldPrice) quanto novos (price_to, price_from)
      const pixVal    = prod.pixPrice  || 0;
      const oldVal    = prod.oldPrice  || 0;
      let pixPriceStr = prod.price_to || prod.pix_price;
      if (!pixPriceStr && pixVal > 0) {
        pixPriceStr = `R$ ${parseFloat(pixVal).toFixed(2).replace('.', ',')}`;
      }

      let oldPriceStr = prod.price_from;
      if (!oldPriceStr && oldVal && oldVal > pixVal) {
        oldPriceStr = `R$ ${parseFloat(oldVal).toFixed(2).replace('.', ',')}`;
      }

      // Se não há price_to mas temos price_from / oldPrice, exibir "Consulte no link" em vez de "R$ --" ou "R$ 0,00"
      if (!pixPriceStr || pixPriceStr === 'R$ 0,00' || pixPriceStr === '0,00') {
        if (oldPriceStr) {
          pixPriceStr = 'Consulte no link';
        } else {
          pixPriceStr = 'R$ --';
        }
      }

      const discountStr = prod.discount_pct || prod.discountPercent
        ? `-${prod.discount_pct || prod.discountPercent}%`
        : '';
      const imgFallback = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect width='48' height='48' rx='9' fill='%23151a26'/><path d='M14 30l6-7 5 6 4-5 5 6' stroke='%232563eb' stroke-width='2' fill='none'/><circle cx='19' cy='18' r='2.5' fill='%23facc15'/></svg>";
      const imgSrc  = prod.image_url || prod.image || imgFallback;
      
      const ratingRaw = prod.stars || prod.rating;
      const ratingNum = parseFloat(ratingRaw) || 0;
      const showRating = ratingNum > 0;
      const ratingV = ratingNum.toFixed(1);

      const ratingsCount = prod.ratings_count || prod.review_count || prod.reviews_count;
      const salesV  = prod.sales_count
        ? prod.sales_count
        : (prod.sales ? prod.sales : 0);
      const freeShip = prod.free_shipping || prod.freeShipping;

      let ratingAndSalesHtml = '';
      if (showRating && ratingsCount) {
        ratingAndSalesHtml += `<span>★ ${ratingV} (${ratingsCount} avaliações)</span>`;
      } else if (showRating) {
        ratingAndSalesHtml += `<span>★ ${ratingV}</span>`;
        if (salesV) ratingAndSalesHtml += `<span>(${salesV} vend.)</span>`;
      } else if (salesV) {
        ratingAndSalesHtml += `<span>(${salesV} vend.)</span>`;
      }
      if (freeShip) {
        ratingAndSalesHtml += `<span class="badge-ship">Frete Grátis</span>`;
      }

      // Linha de parcelamento
      const installmentsText = prod.installments || '';
      const isInterestFree = prod.installments_interest_free || /sem\s*juros/i.test(installmentsText);
      const installmentsHtml = installmentsText
        ? `<div class="product-installments ${isInterestFree ? 'interest-free' : ''}">${installmentsText}</div>`
        : '';

      card.innerHTML = `
        <img class="product-thumb" src="${imgSrc}" alt="${prod.title || 'Produto'}" onerror="this.onerror=null;this.src='${imgFallback}'" />
        <div class="product-details">
          <div class="product-title">${prod.title || 'Produto sem título'}</div>
          <div class="product-prices">
            <span class="price-pix">${pixPriceStr}</span>
            ${oldPriceStr ? `<span class="price-old">${oldPriceStr}</span>` : ''}
            ${discountStr ? `<span class="price-discount">${discountStr}</span>` : ''}
          </div>
          ${installmentsHtml}
          ${ratingAndSalesHtml ? `<div class="product-sub-info">${ratingAndSalesHtml}</div>` : ''}
        </div>
        <button class="btn-delete-card" title="Excluir produto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      `;

      card.querySelector('.btn-delete-card').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteProduct(prod.id);
      });

      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if (e.target.closest && e.target.closest('.btn-delete-card')) return;
        openProductDetail(prod);
      });

      historyList.appendChild(card);
    });
  }

  function openProductDetail(prod) {
    const prev = document.getElementById('am-detail-overlay');
    if (prev) prev.remove();
    const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    const pics = (Array.isArray(prod.pictures) && prod.pictures.length ? prod.pictures : [prod.image_url || prod.image]).filter(Boolean);
    const link = prod.affiliate_link || prod.original_link || prod.link || '';
    const rowsData = [
      ['Plataforma', prod.platform],
      ['Preço (à vista/Pix)', prod.price_to || prod.pix_price],
      ['Preço antigo', prod.price_from],
      ['Parcelado', prod.installments],
      ['Desconto', (prod.discount_pct || prod.discountPercent) ? ((prod.discount_pct || prod.discountPercent) + '%') : ''],
      ['Avaliação', prod.stars || prod.rating],
      ['Nº de avaliações', prod.ratings_count || prod.review_count || prod.reviews_count],
      ['Vendas', prod.sales_count || prod.sales],
      ['Frete grátis', (prod.free_shipping || prod.freeShipping) ? 'Sim' : ''],
      ['Cupom', prod.coupon],
      ['Categoria', prod.category],
    ];
    const rows = rowsData
      .filter((r) => r[1] !== undefined && r[1] !== null && r[1] !== '')
      .map((r) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #1e2636;font-size:11px"><span style="color:#93a0b5">${esc(r[0])}</span><span style="color:#eef2f9;text-align:right;font-weight:600">${esc(r[1])}</span></div>`)
      .join('');
    const thumbs = pics.slice(0, 6).map((p) => `<img src="${esc(p)}" class="am-detail-thumb" style="width:52px;height:52px;border-radius:8px;object-fit:cover;border:1px solid #1e2636;cursor:pointer"/>`).join('');
    const overlay = document.createElement('div');
    overlay.id = 'am-detail-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px';
    overlay.innerHTML = `
      <div style="background:#0e1119;border:1px solid #1e2636;border-radius:16px;max-width:340px;width:100%;max-height:92vh;overflow-y:auto;padding:14px;box-shadow:0 20px 60px rgba(0,0,0,.6)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="font-size:12px;font-weight:800;color:#fff">Detalhes do produto</span>
          <button id="am-detail-close" style="background:#151a26;border:1px solid #1e2636;color:#93a0b5;border-radius:8px;width:26px;height:26px;cursor:pointer;font-size:14px">×</button>
        </div>
        <img id="am-detail-main" src="${esc(pics[0] || '')}" style="width:100%;height:180px;object-fit:contain;background:#0b0e15;border-radius:12px;border:1px solid #1e2636"/>
        ${thumbs ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${thumbs}</div>` : ''}
        <div style="font-size:13px;font-weight:700;color:#eef2f9;margin:10px 0 8px">${esc(prod.title || 'Produto')}</div>
        <div style="margin-bottom:10px">${rows}</div>
        <div style="display:flex;gap:8px">
          ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" style="flex:1;text-align:center;padding:9px;border-radius:10px;background:#2563eb;color:#fff;font-size:11px;font-weight:700;text-decoration:none">Abrir link</a>` : ''}
          ${link ? `<button id="am-detail-copy" style="padding:9px 12px;border-radius:10px;background:#151a26;border:1px solid #1e2636;color:#eef2f9;font-size:11px;font-weight:700;cursor:pointer">Copiar</button>` : ''}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#am-detail-close').addEventListener('click', close);
    const copyBtn = overlay.querySelector('#am-detail-copy');
    if (copyBtn) copyBtn.addEventListener('click', () => { if (navigator.clipboard) navigator.clipboard.writeText(link); copyBtn.textContent = 'Copiado!'; setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 1500); });
    overlay.querySelectorAll('.am-detail-thumb').forEach((t) => t.addEventListener('click', () => { const main = overlay.querySelector('#am-detail-main'); if (main) main.src = t.src; }));
  }

  function deleteProduct(id) {
    state.minedProducts = state.minedProducts.filter((p) => p.id !== id);
    saveState();
    updateUI();
    showToast('Produto removido do histórico!');
    notifyActiveTab('UPDATE_MINED_LIST', { minedProducts: state.minedProducts });
  }

  function readFilterInputs() {
    state.qualityFilters = {
      category:    filterCategory    ? filterCategory.value.trim()                      : (state.qualityFilters.category    || ''),
      minPrice:    filterMinPrice    ? parseFloat(filterMinPrice.value)    || 0         : (state.qualityFilters.minPrice    || 0),
      maxPrice:    filterMaxPrice && filterMaxPrice.value !== '' ? parseFloat(filterMaxPrice.value) : (state.qualityFilters.maxPrice ?? null),
      minDiscount: filterMinDiscount ? parseFloat(filterMinDiscount.value) || 0         : (state.qualityFilters.minDiscount || 0),
      minRating:   filterMinRating   ? parseFloat(filterMinRating.value)   || 0         : (state.qualityFilters.minRating   || 0),
      minSales:    filterMinSales    ? parseInt(filterMinSales.value, 10)  || 0         : (state.qualityFilters.minSales    || 0),
      noInterest:  filterNoInterest  ? !!filterNoInterest.checked                       : (state.qualityFilters.noInterest  || false),
      freeShipping:filterFreeShipping? !!filterFreeShipping.checked                     : (state.qualityFilters.freeShipping|| false)
    };
    saveState();
    notifyActiveTab('SET_FILTERS', { filters: state.qualityFilters });
  }

  // ════════════════════════════════════════════════════════
  // FIREBASE AUTH — substituição do login fake
  // ════════════════════════════════════════════════════════

  async function ensureValidToken() {
    if (!state.refreshToken) throw new Error('Sem sessão. Faça login novamente.');
    if (Date.now() < state.tokenExpiresAt - 60_000) return state.idToken;

    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${state.refreshToken}`,
      }
    );
    const data = await res.json();
    if (!res.ok) {
      state.isLoggedIn = false;
      saveState();
      updateUI();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    state.idToken        = data.id_token;
    state.refreshToken   = data.refresh_token;
    state.tokenExpiresAt = Date.now() + parseInt(data.expires_in) * 1000;
    saveState();
    return state.idToken;
  }

  // ════════════════════════════════════════════════════════
  // FIRESTORE SYNC
  // ════════════════════════════════════════════════════════

  function toFsValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string')  return { stringValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number')
      return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    if (Array.isArray(val))
      return { arrayValue: { values: val.map(toFsValue) } };
    if (typeof val === 'object') {
      const fields = {};
      for (const [k, v] of Object.entries(val)) fields[k] = toFsValue(v);
      return { mapValue: { fields } };
    }
    return { nullValue: null };
  }

  function objToFs(obj) {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) fields[k] = toFsValue(v);
    }
    return fields;
  }

  function normalizePlatform(raw, url) {
    const r = (raw || '').toLowerCase();
    const u = (url || '').toLowerCase();
    const combined = `${r} ${u}`;
    if (combined.includes('tiktok') || combined.includes('byteoversea') || combined.includes('tiktokv')) return 'tiktokshop';
    if (combined.includes('shopee') || combined.includes('shope.ee') || combined.includes('s.shopee')) return 'shopee';
    if (combined.includes('mercado') || combined.includes('meli.la') || combined.includes('mliv.re')) return 'mercadolivre';
    if (combined.includes('amazon') || combined.includes('amzn.to') || combined.includes('a.co')) return 'amazon';
    if (combined.includes('ali')) return 'aliexpress';
    if (combined.includes('shein') || combined.includes('she.in')) return 'shein';
    return 'mercadolivre';
  }

  function cleanUrl(url) {
    try {
      const u = new URL(url);
      ['tracking_id','tag','smtt','aff_id','url_from','affiliate_id',
       'utm_source','utm_medium','utm_campaign'].forEach(p => u.searchParams.delete(p));
      if (u.hash.startsWith('#D[')) u.hash = '';
      return u.toString();
    } catch { return url; }
  }

  function numToPrice(n) {
    if (!n || n <= 0) return '';
    return `R$ ${n.toFixed(2).replace('.', ',')}`;
  }

  function formatSalesNum(n) {
    if (!n || n <= 0) return null;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')}k`;
    return String(n);
  }

  function buildGlobalId(platform, url) {
    try {
      switch (platform) {
        case 'mercadolivre': { const m = url.match(/(MLB\d+)/i); if (m) return `mercadolivre_${m[1].toUpperCase()}`; break; }
        case 'amazon': { const m = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i); if (m) return `amazon_${m[1].toUpperCase()}`; break; }
        case 'shopee': { const m = url.match(/[-.]i\.(\d+)\.(\d+)/); if (m) return `shopee_${m[1]}_${m[2]}`; break; }
        case 'aliexpress': { const m = url.match(/\/item\/(\d+)/); if (m) return `aliexpress_${m[1]}`; break; }
        case 'shein': { const m = url.match(/\/p-([a-z0-9]+)/i); if (m) return `shein_${m[1].toLowerCase()}`; break; }
        case 'tiktok':
        case 'tiktokshop': {
          const m = url.match(/\/view\/product\/(\d+)/i) || url.match(/\/product\/(\d+)/i) || url.match(/\/p\/(\d+)/i) || url.match(/item_id=(\d+)/i);
          if (m) return `tiktokshop_${m[1]}`;
          break;
        }
      }
    } catch (_) {}
    let h = 0;
    for (let i = 0; i < url.length; i++) h = ((h << 5) - h + url.charCodeAt(i)) | 0;
    return `${platform}_${Math.abs(h).toString(36)}`;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  async function incrementDailyStat(uid, headers) {
    const key = todayKey();
    const ref = `${FS_BASE}/users/${uid}/dailyStats/${key}`;
    try {
      const snap = await fetch(ref, { headers });
      if (snap.ok) {
        const data    = await snap.json();
        const current = parseInt(data.fields?.count?.integerValue || '0', 10);
        await fetch(`${ref}?updateMask.fieldPaths=count`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ fields: objToFs({ count: current + 1 }) }),
        });
      } else {
        await fetch(ref, {
          method: 'PATCH', headers,
          body: JSON.stringify({ fields: objToFs({ date: key, count: 1 }) }),
        });
      }
    } catch (e) { console.warn('[AM] dailyStat fail:', e.message); }
  }

  async function addPriceHistory(globalId, priceTo, priceFrom, now, headers) {
    try {
      await fetch(`${FS_BASE}/products/${globalId}/priceHistory`, {
        method: 'POST', headers,
        body: JSON.stringify({ fields: objToFs({
          price: priceTo, price_from: priceFrom ?? null, recordedAt: now,
        }) }),
      });
    } catch (e) { console.warn('[AM] priceHistory fail:', e.message); }
  }

  async function syncProductToFirestore(product) {
    if (!state.isLoggedIn || !state.uid) return;

    const token    = await ensureValidToken();
    const url      = cleanUrl(product.original_link || product.link || '');
    const platform = normalizePlatform(product.platform || product.marketplace || '', url);
    if (!url) return;

    const globalId = buildGlobalId(platform, url);
    const now      = new Date().toISOString();
    const headers  = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    // Montar documento compatível com o app
    const doc = {
      id:           globalId,
      platform,
      platformId:   globalId.split('_').slice(1).join('_'),
      title:        product.title         || 'Sem título',
      description:  product.description   || null,
      category:     product.category      || null,
      image_url:    product.image_url || product.image || null,
      pictures:     product.pictures  || (product.image ? [product.image] : []),
      video_url:    null,
      price_to:     product.price_to   || numToPrice(product.pixPrice  || 0) || '',
      price_from:   product.price_from || (product.oldPrice > 0 ? numToPrice(product.oldPrice) : null),
      pix_price:    product.pix_price  || null,
      installments: product.installments || null,
      installments_interest_free: !!product.installments_interest_free,
      coupon:       product.coupon     || null,
      shipping:     product.freeShipping ? 'Frete grátis' : (product.shipping || null),
      free_shipping:!!(product.freeShipping || product.free_shipping),
      stars:        product.stars || (product.rating > 0 ? String(product.rating) : null),
      sales_count:  product.sales_count || formatSalesNum(product.sales),
      discount_pct: product.discount_pct || product.discountPercent || null,
      original_link:url,
      affiliate_link: product.affiliate_link || null,
      miners:       [state.uid],
      mineCount:    1,
      firstMinedAt: now,
      lastMinedAt:  now,
      lastUpdatedAt:now,
    };

    // Verificar existência
    const checkRes = await fetch(`${FS_BASE}/products/${globalId}`, { headers });

    if (checkRes.ok) {
      const existing  = await checkRes.json();
      const oldMiners = (existing.fields?.miners?.arrayValue?.values || [])
        .map(v => v.stringValue).filter(Boolean);
      const oldPrice  = existing.fields?.price_to?.stringValue || '';
      const oldCount  = parseInt(existing.fields?.mineCount?.integerValue || '0', 10);
      const hasMiner  = oldMiners.includes(state.uid);
      const newMiners = hasMiner ? oldMiners : [...oldMiners, state.uid];
      const newCount  = hasMiner ? oldCount : oldCount + 1;

      const patch = {
        lastMinedAt: now, lastUpdatedAt: now,
        price_to: doc.price_to, title: doc.title, image_url: doc.image_url,
        miners: newMiners, mineCount: newCount,
      };
      if (doc.coupon)               patch.coupon = doc.coupon;
      if (doc.installments)         patch.installments = doc.installments;
      if (doc.pix_price)            patch.pix_price = doc.pix_price;
      if (doc.description)          patch.description = doc.description;
      if (doc.category)             patch.category = doc.category;
      if (doc.price_from)           patch.price_from = doc.price_from;
      if (doc.stars)                patch.stars = doc.stars;
      if (doc.sales_count)          patch.sales_count = doc.sales_count;
      if (doc.discount_pct != null) patch.discount_pct = doc.discount_pct;
      if (doc.free_shipping)        patch.free_shipping = doc.free_shipping;
      if (doc.affiliate_link)       patch.affiliate_link = doc.affiliate_link;

      const mask = Object.keys(patch).map(f => `updateMask.fieldPaths=${f}`).join('&');
      await fetch(`${FS_BASE}/products/${globalId}?${mask}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ fields: objToFs(patch) }),
      });

      if (doc.price_to && doc.price_to !== oldPrice) {
        await addPriceHistory(globalId, doc.price_to, doc.price_from, now, headers);
      }
    } else {
      await fetch(`${FS_BASE}/products/${globalId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ fields: objToFs(doc) }),
      });
      await addPriceHistory(globalId, doc.price_to, doc.price_from, now, headers);
    }

    // Ref no perfil do usuário
    const minedRef   = `${FS_BASE}/users/${state.uid}/minedProducts/${globalId}`;
    const minedCheck = await fetch(minedRef, { headers });

    if (!minedCheck.ok) {
      await fetch(minedRef, {
        method: 'PATCH', headers,
        body: JSON.stringify({ fields: objToFs({
          productId: globalId, platform, minedAt: now, favorite: false, status: 'active',
        }) }),
      });
      await incrementDailyStat(state.uid, headers);
    } else {
      await fetch(`${minedRef}?updateMask.fieldPaths=minedAt`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ fields: objToFs({ minedAt: now }) }),
      });
    }
  }

  // ════════════════════════════════════════════════════════
  // AUTH TAB SWITCHER — idêntico ao original + "Criar Conta" abre app
  // ════════════════════════════════════════════════════════
  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      isRegisterMode = false;
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      if (btnLoginText) btnLoginText.textContent = 'Entrar no Afiliate';
      if (registerNote) registerNote.style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
      isRegisterMode = true;
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      if (btnLoginText) btnLoginText.textContent = 'Abrir Afiliate para criar conta';
      if (registerNote) registerNote.style.display = 'block';
      if (noAccountBox) noAccountBox.style.display = 'none';
    });
  }

  // ── Mostrar/ocultar senha ────────────────────────────────
  if (btnTogglePassword && loginPasswordInput) {
    btnTogglePassword.addEventListener('click', () => {
      const showing = loginPasswordInput.type === 'text';
      loginPasswordInput.type = showing ? 'password' : 'text';
      if (iconEye)    iconEye.style.display    = showing ? 'block' : 'none';
      if (iconEyeOff) iconEyeOff.style.display = showing ? 'none'  : 'block';
      btnTogglePassword.title = showing ? 'Mostrar senha' : 'Ocultar senha';
      btnTogglePassword.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
      loginPasswordInput.focus();
    });
  }

  // ── Abrir o site do Afiliate para criar conta ────────────
  function openAfiliateSignup() {
    const signupUrl = `${APP_URL}/?signup=1`;
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: signupUrl });
    } else {
      window.open(signupUrl, '_blank');
    }
    showToast('Crie sua conta no site e volte aqui para entrar 👍');
  }

  if (btnCreateAccount) {
    btnCreateAccount.addEventListener('click', openAfiliateSignup);
  }

  // ════════════════════════════════════════════════════════
  // LOGIN — agora usa Firebase Auth real
  // ════════════════════════════════════════════════════════
  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      // Modo cadastro → abrir app no navegador
      if (isRegisterMode) {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.create({ url: APP_URL });
        } else {
          window.open(APP_URL, '_blank');
        }
        return;
      }

      const email = loginEmailInput ? loginEmailInput.value.trim()  : '';
      const pass  = loginPasswordInput ? loginPasswordInput.value.trim() : '';

      if (!email || !email.includes('@')) { showToast('Por favor, informe um e-mail válido!'); return; }
      if (!pass || pass.length < 4)       { showToast('Informe uma senha válida!'); return; }

      if (noAccountBox) noAccountBox.style.display = 'none';
      if (btnLogin) btnLogin.disabled = true;
      if (btnLoginText) btnLoginText.textContent = 'Entrando...';

      try {
        // Chamada real ao Firebase Auth REST API
        const authRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass, returnSecureToken: true }),
          }
        );
        const authData = await authRes.json();

        if (!authRes.ok) {
          const errMsg = authData.error?.message || 'Erro ao entrar';
          // Conta inexistente / credenciais inválidas → oferecer criação de conta.
          // (Com proteção de enumeração de e-mail, o Firebase devolve
          //  INVALID_LOGIN_CREDENTIALS tanto para senha errada quanto p/ conta inexistente.)
          if (errMsg.includes('EMAIL_NOT_FOUND') || errMsg.includes('USER_NOT_FOUND') ||
              errMsg.includes('INVALID_LOGIN_CREDENTIALS')) {
            if (noAccountBox) noAccountBox.style.display = 'flex';
          }
          throw new Error(
            errMsg.includes('INVALID_PASSWORD')
              ? 'Senha incorreta. Se ainda não tem conta, crie no Afiliate.'
              : errMsg.includes('EMAIL_NOT_FOUND') || errMsg.includes('USER_NOT_FOUND')
                ? 'Conta não encontrada. Crie sua conta no Afiliate abaixo.'
              : errMsg.includes('INVALID_LOGIN_CREDENTIALS')
                ? 'E-mail ou senha incorretos. Não tem conta? Crie no Afiliate abaixo.'
              : errMsg.includes('TOO_MANY_ATTEMPTS') ? 'Muitas tentativas. Aguarde alguns minutos.'
              : errMsg.includes('INVALID_EMAIL') ? 'Formato de e-mail inválido.'
              : errMsg
          );
        }

        // Salvar dados reais de autenticação
        state.isLoggedIn      = true;
        state.userEmail       = authData.email;
        state.uid             = authData.localId;
        state.idToken         = authData.idToken;
        state.refreshToken    = authData.refreshToken;
        state.tokenExpiresAt  = Date.now() + parseInt(authData.expiresIn) * 1000;

        saveState();
        updateUI();
        showToast(`✅ Conectado como ${authData.email}`);

      } catch (e) {
        showToast(e.message || 'Erro ao fazer login. Tente novamente.');
      } finally {
        if (btnLogin) btnLogin.disabled = false;
        if (btnLoginText) btnLoginText.textContent = 'Entrar no Afiliate';
      }
    });
  }

  // ── Logout — limpa tokens (idêntico + limpa auth data) ──
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      state.isLoggedIn     = false;
      state.userEmail      = '';
      state.uid            = '';
      state.idToken        = '';
      state.refreshToken   = '';
      state.tokenExpiresAt = 0;
      if (loginEmailInput)    loginEmailInput.value    = '';
      if (loginPasswordInput) loginPasswordInput.value = '';
      saveState();
      updateUI();
      showToast('Desconectado do Afiliate');
    });
  }

  // ── Toggles (idênticos ao original) ─────────────────────
  if (toggleExtActive) {
    toggleExtActive.addEventListener('change', () => {
      state.extActive = toggleExtActive.checked;
      saveState();
      updateUI();
      notifyActiveTab('SET_EXT_ACTIVE', { active: state.extActive });
      showToast(state.extActive ? 'Extensão Ativada' : 'Extensão Desativada');
    });
  }

  if (toggleAutoMine) {
    toggleAutoMine.addEventListener('change', () => {
      state.autoMine = toggleAutoMine.checked;
      saveState();
      updateUI();
      notifyActiveTab('SET_AUTO_MINE', { autoMine: state.autoMine });
      showToast(state.autoMine ? 'Mineração Automática Iniciada' : 'Mineração Automática Pausada');
    });
  }

  // ── Filter listeners (idênticos ao original) ─────────────
  [filterCategory, filterMinPrice, filterMaxPrice, filterMinDiscount, filterMinRating, filterMinSales].forEach((el) => {
    if (el) el.addEventListener('input', readFilterInputs);
  });
  [filterNoInterest, filterFreeShipping].forEach((el) => {
    if (el) el.addEventListener('change', readFilterInputs);
  });

  // ── Clear history (idêntico ao original) ─────────────────
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      if (!state.minedProducts.length) return;
      state.minedProducts  = [];
      state.discardedCount = 0;
      saveState();
      updateUI();
      showToast('Histórico limpo com sucesso!');
      notifyActiveTab('UPDATE_MINED_LIST', { minedProducts: [] });
    });
  }

  // ════════════════════════════════════════════════════════
  // ENVIAR TODOS — agora sincroniza com Firestore real
  // ════════════════════════════════════════════════════════
  if (btnSendAll) {
    btnSendAll.addEventListener('click', async () => {
      if (!state.minedProducts || state.minedProducts.length === 0) {
        showToast('Nenhum produto no histórico para enviar!');
        return;
      }
      if (!state.isLoggedIn || !state.uid) {
        showToast('Faça login primeiro para enviar ao Afiliate!');
        return;
      }

      if (btnSendAll) btnSendAll.disabled = true;
      if (btnSendText) btnSendText.textContent = 'Sincronizando...';

      let synced = 0;
      let failed = 0;

      for (const product of state.minedProducts) {
        try {
          await syncProductToFirestore(product);
          synced++;
        } catch (_) {
          failed++;
        }
      }

      if (btnSendAll) btnSendAll.disabled = false;
      if (btnSendText) btnSendText.textContent = `Enviar Todos (${state.minedProducts.length}) para o Afiliate`;

      if (failed === 0) {
        showToast(`✅ ${synced} produto${synced !== 1 ? 's' : ''} sincronizado${synced !== 1 ? 's' : ''} com o Afiliate!`);
      } else {
        showToast(`✅ ${synced} enviado${synced !== 1 ? 's' : ''} | ⚠️ ${failed} falha${failed !== 1 ? 's' : ''}`);
      }
    });
  }

  // ── Diagnostic modal (idêntico ao original) ──────────────
  if (btnShowDiagModal) {
    btnShowDiagModal.addEventListener('click', () => {
      generateDiagnosticReport();
      if (modalErrorReport) modalErrorReport.style.display = 'flex';
    });
  }

  if (btnCloseErrorModal) {
    btnCloseErrorModal.addEventListener('click', () => {
      if (modalErrorReport) modalErrorReport.style.display = 'none';
    });
  }

  if (btnCopyErrorReport) {
    btnCopyErrorReport.addEventListener('click', () => {
      if (errorReportText) {
        errorReportText.select();
        document.execCommand('copy');
        showToast('📋 Relatório de erro copiado para a área de transferência!');
      }
    });
  }

  function generateDiagnosticReport() {
    const err = state.lastError || { message: 'Nenhum erro crítico registrado recentemente.', stack: 'Operação limpa.' };
    const amVer = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : '1.3.5';
    const report = `### ⚠️ Relatório de Diagnóstico de Erro - Affiliate Miner v${amVer}
**Data/Hora**: ${new Date().toLocaleString('pt-BR')}
**Usuário**: ${state.userEmail || 'Desconectado'} (UID: ${state.uid || 'sem UID'})
**Autenticado**: ${state.isLoggedIn ? 'Sim' : 'Não'}
**Extensão Ativa**: ${state.extActive}
**Auto-Mine**: ${state.autoMine}
**Filtros**: Min: R$${state.qualityFilters.minPrice} | Desc: ${state.qualityFilters.minDiscount}% | Eval: ${state.qualityFilters.minRating}★ | Vendas: ${state.qualityFilters.minSales}

**Erro Detectado**:
\`\`\`text
${err.message || err}
${err.stack || ''}
\`\`\`
*Cole esta mensagem diretamente no chat com o assistente AI para rápida resolução!*`;

    if (errorReportText) errorReportText.value = report;
  }

  loadState();
});
