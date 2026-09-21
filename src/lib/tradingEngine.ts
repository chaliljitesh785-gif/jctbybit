export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface EngineState {
  ema9: number[];
  ema21: number[];
  wma34: number[];
  sma200: number[];
  rsi9: number[];
  atr14: number[];
}

export interface TradeSignal {
  type: 'LONG' | 'SHORT' | 'NONE';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  riskDistance: number;
}

/**
 * Calculates the exact mathematical definitions and structural logic
 * for the High-Frequency M1 and M5 Scalping Engine.
 */
export class TradingEngine {
  private calculateEMA(prices: number[], n: number): number[] {
    const k = 2 / (n + 1);
    const ema: number[] = new Array(prices.length).fill(0);
    
    if (prices.length > 0) {
      ema[0] = prices[0];
    }
    
    for (let i = 1; i < prices.length; i++) {
      ema[i] = (prices[i] * k) + (ema[i - 1] * (1 - k));
    }
    
    return ema;
  }

  private calculateWMA(prices: number[], n: number): number[] {
    const wma: number[] = new Array(prices.length).fill(0);
    const denominator = (n * (n + 1)) / 2; // (34 * 35) / 2 = 595
    
    for (let i = 0; i < prices.length; i++) {
      if (i < n - 1) {
        wma[i] = NaN;
        continue;
      }
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += (n - j) * prices[i - j];
      }
      wma[i] = sum / denominator;
    }
    
    return wma;
  }

  private calculateSMA(prices: number[], n: number): number[] {
    const sma: number[] = new Array(prices.length).fill(0);
    
    for (let i = 0; i < prices.length; i++) {
      if (i < n - 1) {
        sma[i] = NaN;
        continue;
      }
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += prices[i - j];
      }
      sma[i] = sum / n;
    }
    
    return sma;
  }

  private calculateRSI(prices: number[], n: number): number[] {
    const rsi: number[] = new Array(prices.length).fill(NaN);
    
    let avgGain = 0;
    let avgLoss = 0;
    
    // Seed initial values
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

  private calculateATR(candles: Candle[], n: number): number[] {
    const atr: number[] = new Array(candles.length).fill(NaN);
    const tr: number[] = new Array(candles.length).fill(0);
    
    if (candles.length === 0) return atr;
    
    // TR_t = Max(High_t - Low_t, |High_t - Close_t-1|, |Low_t - Close_t-1|)
    tr[0] = candles[0].high - candles[0].low;
    
    for (let i = 1; i < candles.length; i++) {
      const highLow = candles[i].high - candles[i].low;
      const highClose = Math.abs(candles[i].high - candles[i - 1].close);
      const lowClose = Math.abs(candles[i].low - candles[i - 1].close);
      tr[i] = Math.max(highLow, highClose, lowClose);
    }
    
    if (candles.length <= n) return atr;
    
    // Initial ATR is simple average of TR
    let sumTR = 0;
    for (let i = 1; i <= n; i++) {
      sumTR += tr[i];
    }
    atr[n] = sumTR / n;
    
    // Formula: ATR_t = ((ATR_t-1 * 13) + TR_t) / 14
    for (let i = n + 1; i < candles.length; i++) {
      atr[i] = ((atr[i - 1] * (n - 1)) + tr[i]) / n;
    }
    
    return atr;
  }

  public calculateIndicators(candles: Candle[]): EngineState {
    const closes = candles.map(c => c.close);
    
    return {
      ema9: this.calculateEMA(closes, 9),
      ema21: this.calculateEMA(closes, 21),
      wma34: this.calculateWMA(closes, 34),
      sma200: this.calculateSMA(closes, 200),
      rsi9: this.calculateRSI(closes, 9),
      atr14: this.calculateATR(candles, 14),
    };
  }

  public analyzeBar(
    t: number, 
    candles: Candle[], 
    state: EngineState, 
    currentBidAskSpread: number
  ): TradeSignal {
    if (t < 200) return { type: 'NONE', entryPrice: 0, stopLoss: 0, takeProfit1: 0, riskDistance: 0 };
    
    const P_t = candles[t].close;
    const P_t_1 = candles[t - 1].close;
    
    const ema9_t = state.ema9[t];
    const ema9_t_1 = state.ema9[t - 1];
    const ema21_t = state.ema21[t];
    const wma34_t = state.wma34[t];
    const sma200_t = state.sma200[t];
    const rsi_t = state.rsi9[t];
    const rsi_t_1 = state.rsi9[t - 1];
    const atr_t = state.atr14[t];
    
    // STRUCTURAL REGIME FILTERS
    const bullishRegime = (P_t > ema9_t) && (ema9_t > ema21_t) && (ema21_t > wma34_t) && (wma34_t > sma200_t);
    const bearishRegime = (P_t < ema9_t) && (ema9_t < ema21_t) && (ema21_t < wma34_t) && (wma34_t < sma200_t);
    
    // PRECISION ENTRY TRIGGERS
    const longTrigger = bullishRegime && (P_t_1 < ema9_t_1) && (P_t > ema9_t) && (rsi_t_1 >= 40 && rsi_t_1 <= 48) && (rsi_t > 50);
    const shortTrigger = bearishRegime && (P_t_1 > ema9_t_1) && (P_t < ema9_t) && (rsi_t_1 >= 52 && rsi_t_1 <= 60) && (rsi_t < 50);
    
    if (longTrigger) {
      const entryP = P_t;
      const stopLoss = entryP - (1.5 * atr_t);
      const riskDistance = entryP - stopLoss;
      
      // Guard Rail Exception
      if (riskDistance <= (3 * currentBidAskSpread)) {
        return { type: 'NONE', entryPrice: 0, stopLoss: 0, takeProfit1: 0, riskDistance: 0 };
      }
      
      const takeProfit1 = entryP + (1.5 * riskDistance);
      
      return {
        type: 'LONG',
        entryPrice: entryP,
        stopLoss,
        takeProfit1,
        riskDistance
      };
    }
    
    if (shortTrigger) {
      const entryP = P_t;
      const stopLoss = entryP + (1.5 * atr_t);
      const riskDistance = stopLoss - entryP;
      
      // Guard Rail Exception
      if (riskDistance <= (3 * currentBidAskSpread)) {
        return { type: 'NONE', entryPrice: 0, stopLoss: 0, takeProfit1: 0, riskDistance: 0 };
      }
      
      const takeProfit1 = entryP - (1.5 * riskDistance);
      
      return {
        type: 'SHORT',
        entryPrice: entryP,
        stopLoss,
        takeProfit1,
        riskDistance
      };
    }
    
    return { type: 'NONE', entryPrice: 0, stopLoss: 0, takeProfit1: 0, riskDistance: 0 };
  }
}
