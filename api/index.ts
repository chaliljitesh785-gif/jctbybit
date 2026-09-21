import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const BYBIT_REST_BASE = 'https://api.bybit.com';

app.use(cors());
app.use(express.json());

const POPULAR_COIN_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  XRP: 'XRP',
  DOGE: 'Dogecoin',
  SUI: 'Sui',
  PEPE: 'Pepe',
  BNB: 'BNB',
  ADA: 'Cardano',
  AVAX: 'Avalanche',
  LINK: 'Chainlink',
  NEAR: 'NEAR Protocol',
  SHIB: 'Shiba Inu',
  DOT: 'Polkadot',
  LTC: 'Litecoin',
  TRX: 'TRON',
  BCH: 'Bitcoin Cash',
  APT: 'Aptos',
  POL: 'Polygon',
  MATIC: 'Polygon',
  UNI: 'Uniswap',
  ICP: 'Internet Computer',
  FET: 'ASI Alliance',
  TAO: 'Bittensor',
  RENDER: 'Render',
  INJ: 'Injective',
  TIA: 'Celestia',
  SEI: 'Sei',
  KAS: 'Kaspa',
  TON: 'Toncoin',
  WIF: 'dogwifhat',
  BONK: 'Bonk',
  FLOKI: 'Floki',
  AAVE: 'Aave',
  CRV: 'Curve DAO',
  MKR: 'Maker',
  ARB: 'Arbitrum',
  OP: 'Optimism',
  PENDLE: 'Pendle',
  JUP: 'Jupiter',
  RUNE: 'THORChain',
  ENA: 'Ethena',
  WLD: 'Worldcoin',
  STX: 'Stacks',
  HBAR: 'Hedera',
  FIL: 'Filecoin',
  ATOM: 'Cosmos',
  FTM: 'Fantom',
  S: 'Sonic',
  XAU: 'Gold (XAU)',
  XAG: 'Silver (XAG)',
  XAUT: 'Tether Gold',
  PAXG: 'PAX Gold',
};

interface RealBybitPair {
  symbol: string;
  bybitSymbol: string;
  category: 'Spot' | 'Futures' | 'New';
  name: string;
  price: number;
  change24h: number;
  turnover24h: number;
  high24h: number;
  low24h: number;
  leverage?: string;
}

let cachedPairs: RealBybitPair[] = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds in-memory cache

async function getRealBybitPairs(): Promise<RealBybitPair[]> {
  const now = Date.now();
  if (cachedPairs.length > 0 && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedPairs;
  }

  try {
    const [spotRes, linearRes] = await Promise.all([
      fetch(`${BYBIT_REST_BASE}/v5/market/tickers?category=spot`),
      fetch(`${BYBIT_REST_BASE}/v5/market/tickers?category=linear`),
    ]);

    if (!spotRes.ok && !linearRes.ok) {
      if (cachedPairs.length > 0) return cachedPairs;
      throw new Error('Failed to fetch tickers from Bybit');
    }

    const [spotData, linearData] = await Promise.all([
      spotRes.ok ? spotRes.json() : { retCode: -1, result: { list: [] } },
      linearRes.ok ? linearRes.json() : { retCode: -1, result: { list: [] } },
    ]);

    const pairs: RealBybitPair[] = [];
    const seen = new Set<string>();

    if (spotData.retCode === 0 && Array.isArray(spotData.result?.list)) {
      for (const t of spotData.result.list) {
        if (!t.symbol.endsWith('USDT')) continue;
        const base = t.symbol.slice(0, -4);
        const internalSymbol = `${base.toLowerCase()}_usdt`;
        const key = `spot:${internalSymbol}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const price = parseFloat(t.lastPrice) || 0;
        const change24h = parseFloat((parseFloat(t.price24hPcnt || '0') * 100).toFixed(2));
        const turnover24h = parseFloat(t.turnover24h || '0');

        pairs.push({
          symbol: internalSymbol,
          bybitSymbol: t.symbol,
          category: 'Spot',
          name: POPULAR_COIN_NAMES[base] || base,
          price,
          change24h,
          turnover24h,
          high24h: parseFloat(t.highPrice24h || '0'),
          low24h: parseFloat(t.lowPrice24h || '0'),
        });
      }
    }

    if (linearData.retCode === 0 && Array.isArray(linearData.result?.list)) {
      for (const t of linearData.result.list) {
        if (!t.symbol.endsWith('USDT')) continue;
        const base = t.symbol.slice(0, -4);
        const internalSymbol = `${base.toLowerCase()}_usdt`;
        const key = `linear:${internalSymbol}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const price = parseFloat(t.lastPrice) || 0;
        const change24h = parseFloat((parseFloat(t.price24hPcnt || '0') * 100).toFixed(2));
        const turnover24h = parseFloat(t.turnover24h || '0');
        const leverage = ['BTC', 'ETH'].includes(base)
          ? '100x'
          : ['SOL', 'XRP', 'DOGE', 'BNB', 'SUI'].includes(base)
          ? '50x'
          : '25x';

        pairs.push({
          symbol: internalSymbol,
          bybitSymbol: t.symbol,
          category: 'Futures',
          name: `${POPULAR_COIN_NAMES[base] || base} Perp`,
          price,
          change24h,
          turnover24h,
          high24h: parseFloat(t.highPrice24h || '0'),
          low24h: parseFloat(t.lowPrice24h || '0'),
          leverage,
        });
      }
    }

    // Sort by highest 24h trading volume on Bybit
    pairs.sort((a, b) => b.turnover24h - a.turnover24h);

    if (pairs.length > 0) {
      cachedPairs = pairs;
      lastCacheTime = now;
    }
    return cachedPairs;
  } catch (err) {
    console.error('Error loading real Bybit tickers:', err);
    return cachedPairs;
  }
}

