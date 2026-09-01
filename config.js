window.API_BASE = (() => {
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return '';
  if (hostname === 'handuksedap.github.io') return 'https://crypto-tracker-api-zjbi.onrender.com';
  return '';
})();
