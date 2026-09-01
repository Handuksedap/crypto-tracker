# Crypto Tracker 💰📈

Realtime cryptocurrency & memecoin tracker dengan analisa otomatis.

🌐 **Live:** https://handuksedap.github.io/crypto-tracker

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
- **Backend:** Node.js + Express 5 (deploy di Render.com)
- **Frontend:** Vanilla JS (no framework, no build step) — deploy di GitHub Pages
- **Data:** CoinGecko API + Binance API fallback
- **Cache:** In-memory SWR pattern (30s fresh, 5min stale)

## Setup (local)
```bash
npm install
npm start
```
Buka `http://localhost:3000`

## Deployment
- **Frontend:** GitHub Pages dari branch `gh-pages` (auto-built)
- **Backend:** Render.com (lihat setup di bawah)

### Setup Render.com (1x)
1. Buka https://render.com → Sign up with GitHub
2. Klik **"New +" → "Blueprint"**
3. Pilih repo `Handuksedap/crypto-tracker`
4. Render otomatis detect `render.yaml` → klik **"Apply"**
5. Tunggu 2-3 menit sampai deploy selesai
6. Copy URL backend (mis: `https://crypto-tracker-api-zjbi.onrender.com`)
7. Edit `public/config.js` di branch `gh-pages`, ganti URL dengan URL backend kamu
8. Commit & push ke `gh-pages`

## Disclaimer
⚠️ Analisa otomatis hanya untuk edukasi, **bukan saran finansial**.

---

Made by **Neo** — student, javascript enthusiast.
