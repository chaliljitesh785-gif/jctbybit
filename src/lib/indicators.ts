export function calculateSMA(data: number[], period: number): number[] {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

export function calculateEMA(data: number[], period: number): number[] {
  const ema = [];
  const k = 2 / (period + 1);
  let previousEma = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      ema.push(data[i]);
      previousEma = data[i];
    } else {
      const currentEma = (data[i] - previousEma) * k + previousEma;
      ema.push(currentEma);
      previousEma = currentEma;
    }
  }
  return ema;
}

export function calculateRSI(prices: number[], n: number): number[] {
  const rsi: number[] = new Array(prices.length).fill(NaN);
  
  let avgGain = 0;
  let avgLoss = 0;
  
  if (prices.length <= n) return rsi;
  
  for (let i = 1; i <= n; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= n;
  avgLoss /= n;
  
  if (avgLoss === 0) {
    rsi[n] = 100;
  } else {
    const rs = avgGain / avgLoss;
    rsi[n] = 100 - (100 / (1 + rs));
  }
  
  for (let i = n + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    
    avgGain = ((avgGain * (n - 1)) + gain) / n;
    avgLoss = ((avgLoss * (n - 1)) + loss) / n;
    
    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }
  
  return rsi;
}
