const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  const allowed = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://handuksedap.github.io',
  ];
  const origin = req.headers.origin;
  if (allowed.includes(origin) || !origin) {
    res.set('Access-Control-Allow-Origin', origin || '*');
  }
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const COINGECKO = 'https://api.coingecko.com/api/v3';
const BINANCE = 'https://api.binance.com/api/v3';

const store = {
  coins: { data: null, ts: 0, inflight: null, retryAfter: 0 },
  global: { data: null, ts: 0, inflight: null },
  rate: { data: null, ts: 0, inflight: null },
  coinDetail: {},
};

const FRESH = {
  coins: 30 * 1000,
  stale: 5 * 60 * 1000,
  global: 5 * 60 * 1000,
  rate: 60 * 60 * 1000,
  detail: 5 * 60 * 1000,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, opts = {}, timeout = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal, headers: { 'User-Agent': 'crypto-tracker/1.0', Accept: 'application/json' } });
    return r;
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(url, opts = {}, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetchWithTimeout(url, opts, 8000);
      if (r.status === 429) {
        const ra = parseInt(r.headers.get('retry-after')) || 60;
        const err = new Error('rate limited');
        err.retryAfter = ra;
        err.status = 429;
        throw err;
      }
      return r;
    } catch (e) {
      lastErr = e;
      if (e.status === 429) throw e;
      if (i < retries) await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

async function getWithCache(key, fetcher, { fresh, stale, name = key }) {
  const s = store[key];
  const now = Date.now();
  const age = s.ts ? now - s.ts : Infinity;

  if (s.data && age < fresh) {
    return { data: s.data, source: 'fresh' };
  }

  if (s.inflight) {
    return { data: s.inflight, source: 'inflight' };
  }

  if (s.data && age < stale) {
    refreshInBackground(key, fetcher);
    return { data: s.data, source: 'stale' };
  }

  try {
    const p = (async () => {
      const r = await fetcher();
      s.data = r;
      s.ts = Date.now();
      s.retryAfter = 0;
      s.inflight = null;
      return r;
    })();
    s.inflight = p;
    const result = await p;
    return { data: result, source: 'fresh' };
  } catch (e) {
    s.inflight = null;
    if (e.status === 429) {
      s.retryAfter = Date.now() + (e.retryAfter || 60) * 1000;
      if (s.data) return { data: s.data, source: 'stale-on-error', error: e.message };
    }
    if (s.data) return { data: s.data, source: 'stale-on-error', error: e.message };
    throw e;
  }
}

function refreshInBackground(key, fetcher) {
  setImmediate(async () => {
    try {
      const data = await fetcher();
      store[key].data = data;
      store[key].ts = Date.now();
    } catch (e) {
      store[key].inflight = null;
      if (e.status === 429) {
        store[key].retryAfter = Date.now() + (e.retryAfter || 60) * 1000;
      }
    }
  });
}

async function fetchCoinsFromCoinGecko(limit) {
  const url = `${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=1h,24h,7d`;
  const r = await fetchWithRetry(url);
  if (!r.ok) {
    const err = new Error('CoinGecko ' + r.status);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

async function fetchCoinsFromBinance(limit) {
  const r = await fetchWithRetry(`${BINANCE}/exchangeInfo`);
  if (!r.ok) throw new Error('Binance ' + r.status);
  const info = await r.json();
  const usdtSymbols = info.symbols
    .filter((s) => s.status === 'TRADING' && s.quoteAsset === 'USDT' && !s.isMarginTradingAllowed === false)
    .filter((s) => /USDT$/.test(s.symbol))
    .slice(0, limit * 2);

  const symbols = usdtSymbols.map((s) => s.symbol.toLowerCase() + '@ticker').slice(0, 50);
  const streamsUrl = `https://stream.binance.com:9443/stream?streams=${symbols.join('/')}`;

  const tickers = await Promise.all(
    usdtSymbols.slice(0, 100).map(async (s) => {
      try {
        const t = await fetchWithRetry(`${BINANCE}/ticker/24hr?symbol=${s.symbol}`, {}, 0);
        if (!t.ok) return null;
        return await t.json();
      } catch { return null; }
    })
  );

  const valid = tickers.filter(Boolean);
  const mapped = valid.map((t) => {
    const price = parseFloat(t.lastPrice);
    const change24 = parseFloat(t.priceChangePercent);
    const volume = parseFloat(t.quoteVolume);
    const high = parseFloat(t.highPrice);
    const low = parseFloat(t.lowPrice);
    return {
      id: t.symbol.toLowerCase(),
      symbol: t.symbol.replace('USDT', '').toLowerCase(),
      name: t.symbol.replace('USDT', ''),
      image: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${t.symbol.replace('USDT', '').toLowerCase()}.png`,
      current_price: price,
      market_cap: null,
      market_cap_rank: 999,
      fully_diluted_valuation: null,
      total_volume: volume,
      high_24h: high,
      low_24h: low,
      price_change_24h: parseFloat(t.priceChange),
      price_change_percentage_24h: change24,
      market_cap_change_24h: null,
      market_cap_change_percentage_24h: null,
      circulating_supply: null,
      total_supply: null,
      max_supply: null,
      ath: null,
      ath_change_percentage: null,
      ath_date: null,
      atl: null,
      atl_change_percentage: null,
      atl_date: null,
      last_updated: new Date().toISOString(),
      sparkline_in_7d: { price: [] },
      price_change_percentage_1h_in_currency: null,
      price_change_percentage_7d_in_currency: null,
    };
  });

  return mapped;
}

async function fetchCoinsData(limit) {
  try {
    return await fetchCoinsFromCoinGecko(limit);
  } catch (e) {
    console.warn('[coins] CoinGecko failed, trying Binance:', e.message);
    return await fetchCoinsFromBinance(limit);
  }
}

app.get('/api/coins', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 250);
  try {
    const { data, source } = await getWithCache(
      'coins',
      () => fetchCoinsData(limit),
      { fresh: FRESH.coins, stale: FRESH.stale }
    );
    res.set('X-Cache', source);
    res.set('Cache-Control', 'public, max-age=15');
    res.json(data);
  } catch (e) {
    console.error('[coins] total fail:', e.message);
    res.status(503).json({ error: e.message, retry_after: 60 });
  }
});

app.get('/api/analyze', (req, res) => {
  const c = store.coins.data;
  if (!c) return res.status(503).json({ error: 'data not ready' });
  res.json(c.map(analyzeCoin));
});

app.get('/api/analyze/:id', (req, res) => {
  const c = store.coins.data;
  if (!c) return res.status(503).json({ error: 'data not ready' });
  const coin = c.find((x) => x.id === req.params.id);
  if (!coin) return res.status(404).json({ error: 'not found' });
  res.json(analyzeCoin(coin));
});

app.get('/api/coin/:id', async (req, res) => {
  const id = req.params.id;
  const c = store.coins.data;
  if (c) {
    const found = c.find((x) => x.id === id);
    if (found) return res.json(found);
  }
  try {
    const r = await fetchWithRetry(`${COINGECKO}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`);
    if (!r.ok) return res.status(r.status).json({ error: 'not found' });
    const d = await r.json();
    store.coinDetail[id] = { data: d, ts: Date.now() };
    res.json(d);
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

app.get('/api/global', async (req, res) => {
  try {
    const { data, source } = await getWithCache(
      'global',
      async () => {
        const r = await fetchWithRetry(`${COINGECKO}/global`);
        if (!r.ok) throw new Error('global ' + r.status);
        return r.json();
      },
      { fresh: FRESH.global, stale: 30 * 60 * 1000 }
    );
    res.set('X-Cache', source);
    res.json(data);
  } catch (e) {
    if (store.global.data) {
      res.set('X-Cache', 'stale-on-error');
      return res.json(store.global.data);
    }
    res.status(503).json({ error: e.message });
  }
});

app.get('/api/rate', async (req, res) => {
  try {
    const { data, source } = await getWithCache(
      'rate',
      async () => {
        const r = await fetchWithRetry('https://api.exchangerate-api.com/v4/latest/USD', {}, 0);
        if (!r.ok) throw new Error('rate ' + r.status);
        const d = await r.json();
        return { usd_to_idr: d.rates?.IDR || 15800 };
      },
      { fresh: FRESH.rate, stale: 24 * 60 * 60 * 1000 }
    );
    res.set('X-Cache', source);
    res.json({ ...data, cached: source !== 'fresh' });
  } catch (e) {
    res.json({ usd_to_idr: store.rate.data?.usd_to_idr || 15800, cached: true, error: e.message });
  }
});

function computeRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return 50;
  const recent = prices.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeTrend(prices) {
  if (!prices || prices.length < 2) return 'flat';
  const n = prices.length;
  const half = Math.floor(n / 2);
  const first = prices.slice(0, half);
  const second = prices.slice(half);
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
  const change = ((avgSecond - avgFirst) / avgFirst) * 100;
  if (change > 2) return 'up';
  if (change < -2) return 'down';
  return 'flat';
}

function analyzeCoin(c) {
  const sparks = c.sparkline_in_7d?.price || [];
  const ch1h = c.price_change_percentage_1h_in_currency || 0;
  const ch24 = c.price_change_percentage_24h || 0;
  const ch7d = c.price_change_percentage_7d_in_currency || 0;
  const vol = c.total_volume || 0;
  const mc = c.market_cap || 0;
  const volMcRatio = mc > 0 ? vol / mc : 0;

  const rsi = computeRSI(sparks);
  const trend = computeTrend(sparks);
  const momentum = ((ch24 + ch7d) / 2) - Math.abs(ch1h) * 0.3;
  const volSignal = volMcRatio > 0.15 ? 'high' : volMcRatio > 0.05 ? 'normal' : 'low';

  let score = 0;
  let reasons = [];
  if (rsi < 30) { score += 3; reasons.push('RSI oversold (' + rsi.toFixed(0) + ')'); }
  else if (rsi < 45) { score += 1; reasons.push('RSI lemah'); }
  else if (rsi > 70) { score -= 3; reasons.push('RSI overbought (' + rsi.toFixed(0) + ')'); }
  else if (rsi > 55) { score -= 1; reasons.push('RSI kuat'); }

  if (trend === 'up') { score += 2; reasons.push('7d uptrend'); }
  else if (trend === 'down') { score -= 2; reasons.push('7d downtrend'); }

  if (ch24 > 5) { score += 1; reasons.push('+24h kuat'); }
  else if (ch24 < -5) { score -= 1; reasons.push('-24h tajam'); }

  if (volSignal === 'high') { score += 1; reasons.push('volume tinggi'); }
  else if (volSignal === 'low') { score -= 1; reasons.push('volume sepi'); }

  let signal, signalLabel;
  if (score >= 4) { signal = 'strong-buy'; signalLabel = 'STRONG BUY'; }
  else if (score >= 2) { signal = 'buy'; signalLabel = 'BUY'; }
  else if (score <= -4) { signal = 'strong-sell'; signalLabel = 'STRONG SELL'; }
  else if (score <= -2) { signal = 'sell'; signalLabel = 'SELL'; }
  else { signal = 'hold'; signalLabel = 'HOLD'; }

  return { id: c.id, symbol: c.symbol, rsi: Math.round(rsi), trend, momentum: Math.round(momentum * 100) / 100, volSignal, score, signal, signalLabel, reasons };
}

app.listen(PORT, () => {
  console.log(`✓ crypto-tracker running at http://localhost:${PORT}`);
});
