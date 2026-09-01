# Crypto Tracker 💰📈

Realtime cryptocurrency & memecoin tracker dengan analisa otomatis.

## Features
- 200 koin top dari CoinGecko + Binance fallback
- Auto-refresh tiap 30 detik (no flicker — DOM di-patch in-place)
- **Harga dalam USD & IDR** (toggle, rate real-time)
- **Analisa otomatis** per token: RSI + 7d trend + volume → sinyal **STRONG BUY / BUY / HOLD / SELL / STRONG SELL**
- Filter: Semua, Memecoin 🐸, Top 10, Gainers 🚀, Losers 📉, Sinyal Beli 🟢
- Sparkline chart 7d per koin
- Modal detail per koin (ATH, supply, link homepage)
- Live clock + countdown ke refresh berikutnya
- Flash animation saat harga/percentage berubah
- Easter egg: ketik "neo" 🎉
- Stale-while-revalidate caching di backend
- Auto-retry + Binance fallback kalau CoinGecko rate-limit

## Tech Stack
- **Backend:** Node.js + Express 5
- **Frontend:** Vanilla JS (no framework, no build step)
- **Data:** CoinGecko API + Binance API fallback
- **Cache:** In-memory SWR pattern (30s fresh, 5min stale)

## Setup
```bash
npm install
npm start
```

Buka `http://localhost:3000`

## Disclaimer
⚠️ Analisa otomatis hanya untuk edukasi, **bukan saran finansial**.

---

Made by **Neo** — student, javascript enthusiast.