app.get('/api/pairs', async (req, res) => {
  try {
    const pairs = await getRealBybitPairs();
    res.json({ pairs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch pairs' });
  }
});

function generateSyntheticKlines(symbolStr: string, intervalStr: string = '15', count: number = 100): string[][] {
  const sym = (symbolStr || '').toUpperCase();
  let basePrice = 50.0;
  let volatility = 0.002;

  if (sym.includes('EUR') || (sym.includes('USD') && sym.length <= 7 && !sym.includes('USDT'))) {
    basePrice = 1.1120;
    volatility = 0.0004;
  } else if (sym.includes('XAU') || sym.includes('GOLD')) {
    basePrice = 2585.0;
    volatility = 0.002;
  } else if (sym.includes('BTC')) {
    basePrice = 64250.0;
    volatility = 0.0025;
  } else if (sym.includes('ETH')) {
    basePrice = 2650.0;
    volatility = 0.003;
  } else if (sym.includes('SOL')) {
    basePrice = 154.0;
    volatility = 0.004;
  } else if (sym.includes('DOGE')) {
    basePrice = 0.1245;
    volatility = 0.005;
  } else if (sym.includes('XRP')) {
    basePrice = 0.5840;
    volatility = 0.003;
  }

  const intervalSecondsMap: Record<string, number> = {
    '1': 60,
    '3': 180,
    '5': 300,
    '15': 900,
    '30': 1800,
    '60': 3600,
    '120': 7200,
    '240': 14400,
    '360': 21600,
    '720': 43200,
    'D': 86400,
    'W': 604800,
  };
  const stepSec = intervalSecondsMap[intervalStr] || 900;
  const nowSec = Math.floor(Date.now() / 1000);
  const alignedNow = nowSec - (nowSec % stepSec);

  const klines: string[][] = [];
  let currentPrice = basePrice;
  const decimals = basePrice < 2 ? 4 : basePrice < 10 ? 3 : 2;

  for (let i = count - 1; i >= 0; i--) {
    const candleTime = alignedNow - i * stepSec;
    const wave = Math.sin(i * 0.15) * 0.4 + Math.cos(i * 0.05) * 0.3;
    const change = currentPrice * volatility * (wave + (Math.random() - 0.5));
    const open = currentPrice;
    const close = Math.max(0.0001, open + change);
    const wickHigh = Math.abs(change) * (0.3 + Math.random() * 0.7);
    const wickLow = Math.abs(change) * (0.3 + Math.random() * 0.7);
    const high = Math.max(open, close) + wickHigh;
    const low = Math.max(0.0001, Math.min(open, close) - wickLow);
    const volume = (Math.random() * 50 + 10).toFixed(2);

    klines.push([
      candleTime.toString(),
      open.toFixed(decimals),
      high.toFixed(decimals),
      low.toFixed(decimals),
      close.toFixed(decimals),
      volume,
    ]);
    currentPrice = close;
  }

  return klines;
}

app.get('/api/kline', async (req, res) => {
  try {
    let symbol = (req.query.symbol as string || '').toUpperCase();
    const interval = (req.query.interval as string) || '15';
    const limit = (req.query.limit as string) || '200';
    let market = req.query.market;

    if (!symbol) {
      return res.status(400).json({ error: 'symbol is required' });
    }

    // Auto-normalize Gold and Silver requests to Bybit official USDT linear contracts
    if (symbol === 'XAUUSD' || symbol === 'XAU') {
      symbol = 'XAUUSDT';
      market = 'linear';
    } else if (symbol === 'XAGUSD' || symbol === 'XAG') {
      symbol = 'XAGUSDT';
      market = 'linear';
    }

    // Direct check for CFD / Forex instruments (pure forex with no USDT contract on Bybit)
    const isCfdSymbol = symbol === 'EURUSD' || (symbol.endsWith('USD') && !symbol.includes('USDT') && !symbol.startsWith('XAU') && !symbol.startsWith('XAG'));
    if (isCfdSymbol) {
      const klines = generateSyntheticKlines(symbol, interval, parseInt(limit, 10) || 100);
      return res.json({ klines, isSynthetic: true });
    }

    const primaryCategory = (market === 'linear' || symbol === 'XAUUSDT' || symbol === 'XAGUSDT') ? 'linear' : 'spot';
    const primaryUrl = `${BYBIT_REST_BASE}/v5/market/kline?category=${primaryCategory}&symbol=${symbol}&interval=${interval}&limit=${limit}`;
    
    let response = await fetch(primaryUrl);
    let data: any = null;
    if (response.ok) {
      data = await response.json();
    }

    // If primary category failed or unsupported symbol, attempt fallback to the other Bybit market category
    if (!data || data.retCode !== 0) {
      const altCategory = primaryCategory === 'spot' ? 'linear' : 'spot';
      const altUrl = `${BYBIT_REST_BASE}/v5/market/kline?category=${altCategory}&symbol=${symbol}&interval=${interval}&limit=${limit}`;
      try {
        const altResponse = await fetch(altUrl);
        if (altResponse.ok) {
          const altData = await altResponse.json();
          if (altData.retCode === 0 && altData.result?.list?.length > 0) {
            data = altData;
          }
        }
      } catch (err) {
        // Silently continue to synthetic fallback
      }
    }

    // If Bybit still returns an error or unsupported symbol, generate realistic klines rather than throwing 400
    if (!data || data.retCode !== 0 || !data.result?.list) {
      const klines = generateSyntheticKlines(symbol, interval, parseInt(limit, 10) || 100);
      return res.json({ klines, isSynthetic: true });
    }

    const klines = [...data.result.list]
      .reverse()
      .map((k: string[]) => [
        Math.floor(parseInt(k[0], 10) / 1000).toString(),
        k[1],
        k[2],
        k[3],
        k[4],
        k[5],
      ]);
    res.json({ klines });
  } catch (error) {
    console.error('Kline fallback error:', error);
    const klines = generateSyntheticKlines((req.query.symbol as string) || 'BTCUSDT', (req.query.interval as string) || '15', 100);
    res.json({ klines, isSynthetic: true });
  }
});

function signBybitRequest(apiSecret: string, timestamp: string, apiKey: string, recvWindow: string, payload: string) {
  const raw = timestamp + apiKey + recvWindow + payload;
  return crypto.createHmac('sha256', apiSecret).update(raw).digest('hex');
}

async function bybitSignedRequest(method: 'GET' | 'POST', endpoint: string, params: Record<string, any> = {}) {
  const apiKey = process.env.BYBIT_API_KEY;
  const apiSecret = process.env.BYBIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error('Bybit API keys are not configured in Secrets.');
  }

  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  let url = `${BYBIT_REST_BASE}${endpoint}`;
  let body: string | undefined;
  let payload = '';

  if (method === 'GET') {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    payload = qs;
    if (qs) url += `?${qs}`;
  } else {
    payload = JSON.stringify(params);
    body = payload;
  }

  const sign = signBybitRequest(apiSecret, timestamp, apiKey, recvWindow, payload);

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-SIGN': sign,
      'X-BAPI-SIGN-TYPE': '2',
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': recvWindow,
    },
    body,
  });

  return response.json();
}

app.post('/api/trade', async (req, res) => {
  try {
    const { category = 'spot', symbol, side, orderType = 'Market', qty, price } = req.body || {};

    if (!symbol || !side || !qty) {
      return res.status(400).json({ error: 'symbol, side, and qty are required.' });
    }

    const orderParams: Record<string, any> = { category, symbol, side, orderType, qty: qty.toString() };
    if (orderType === 'Limit' && price) orderParams.price = price.toString();

    const result = await bybitSignedRequest('POST', '/v5/order/create', orderParams);
    res.json(result);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to place order' });
  }
});

app.get('/api/balance', async (req, res) => {
  try {
    const accountType = (req.query.accountType as string) || 'UNIFIED';
    const result = await bybitSignedRequest('GET', '/v5/account/wallet-balance', { accountType });
    res.json(result);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to fetch balance' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

export default app;
