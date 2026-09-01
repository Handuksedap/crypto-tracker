document.getElementById('year').textContent = new Date().getFullYear();

const MEME_KEYWORDS = ['pepe', 'doge', 'shib', 'floki', 'meme', 'bonk', 'wif', 'popcat', 'memecoin', 'turbo', 'wojak', 'mog', 'gigachad', 'brett', 'toshi', 'neiro', 'mew', 'myro', 'slerf', 'ponke', 'pnut', 'goat', 'fwog', 'degen', 'based', 'cat', 'inu', 'elon'];
const REFRESH_INTERVAL = 30;

const state = {
  coins: [],
  prevCoins: {},
  filtered: [],
  analysis: {},
  loading: false,
  search: '',
  category: 'all',
  sort: 'market_cap_desc',
  currency: localStorage.getItem('currency') || 'usd',
  rate: 15800,
  nextRefreshIn: REFRESH_INTERVAL,
  lastFetch: 0,
};

const $ = (id) => document.getElementById(id);

const fmt = {
  usd(n) {
    if (n == null) return 'ΓÇö';
    if (n >= 1) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (n >= 0.01) return '$' + n.toFixed(4);
    return '$' + n.toPrecision(3);
  },
  idr(n) {
    if (n == null) return 'ΓÇö';
    const v = n * state.rate;
    if (v >= 1e9) return 'Rp ' + (v / 1e9).toFixed(2) + 'T';
    if (v >= 1e6) return 'Rp ' + (v / 1e6).toFixed(2) + 'jt';
    if (v >= 1e3) return 'Rp ' + (v / 1e3).toFixed(1) + 'rb';
    return 'Rp ' + v.toFixed(0);
  },
  price(n) { return state.currency === 'idr' ? fmt.idr(n) : fmt.usd(n); },
  big(n) {
    if (n == null) return 'ΓÇö';
    const v = state.currency === 'idr' ? n * state.rate : n;
    const prefix = state.currency === 'idr' ? 'Rp ' : '$';
    if (v >= 1e12) return prefix + (v / 1e12).toFixed(2) + 'T';
    if (v >= 1e9) return prefix + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return prefix + (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return prefix + (v / 1e3).toFixed(2) + 'K';
    return prefix + v.toFixed(2);
  },
  pct(n) {
    if (n == null) return 'ΓÇö';
    const sign = n > 0 ? '+' : '';
    return sign + n.toFixed(2) + '%';
  },
  changeClass(n) {
    if (n == null || n === 0) return 'flat';
    return n > 0 ? 'up' : 'down';
  },
};

function setStatus(text, mode = '') {
  $('status-text').textContent = text;
  const dot = $('status-dot');
  dot.className = 'dot' + (mode ? ' ' + mode : '');
}

function sparklinePath(sparks, w = 100, h = 32) {
  if (!sparks || sparks.length < 2) return '';
  const min = Math.min(...sparks);
  const max = Math.max(...sparks);
  const range = max - min || 1;
  const step = w / (sparks.length - 1);
  return sparks.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * h;
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
}

function renderSparkline(sparks, up) {
  if (!sparks || sparks.length < 2) return '<span class="change flat">ΓÇö</span>';
  const path = sparklinePath(sparks);
  const color = up ? 'var(--green)' : 'var(--red)';
  return `<svg class="sparkline" viewBox="0 0 100 32" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
}

function isMeme(coin) {
  const s = ((coin.id || '') + ' ' + (coin.symbol || '') + ' ' + (coin.name || '')).toLowerCase();
  return MEME_KEYWORDS.some((k) => s.includes(k));
}

function renderSignal(c) {
  const a = state.analysis[c.id];
  if (!a) return '<span class="signal hold">ΓÇª</span>';
  const reasons = a.reasons.join(' ΓÇó ');
  return `<span class="signal ${a.signal}" title="Score: ${a.score} ΓÇó RSI: ${a.rsi} ΓÇó Trend: ${a.trend}\n${reasons}">${a.signalLabel}</span>`;
}

function buildRow(c) {
  const ch1 = c.price_change_percentage_1h_in_currency;
  const ch24 = c.price_change_percentage_24h;
  const ch7 = c.price_change_percentage_7d_in_currency;
  const up = (ch7 || 0) >= 0;
  return `
    <div class="coin-row" data-id="${c.id}">
      <div class="cell-rank">${c.market_cap_rank || 'ΓÇö'}</div>
      <div class="coin-info">
        <img src="${c.image}" alt="" loading="lazy" />
        <div class="coin-names">
          <div class="coin-name">${c.name}${isMeme(c) ? ' ≡ƒÉ╕' : ''}</div>
          <div class="coin-symbol">${c.symbol}</div>
        </div>
      </div>
      <div class="num-col cell-price" data-pid="${c.id}">${fmt.price(c.current_price)}</div>
      <div class="num-col change ${fmt.changeClass(ch1)} cell-1h desktop-only" data-pid="${c.id}">${fmt.pct(ch1)}</div>
      <div class="num-col change ${fmt.changeClass(ch24)} cell-24h change-24h" data-pid="${c.id}">${fmt.pct(ch24)}</div>
      <div class="num-col change ${fmt.changeClass(ch7)} cell-7d desktop-only" data-pid="${c.id}">${fmt.pct(ch7)}</div>
      <div class="num-col cell-mc market-cap-mobile">${fmt.big(c.market_cap)}</div>
      <div class="num-col cell-vol desktop-only">${fmt.big(c.total_volume)}</div>
      <div class="signal-cell">${renderSignal(c)}</div>
      <div class="cell-spark desktop-only">${renderSparkline(c.sparkline_in_7d?.price, up)}</div>
    </div>
  `;
}

function applyFilter() {
  let result = [...state.coins];

  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter((c) => (c.id + ' ' + c.symbol + ' ' + c.name).toLowerCase().includes(q));
  }

  switch (state.category) {
    case 'meme':
      result = result.filter(isMeme);
      break;
    case 'top10':
      result = result.slice().sort((a, b) => (a.market_cap_rank || 999) - (b.market_cap_rank || 999)).slice(0, 10);
      break;
    case 'gainers':
      result = result.filter((c) => c.price_change_percentage_24h > 0)
        .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
        .slice(0, 50);
      break;
    case 'losers':
      result = result.filter((c) => c.price_change_percentage_24h < 0)
        .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
        .slice(0, 50);
      break;
    case 'strong-buy':
      result = result.filter((c) => state.analysis[c.id]?.signal === 'strong-buy' || state.analysis[c.id]?.signal === 'buy');
      break;
  }

  switch (state.sort) {
    case 'market_cap_desc':
      result.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
      break;
    case 'volume_desc':
      result.sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0));
      break;
    case 'price_change_24h_desc':
      result.sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
      break;
    case 'price_change_7d_desc':
      result.sort((a, b) => (b.price_change_percentage_7d_in_currency || 0) - (a.price_change_percentage_7d_in_currency || 0));
      break;
    case 'name_asc':
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  state.filtered = result;
  renderInitial();
}

function renderInitial() {
  const list = $('coins-list');
  if (state.loading && state.coins.length === 0) {
    list.innerHTML = '<div class="loading">Memuat data pasarΓÇª</div>';
    return;
  }
  if (state.filtered.length === 0) {
    list.innerHTML = '<div class="empty">Tidak ada koin ditemukan</div>';
    return;
  }
  list.innerHTML = state.filtered.map(buildRow).join('');
}

function patchValues() {
  if (state.filtered.length === 0) return;
  const list = $('coins-list');
  const rows = list.children;
  if (rows.length !== state.filtered.length) {
    renderInitial();
    return;
  }

  for (let i = 0; i < state.filtered.length; i++) {
    const c = state.filtered[i];
    const row = rows[i];
    if (!row || row.dataset.id !== c.id) {
      renderInitial();
      return;
    }

    const prev = state.prevCoins[c.id];
    const priceCell = row.querySelector('.cell-price');
    const c1 = row.querySelector('.cell-1h');
    const c24 = row.querySelector('.cell-24h');
    const c7 = row.querySelector('.cell-7d');
    const mc = row.querySelector('.cell-mc');
    const vol = row.querySelector('.cell-vol');

    const newPrice = fmt.price(c.current_price);
    if (priceCell.textContent !== newPrice) {
      priceCell.textContent = newPrice;
      if (prev) {
        const flash = c.current_price > prev.current_price ? 'flash-up' : c.current_price < prev.current_price ? 'flash-down' : '';
        if (flash) {
          priceCell.classList.remove('flash-up', 'flash-down');
          void priceCell.offsetWidth;
          priceCell.classList.add(flash);
        }
      }
    }

    const ch1 = c.price_change_percentage_1h_in_currency;
    const ch24 = c.price_change_percentage_24h;
    const ch7 = c.price_change_percentage_7d_in_currency;

    const new1 = fmt.pct(ch1);
    if (c1.textContent !== new1) {
      c1.textContent = new1;
      c1.className = `num-col change ${fmt.changeClass(ch1)} cell-1h desktop-only`;
      if (prev) {
        const p1 = prev.price_change_percentage_1h_in_currency || 0;
        if (ch1 > p1) flash(c1, 'up'); else if (ch1 < p1) flash(c1, 'down');
      }
    }

    const new24 = fmt.pct(ch24);
    if (c24.textContent !== new24) {
      c24.textContent = new24;
      c24.className = `num-col change ${fmt.changeClass(ch24)} cell-24h change-24h`;
      if (prev) {
        if (ch24 > (prev.price_change_percentage_24h || 0)) flash(c24, 'up');
        else if (ch24 < (prev.price_change_percentage_24h || 0)) flash(c24, 'down');
      }
    }

    const new7 = fmt.pct(ch7);
    if (c7.textContent !== new7) {
      c7.textContent = new7;
      c7.className = `num-col change ${fmt.changeClass(ch7)} cell-7d desktop-only`;
    }

    mc.textContent = fmt.big(c.market_cap);
    vol.textContent = fmt.big(c.total_volume);
  }
}

function flash(el, dir) {
  el.classList.remove('flash-up', 'flash-down');
  void el.offsetWidth;
  el.classList.add(dir === 'up' ? 'flash-up' : 'flash-down');
}

async function fetchCoins(silent = false) {
  if (state.loading) return;
  if (!silent) setStatus('fetchingΓÇª');
  state.loading = true;
  try {
    const r = await fetch(API_BASE + '/api/coins?limit=200');
    const cacheSource = r.headers.get('X-Cache') || 'unknown';
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || ('HTTP ' + r.status));
    }
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('Invalid response');

    state.prevCoins = {};
    state.coins.forEach((c) => { state.prevCoins[c.id] = c; });

    state.coins = data;
    state.loading = false;
    state.lastFetch = Date.now();
    state.nextRefreshIn = REFRESH_INTERVAL;
    const cacheLabel = cacheSource === 'fresh' ? 'live' : cacheSource === 'stale' ? 'cached' : cacheSource.includes('stale') ? 'cached' : 'live';
    setStatus(cacheLabel, 'live');

    await fetchAnalysis();
    if (state.filtered.length === 0) applyFilter();
    else patchValues();
  } catch (e) {
    state.loading = false;
    if (state.coins.length > 0) {
      setStatus('offline (cached)', 'error');
    } else {
      setStatus('error: ' + e.message, 'error');
      $('coins-list').innerHTML = `<div class="error-msg">Gagal memuat data pasar.<br><small>${e.message}</small><br><br><button class="btn-secondary" onclick="location.reload()">Refresh halaman</button></div>`;
    }
  }
}

async function fetchAnalysis() {
  try {
    const r = await fetch(API_BASE + '/api/analyze');
    if (!r.ok) return;
    const data = await r.json();
    state.analysis = {};
    data.forEach((a) => { state.analysis[a.id] = a; });
    document.querySelectorAll('.signal-cell').forEach((cell) => {
      const row = cell.closest('.coin-row');
      if (row) cell.innerHTML = renderSignal({ id: row.dataset.id });
    });
  } catch (e) { /* silent */ }
}

async function fetchGlobal() {
  try {
    const r = await fetch(API_BASE + '/api/global');
    if (!r.ok) return;
    const json = await r.json();
    const d = json.data;
    if (!d) return;
    const v = state.currency === 'idr' ? state.rate : 1;
    const prefix = state.currency === 'idr' ? 'Rp ' : '$';
    const fmtBig = (n) => {
      if (!n) return 'ΓÇö';
      const x = n * v;
      if (x >= 1e12) return prefix + (x / 1e12).toFixed(2) + 'T';
      if (x >= 1e9) return prefix + (x / 1e9).toFixed(2) + 'B';
      return prefix + (x / 1e6).toFixed(0) + 'M';
    };
    $('g-mc').textContent = fmtBig(d.total_market_cap?.usd);
    $('g-vol').textContent = fmtBig(d.total_volume?.usd);
    $('g-btc').textContent = d.market_cap_percentage?.btc?.toFixed(1) + '%';
  } catch (e) { /* silent */ }
}

async function fetchRate() {
  try {
    const r = await fetch(API_BASE + '/api/rate');
    const d = await r.json();
    state.rate = d.usd_to_idr;
  } catch (e) { /* silent */ }
}

async function openModal(id) {
  const modal = $('modal');
  const body = $('modal-body');
  modal.hidden = false;
  body.innerHTML = '<div class="loading">Memuat detailΓÇª</div>';
  try {
    const [coinR, anaR] = await Promise.all([
      fetch(API_BASE + '/api/coin/' + id),
      fetch(API_BASE + '/api/analyze/' + id).catch(() => null),
    ]);
    const d = await coinR.json();
    const a = anaR ? await anaR.json() : null;
    const desc = (d.description?.en || '').replace(/<[^>]+>/g, '').slice(0, 400);
    const md = d.market_data || {};
    body.innerHTML = `
      <div class="modal-header">
        <img src="${d.image?.large}" alt="" />
        <div>
          <h2>${d.name} ${isMeme({ id, symbol: d.symbol, name: d.name }) ? '≡ƒÉ╕' : ''}</h2>
          <div class="sym">${d.symbol} ΓÇó Rank #${d.market_cap_rank || 'ΓÇö'}</div>
        </div>
      </div>
      ${a ? `<div class="analysis-panel" style="background:linear-gradient(135deg,#f0f9ff,#f0fdf4);padding:1.2rem;border-radius:10px;margin-bottom:1.2rem;border:1px solid #e0e7ff">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem">
          <strong>≡ƒôè Analisa Otomatis</strong>
          <span class="signal ${a.signal}">${a.signalLabel}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;font-size:0.85rem;margin-bottom:0.6rem">
          <div><span style="color:var(--muted)">RSI:</span> <strong>${a.rsi}</strong></div>
          <div><span style="color:var(--muted)">Trend 7d:</span> <strong>${a.trend === 'up' ? 'Γåù Naik' : a.trend === 'down' ? 'Γåÿ Turun' : 'ΓåÆ Datar'}</strong></div>
          <div><span style="color:var(--muted)">Volume:</span> <strong>${a.volSignal === 'high' ? 'Tinggi' : a.volSignal === 'low' ? 'Sepi' : 'Normal'}</strong></div>
        </div>
        <div style="font-size:0.8rem;color:var(--muted);line-height:1.5">
          ${a.reasons.map(r => 'ΓÇó ' + r).join('<br>')}
        </div>
        <div style="margin-top:0.6rem;font-size:0.7rem;color:var(--muted);font-style:italic">ΓÜá∩╕Å Bukan saran finansial. Edukasi saja.</div>
      </div>` : ''}
      <div class="modal-grid">
        <div class="modal-item"><div class="lbl">Harga (USD)</div><div class="val">${fmt.usd(md.current_price?.usd)}</div></div>
        <div class="modal-item"><div class="lbl">Harga (IDR)</div><div class="val" style="color:var(--accent)">${fmt.idr(md.current_price?.usd)}</div></div>
        <div class="modal-item"><div class="lbl">ATH</div><div class="val">${fmt.price(md.ath?.usd)}</div></div>
        <div class="modal-item"><div class="lbl">Market Cap</div><div class="val">${fmt.big(md.market_cap?.usd)}</div></div>
        <div class="modal-item"><div class="lbl">24h Vol</div><div class="val">${fmt.big(md.total_volume?.usd)}</div></div>
        <div class="modal-item"><div class="lbl">24h</div><div class="val change ${fmt.changeClass(md.price_change_percentage_24h)}">${fmt.pct(md.price_change_percentage_24h)}</div></div>
        <div class="modal-item"><div class="lbl">7d</div><div class="val change ${fmt.changeClass(md.price_change_percentage_7d)}">${fmt.pct(md.price_change_percentage_7d)}</div></div>
        <div class="modal-item"><div class="lbl">Circulating Supply</div><div class="val">${md.circulating_supply?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || 'ΓÇö'}</div></div>
        <div class="modal-item"><div class="lbl">ATH Date</div><div class="val">${md.ath?.usd ? new Date(md.ath_date?.usd).toLocaleDateString('id-ID') : 'ΓÇö'}</div></div>
      </div>
      ${desc ? `<div class="modal-desc">${desc}${desc.length === 400 ? 'ΓÇª' : ''}</div>` : ''}
      ${d.links?.homepage?.[0] ? `<div class="modal-desc"><a href="${d.links.homepage[0]}" target="_blank" rel="noopener">${d.links.homepage[0]} ΓåÆ</a></div>` : ''}
    `;
  } catch (e) {
    body.innerHTML = '<div class="error-msg">Gagal memuat detail: ' + e.message + '</div>';
  }
}

function closeModal() { $('modal').hidden = true; }

function setCurrency(cur) {
  state.currency = cur;
  localStorage.setItem('currency', cur);
  document.querySelectorAll('#currency-toggle button').forEach((b) => {
    b.classList.toggle('active', b.dataset.cur === cur);
  });
  applyFilter();
  fetchGlobal();
}

let lastSecond = -1;
function tick() {
  const now = new Date();
  const sec = now.getSeconds();
  if (sec !== lastSecond) {
    lastSecond = sec;
    $('live-clock').textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (state.lastFetch) {
      const elapsed = Math.floor((Date.now() - state.lastFetch) / 1000);
      const remaining = Math.max(0, REFRESH_INTERVAL - elapsed);
      $('next-refresh').textContent = 'next ' + remaining + 's';
    }
  }
  requestAnimationFrame(tick);
}

$('search').addEventListener('input', (e) => {
  state.search = e.target.value.trim();
  applyFilter();
});

$('filter-category').addEventListener('change', (e) => {
  state.category = e.target.value;
  applyFilter();
});

$('filter-sort').addEventListener('change', (e) => {
  state.sort = e.target.value;
  applyFilter();
});

$('refresh').addEventListener('click', () => fetchCoins(false));

$('currency-toggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-cur]');
  if (btn) setCurrency(btn.dataset.cur);
});

$('coins-list').addEventListener('click', (e) => {
  const row = e.target.closest('.coin-row');
  if (row?.dataset.id) openModal(row.dataset.id);
});

$('modal-close').addEventListener('click', closeModal);
$('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

const EGG_CODE = ['n', 'e', 'o'];
let eggBuffer = [];
let eggKeyHoldTimer = null;
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  eggBuffer.push(e.key.toLowerCase());
  if (eggBuffer.length > EGG_CODE.length) eggBuffer.shift();
  if (eggBuffer.join('') === EGG_CODE.join('')) {
    triggerEasterEgg();
    eggBuffer = [];
  }
  clearTimeout(eggKeyHoldTimer);
  eggKeyHoldTimer = setTimeout(() => { eggBuffer = []; }, 2000);
});

function triggerEasterEgg() {
  const egg = $('easter-egg');
  egg.hidden = false;
  setTimeout(() => { egg.hidden = true; }, 3500);
}
$('easter-egg').addEventListener('click', () => { $('easter-egg').hidden = true; });

(async function init() {
  setCurrency(state.currency);
  await fetchRate();
  setCurrency(state.currency);
  await fetchCoins(false);
  await fetchGlobal();
  tick();
  setInterval(() => fetchCoins(true), REFRESH_INTERVAL * 1000);
  setInterval(fetchGlobal, 60 * 1000);
  setInterval(fetchRate, 30 * 60 * 1000);
})();
