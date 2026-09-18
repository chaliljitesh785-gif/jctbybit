export type PairData = {
  symbol: string; // internal format: lowercase, underscore-separated, e.g. "btc_usdt"
  category: 'Spot' | 'Futures' | 'New';
};

// LBank-style timeframe keys (kept so the rest of the app doesn't need to change)
// mapped to Bybit v5 kline intervals: 1,3,5,15,30,60,120,240,360,720,D,W,M
const INTERVAL_MAP: Record<string, string> = {
  minute1: '1',
  minute5: '5',
  minute15: '15',
  minute30: '30',
  hour1: '60',
  hour4: '240',
  hour8: '360', // Bybit has no native 8h candle; 6h is the closest supported interval
  day1: 'D',
  week1: 'W',
};

export function toBybitInterval(type: string): string {
  return INTERVAL_MAP[type] || '15';
}

// "btc_usdt" -> "BTCUSDT"
export function toBybitSymbol(pair: string): string {
  return pair.replace('_', '').toUpperCase();
}

// "BTC", "USDT" -> "btc_usdt"
export function toInternalSymbol(baseCoin: string, quoteCoin: string): string {
  return `${baseCoin}_${quoteCoin}`.toLowerCase();
}

export function categoryToMarket(category: PairData['category']): 'spot' | 'linear' {
  return category === 'Futures' ? 'linear' : 'spot';
}

export async function fetchAllPairs(): Promise<PairData[]> {
  try {
    const res = await fetch(`/api/pairs`);
    const data = await res.json();
    if (Array.isArray(data.pairs)) {
      return data.pairs;
    } else {
      console.error('API Error:', data);
    }
  } catch (err) {
    console.error('Failed to fetch pairs', err);
  }
  return [];
}

export async function fetchHistoricalKlines(
  symbol: string,
  type: string,
  size: number = 60,
  market: 'spot' | 'linear' = 'spot'
) {
  try {
    const interval = toBybitInterval(type);
    const bybitSymbol = toBybitSymbol(symbol);
    const res = await fetch(`/api/kline?symbol=${bybitSymbol}&interval=${interval}&limit=${size}&market=${market}`);
    const data = await res.json();
    if (Array.isArray(data.klines)) {
      return data.klines;
    } else {
      console.error('API Error:', data);
    }
  } catch (err) {
    console.error('Failed to fetch klines', err);
  }
  return [];
}
