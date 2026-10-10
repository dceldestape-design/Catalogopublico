/**
 * Catálogo cliente por vendedor: sin precios, con consulta por WhatsApp.
 * Lee ?v=CODIGO&gs=URL_EXEC del GS público del vendedor.
 */
const state = { catalog: null, cart: {}, gsUrl: "", vendor: "" };

document.addEventListener('DOMContentLoaded', async () => {
  const q = new URLSearchParams(window.location.search);
  state.vendor = (q.get('v') || window.CC_VENDOR || "").trim().toUpperCase();
  state.gsUrl = (q.get('gs') || window.CC_GSURL || "").trim();
  // Enlaces viejos sin gs: reutilizar el último GS usado por este vendedor
  if (!state.gsUrl && state.vendor) {
    try { state.gsUrl = localStorage.getItem('cc_gs_' + state.vendor) || ""; } catch (e) {}
  }
  try {
    const raw = localStorage.getItem('cc_cart_' + state.vendor);
    if (raw) state.cart = JSON.parse(raw) || {};
  } catch (e) {}
  await loadCatalog();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { toggleCart(false); closeOffer(); }
  });
});

async function loadCatalog() {
  const empty = document.getElementById('cc-empty');
  const msg = document.getElementById('cc-empty-msg');
  if (!state.gsUrl) {
    if (msg) msg.textContent = "Enlace incompleto: falta la dirección del catálogo.";
    if (empty) empty.classList.remove('hidden');
    return;
  }
  try {
    const res = await fetch(`${state.gsUrl}?action=get_public&v=${encodeURIComponent(state.vendor)}`);
    const json = await res.json();
    if (json.status !== "success" || !json.public) throw new Error((json && json.message) || "Sin respuesta");
    state.catalog = json.public;
    try { if (state.vendor) localStorage.setItem('cc_gs_' + state.vendor, state.gsUrl); } catch (e) {}
    document.getElementById('cc-loading')?.classList.add('hidden');
    applyBrand();
    renderGrid();
    updateCartBadge();
    maybeOffer();
  } catch (e) {
    console.warn("catalogo-cliente:", e);
    document.getElementById('cc-loading')?.classList.add('hidden');
    if (msg) msg.textContent = "No se pudo cargar. Revisa tu conexión e intenta de nuevo.";
    if (empty) empty.classList.remove('hidden');
  }
}

function applyBrand() {
  const c = state.catalog || {};
  const company = c.company || {};
  const seller = c.seller || {};
  document.title = `${company.name || 'Catálogo'}${seller.name ? ' • ' + seller.name : ''}`;
  const co = document.getElementById('cc-company');
  if (co) co.textContent = company.name || 'Catálogo';
  const se = document.getElementById('cc-seller');
  if (se) se.textContent = [seller.name, seller.code ? 'Cód. ' + seller.code : ''].filter(Boolean).join(' • ');
  const logo = document.getElementById('cc-logo');
  if (logo) {
    if (company.logo) {
      logo.src = company.logo;
      logo.classList.remove('hidden');
    } else {
      logo.classList.add('hidden');
    }
  }
  const hl = document.getElementById('cc-headline');
  if (hl) hl.textContent = seller.headline || '';
  const send = document.getElementById('cc-send-label');
  if (send && seller.name) send.textContent = `Enviar a ${seller.name} por WhatsApp`;
}

