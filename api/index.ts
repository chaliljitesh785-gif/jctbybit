import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const BYBIT_REST_BASE = 'https://api.bybit.com';

app.use(cors());
app.use(express.json());

app.get('/api/pairs', async (req, res) => {
  try {
    const [spotRes, linearRes] = await Promise.all([
      fetch(`${BYBIT_REST_BASE}/v5/market/instruments-info?category=spot`),
      fetch(`${BYBIT_REST_BASE}/v5/market/instruments-info?category=linear`),
    ]);
    if (!spotRes.ok || !linearRes.ok) throw new Error('Failed to fetch from Bybit');
    const [spotData, linearData] = await Promise.all([spotRes.json(), linearRes.json()]);

    const pairs: { symbol: string; category: 'Spot' | 'Futures' | 'New' }[] = [];
    const seen = new Set<string>();

    if (spotData.retCode === 0) {
      for (const inst of spotData.result.list) {
        if (inst.status !== 'Trading') continue;
        const symbol = `${inst.baseCoin}_${inst.quoteCoin}`.toLowerCase();
        if (seen.has('spot:' + symbol)) continue;
        seen.add('spot:' + symbol);
        pairs.push({ symbol, category: Math.random() > 0.9 ? 'New' : 'Spot' });
      }
    } else {
      console.error('Bybit spot instruments error:', spotData);
    }

    if (linearData.retCode === 0) {
      for (const inst of linearData.result.list) {
        if (inst.status !== 'Trading' || inst.quoteCoin !== 'USDT') continue;
        if (inst.symbol !== inst.baseCoin + inst.quoteCoin) continue;
        const symbol = `${inst.baseCoin}_${inst.quoteCoin}`.toLowerCase();
        if (seen.has('linear:' + symbol)) continue;
        seen.add('linear:' + symbol);
        pairs.push({ symbol, category: 'Futures' });
      }
    } else {
      console.error('Bybit linear instruments error:', linearData);
    }

    res.json({ pairs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch pairs' });
  }
});

app.get('/api/kline', async (req, res) => {
  try {
    const { symbol, interval, limit, market } = req.query;
    const category = market === 'linear' ? 'linear' : 'spot';
    const url = `${BYBIT_REST_BASE}/v5/market/kline?category=${category}&symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch from Bybit');
    const data = await response.json();
    if (data.retCode !== 0) {
      console.error('Bybit kline error:', data);
      return res.status(400).json({ error: data.retMsg || 'Bybit API error' });
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
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch kline' });
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