function renderGrid() {
  const grid = document.getElementById('cc-grid');
  const empty = document.getElementById('cc-empty');
  if (!grid || !state.catalog) return;
  const q = (document.getElementById('cc-search')?.value || '').toLowerCase().trim();
  const items = (state.catalog.products || []).filter(p => {
    if (!q) return true;
    return String(p.name || '').toLowerCase().includes(q) || String(p.code || '').toLowerCase().includes(q);
  });
  if (!items.length) {
    grid.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  grid.innerHTML = items.map(p => {
    const qty = state.cart[p.code] || 0;
    const sub = [p.supplierName || p.supplier, p.categoryName || p.category].filter(Boolean).join(' • ');
    return `
    <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
      <div class="w-full aspect-square bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden">
        ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy" class="w-full h-full object-contain p-2">` : `<i class="fa-solid fa-box text-3xl text-slate-300"></i>`}
      </div>
      <div class="p-3 flex-1 flex flex-col">
        <span class="text-[10px] font-bold text-blue-700">#${p.code}</span>
        <h4 class="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">${p.name}</h4>
        ${sub ? `<div class="text-[10px] text-slate-400 truncate mt-0.5">${sub}</div>` : ''}
        <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
          ${qty > 0 ? `
          <div class="flex items-center gap-2">
            <button onclick="changeQty('${p.code}', -1)" class="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 font-bold">−</button>
            <span class="text-sm font-extrabold w-5 text-center">${qty}</span>
            <button onclick="changeQty('${p.code}', 1)" class="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 font-bold">+</button>
          </div>` : `
          <button onclick="changeQty('${p.code}', 1)" class="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold">Agregar</button>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

function changeQty(code, delta) {
  const q = Math.max(0, (state.cart[code] || 0) + delta);
  if (q === 0) delete state.cart[code];
  else state.cart[code] = q;
  try { localStorage.setItem('cc_cart_' + state.vendor, JSON.stringify(state.cart)); } catch (e) {}
  updateCartBadge();
  renderGrid();
}

function updateCartBadge() {
  const n = Object.values(state.cart).reduce((a, b) => a + b, 0);
  const el = document.getElementById('cart-count');
  if (el) el.textContent = String(n);
}

function toggleCart(open) {
  const m = document.getElementById('cc-cart');
  if (!m) return;
  if (open) renderCart();
  m.classList.toggle('hidden', !open);
}

function renderCart() {
  const box = document.getElementById('cc-cart-items');
  if (!box) return;
  const prods = state.catalog ? (state.catalog.products || []) : [];
  const entries = Object.keys(state.cart).map(code => ({
    p: prods.find(x => String(x.code) === String(code)),
    qty: state.cart[code]
  })).filter(x => x.p && x.qty > 0);
  if (!entries.length) {
    box.innerHTML = `<p class="text-xs text-slate-400 text-center p-6">Tu consulta está vacía. Agrega productos del catálogo.</p>`;
    return;
  }
  box.innerHTML = entries.map(({ p, qty }) => `
    <div class="p-3 flex items-center gap-3">
      <div class="w-12 h-12 rounded-lg bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
        ${p.image ? `<img src="${p.image}" class="w-full h-full object-contain">` : `<i class="fa-solid fa-box text-slate-300"></i>`}
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold text-slate-900 truncate">${p.name}</div>
        <div class="text-[10px] text-slate-400">#${p.code}</div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button onclick="changeQty('${p.code}', -1);renderCart()" class="w-8 h-8 rounded-lg bg-slate-100 font-bold">−</button>
        <span class="text-xs font-extrabold w-4 text-center">${qty}</span>
        <button onclick="changeQty('${p.code}', 1);renderCart()" class="w-8 h-8 rounded-lg bg-slate-100 font-bold">+</button>
      </div>
    </div>`).join('');
}

function sendOrder() {
  const seller = (state.catalog && state.catalog.seller) || {};
  const wa = String(seller.whatsapp || "").replace(/\D/g, "");
  if (!wa) {
    alert("Este catálogo aún no tiene WhatsApp configurado.");
    return;
  }
  const prods = state.catalog.products || [];
  const lines = Object.keys(state.cart).map(code => {
    const p = prods.find(x => String(x.code) === String(code));
    return p ? `• ${state.cart[code]} x ${p.name} (#${p.code})` : null;
  }).filter(Boolean);
  if (!lines.length) {
    alert("Agrega productos antes de enviar.");
    return;
  }
  const msg = `Hola ${seller.name || ''}, quiero consultar estos productos:%0A${encodeURIComponent(lines.join('\n'))}`;
  window.open(`https://wa.me/${wa}?text=${msg}`, "_blank");
}

function maybeOffer() {
  const offer = state.catalog && state.catalog.offer;
  if (!offer || !offer.enabled || !offer.image) return;
  const key = `cc_offer_${state.vendor}_${offer.image}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch (e) {}
  const img = document.getElementById('cc-offer-image');
  if (img) img.src = offer.image;
  const t = document.getElementById('cc-offer-title');
  if (t) t.textContent = offer.title || 'Oferta especial';
  const cta = document.getElementById('cc-offer-cta');
  if (cta) cta.textContent = offer.cta || 'Ver productos';
  document.getElementById('cc-offer')?.classList.remove('hidden');
}

function closeOffer() {
  document.getElementById('cc-offer')?.classList.add('hidden');
}
