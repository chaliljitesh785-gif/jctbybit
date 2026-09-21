import { calculateEMA, calculateSMA } from './indicators';

export type SMCResult = {
  trend: 'Bullish' | 'Bearish' | 'Ranging';
  fvg: boolean;
  ob: boolean;
  bb: boolean;
  mb: boolean;
  rb: boolean;
  vi: boolean;
  openingGap: boolean;
  bos: boolean;
  choch: boolean;
  mss: boolean;
  bsl: boolean;
  ssl: boolean;
  liquidityVoid: boolean;
  liquidity: boolean;
  displacement: boolean;
  trap: 'Bull Trap' | 'Bear Trap' | 'None';
  trapPrice: number | null;
  trapTime: number | null;
  trigger: number | null;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  r: number | null;
  pattern: string;
  scalpingSignal: 'Buy' | 'Sell' | 'Hold';
  swingSignal: 'Buy' | 'Sell' | 'Hold';
  
  // Nexus Dashboard Integrations
  nexusBullScore: number;
  nexusBearScore: number;
  nexusVerdict: string;
  nexusVerdictColor: string;
  nexusEmaTrend: string;
  nexusCloud: string;
  nexusRelVol: string;
  nexusRelVolNum: number;
  nexusDelta: string;
  nexusDeltaColor: string;
  nexusActiveZones: string;
  nexusSetup: string;
};

// Simplified SMC calculation based on actual price action rules
export function analyzeSMC(klines: any[]): SMCResult {
  // Return empty structure if not enough data
  if (!klines || klines.length < 5) {
    return {
      trend: 'Ranging', fvg: false, ob: false, bb: false, mb: false, rb: false, vi: false, openingGap: false,
      bos: false, choch: false, mss: false, bsl: false, ssl: false, liquidityVoid: false,
      liquidity: false, displacement: false, trap: 'None', trapPrice: null, trapTime: null, trigger: null, sl: null,
      tp1: null, tp2: null, tp3: null, r: null, pattern: 'None',
      scalpingSignal: 'Hold', swingSignal: 'Hold',
      nexusBullScore: 0, nexusBearScore: 0, nexusVerdict: 'LOADING', nexusVerdictColor: 'text-slate-500',
      nexusEmaTrend: '-', nexusCloud: '-', nexusRelVol: '-', nexusRelVolNum: 0, nexusDelta: '-', nexusDeltaColor: '', nexusActiveZones: '-', nexusSetup: ''
    };
  }

  // klines: [timestamp, open, high, low, close, volume]
  const c3 = klines[klines.length - 1]; // current candle
  const c2 = klines[klines.length - 2];
  const c1 = klines[klines.length - 3];

  const open1 = parseFloat(c1[1]);
  const high1 = parseFloat(c1[2]);
  const low1 = parseFloat(c1[3]);
  const close1 = parseFloat(c1[4]);

  const open2 = parseFloat(c2[1]);
  const high2 = parseFloat(c2[2]);
  const low2 = parseFloat(c2[3]);
  const close2 = parseFloat(c2[4]);
  
  const open3 = parseFloat(c3[1]);
  const high3 = parseFloat(c3[2]);
  const low3 = parseFloat(c3[3]);
  const close3 = parseFloat(c3[4]);

  const bodySize = Math.abs(open3 - close3);
  const wickSize = high3 - low3;

  // Trend detection based on moving averages (simulated via last 5 candles)
  const isBullish = close3 > parseFloat(klines[klines.length - 5][4]);
  const trend = isBullish ? 'Bullish' : 'Bearish';

  // Fair Value Gap (FVG)
  const fvgBullish = low3 > high1 && isBullish;
  const fvgBearish = high3 < low1 && !isBullish;
  const fvg = fvgBullish || fvgBearish;

  // Volume Imbalance (VI) - Gap between bodies but wicks overlap
  const vi = (open3 > close2 && low3 <= high2) || (open3 < close2 && high3 >= low2);

  // Opening Gap - True gap between wicks
  const openingGap = (low3 > high2) || (high3 < low2);

  // Liquidity Void - Large rapid movement
  const isC1Bullish = close1 > open1;
  const isC2Bullish = close2 > open2;
  const isC3Bullish = close3 > open3;
  const liquidityVoid = (isC1Bullish && isC2Bullish && isC3Bullish && open3 > (open2 + close2)/2 && open2 > (open1 + close1)/2) || 
                        (!isC1Bullish && !isC2Bullish && !isC3Bullish && open3 < (open2 + close2)/2 && open2 < (open1 + close1)/2);

  // Moving Averages calculations
  const closingPrices = klines.map(k => parseFloat(k[4]));
  const ema9 = calculateEMA(closingPrices, 9);
  const ema21 = calculateEMA(closingPrices, 21);
  const sma50 = calculateSMA(closingPrices, 50);
  const sma200 = calculateSMA(closingPrices, 200);

  const currentEma9 = ema9[ema9.length - 1];
  const currentEma21 = ema21[ema21.length - 1];
  const prevEma9 = ema9[ema9.length - 2];
  const prevEma21 = ema21[ema21.length - 2];

  const currentSma50 = sma50[sma50.length - 1] || 0;
  const currentSma200 = sma200[sma200.length - 1] || 0;

  // Scalping Strategy: Fast EMA cross (9 vs 21) & price position
  let scalpingSignal: 'Buy' | 'Sell' | 'Hold' = 'Hold';
  if (currentEma9 > currentEma21 && prevEma9 <= prevEma21) {
    scalpingSignal = 'Buy';
  } else if (currentEma9 < currentEma21 && prevEma9 >= prevEma21) {
    scalpingSignal = 'Sell';
  } else if (close3 > currentEma9 && currentEma9 > currentEma21) {
    scalpingSignal = 'Buy'; // Sustained momentum
  } else if (close3 < currentEma9 && currentEma9 < currentEma21) {
    scalpingSignal = 'Sell'; // Sustained drop
  }

  // Displacement (large body relative to wicks)
  const displacement = bodySize > (wickSize * 0.6) && wickSize > 0;

  // Swing Strategy: Macro trend (SMA 50 vs 200) + Order Block / FVG alignment
  let swingSignal: 'Buy' | 'Sell' | 'Hold' = 'Hold';
  const isGoldenCross = currentSma50 > currentSma200;
  if (isGoldenCross && (fvgBullish || (isBullish && displacement))) {
    swingSignal = 'Buy';
  } else if (!isGoldenCross && (fvgBearish || (!isBullish && displacement)) && currentSma50 > 0 && currentSma200 > 0) {
    swingSignal = 'Sell';
  } else if (isGoldenCross && close3 > currentSma50) {
    swingSignal = 'Buy';
  } else if (!isGoldenCross && close3 < currentSma50 && currentSma50 > 0 && currentSma200 > 0) {
    swingSignal = 'Sell';
  }

  // Order Block (last down candle before up move or vice versa)
  const ob = displacement && (
    (isBullish && parseFloat(c2[4]) < parseFloat(c2[1])) || 
    (!isBullish && parseFloat(c2[4]) > parseFloat(c2[1]))
  );

  // Structural mapping
  const swingHighs = klines.slice(-20, -1).map(k => parseFloat(k[2]));
  const swingLows = klines.slice(-20, -1).map(k => parseFloat(k[3]));
  
  const swingHigh = Math.max(...swingHighs);
  const swingLow = Math.min(...swingLows);
  const recentSwingHigh = Math.max(...swingHighs.slice(-10));
  const recentSwingLow = Math.min(...swingLows.slice(-10));

  const bos = displacement && ((isBullish && close3 > recentSwingHigh) || (!isBullish && close3 < recentSwingLow));
  const choch = displacement && ((isBullish && close3 > swingHigh) || (!isBullish && close3 < swingLow));
  const mss = choch && bodySize > wickSize * 2; // Stronger ChoCh
  
  const bb = ob && choch; // Breaker Block proxy
  const mb = ob && bos && !choch; // Mitigation Block proxy

  // Rejection Block
  const rb = (high3 >= swingHigh && (high3 - Math.max(open3, close3)) > bodySize * 2) || 
             (low3 <= swingLow && (Math.min(open3, close3) - low3) > bodySize * 2);

  const bsl = Math.abs(high3 - swingHigh) / swingHigh < 0.0015; // Approaching Buy-Side Liquidity
  const ssl = Math.abs(low3 - swingLow) / swingLow < 0.0015;   // Approaching Sell-Side Liquidity
  const liquidity = bsl || ssl;

  let trap: 'Bull Trap' | 'Bear Trap' | 'None' = 'None';
  let trapPrice: number | null = null;
  let trapTime: number | null = null;
  if (low3 < swingLow && close3 > swingLow) {
    trap = 'Bear Trap'; // Trap down: swept lows but closed above
    trapPrice = swingLow;
    trapTime = c3[0];
  } else if (high3 > swingHigh && close3 < swingHigh) {
    trap = 'Bull Trap'; // Trap up: swept highs but closed below
    trapPrice = swingHigh;
    trapTime = c3[0];
  }

  let trigger = null, sl = null, tp1 = null, tp2 = null, tp3 = null, r = null;

  let pattern = 'None';
  if (bodySize > wickSize * 0.8) pattern = isBullish ? 'Bull Marubozu' : 'Bear Marubozu';
  else if (Math.abs(close3 - open3) < wickSize * 0.1) pattern = 'Doji';
  else if (isBullish && (open3 - low3) > bodySize * 2) pattern = 'Hammer / Pin Bar';
  else if (!isBullish && (high3 - open3) > bodySize * 2) pattern = 'Shooting Star';
  else pattern = isBullish ? 'Bullish Base' : 'Bearish Base';

  // Calculate entry parameters if a setup exists
  const isLongSetup = fvgBullish || (isBullish && ob) || bb || trap === 'Bear Trap' || rb;
  const isShortSetup = fvgBearish || (!isBullish && ob) || bb || trap === 'Bull Trap' || rb;

  if (isLongSetup || isShortSetup) {
    if (isLongSetup) {
      trigger = Math.max(parseFloat(c2[2]), parseFloat(c3[2])); // Highest recent high for breakout entry
      sl = Math.min(parseFloat(c2[3]), parseFloat(c3[3]), swingLow); // Safe stop loss below recent structure or trap
      const risk = trigger - sl;
      if (risk > 0) {
        tp1 = trigger + risk;
        tp2 = trigger + risk * 2;
        tp3 = trigger + risk * 3;
        r = 3;
      }
    } else {
      trigger = Math.min(parseFloat(c2[3]), parseFloat(c3[3])); // Lowest recent low for breakdown entry
      sl = Math.max(parseFloat(c2[2]), parseFloat(c3[2]), swingHigh); // Safe stop loss above recent structure or trap
      const risk = sl - trigger;
      if (risk > 0) {
        tp1 = trigger - risk;
        tp2 = trigger - risk * 2;
        tp3 = trigger - risk * 3;
        r = 3;
      }
    }
  }

  // --- NEXUS DASHBOARD CALCULATIONS ---
  const structureTrendNum = isBullish ? 1 : -1;
  const volumes = klines.slice(-20).map(k => parseFloat(k[5]));
  const avgVol = volumes.reduce((a,b) => a+b, 0) / (volumes.length || 1);
  const currentVol = parseFloat(c3[5]);
  const volAboveAvg = currentVol > avgVol;
  const relVolNum = avgVol > 0 ? currentVol / avgVol : 1;
  
  let nexusRelVol = 'DRY';
  if (relVolNum > 2.7) nexusRelVol = 'SPIKE';
  else if (relVolNum > 1.8) nexusRelVol = 'HIGH';
  else if (relVolNum > 1.0) nexusRelVol = 'NORMAL';

  const bullAbsorption = wickSize > 0 && (open3 - low3) > bodySize * 2 && volAboveAvg;
  const bearAbsorption = wickSize > 0 && (high3 - open3) > bodySize * 2 && volAboveAvg;

  const emaTrendBull = currentEma9 > currentEma21 && currentEma21 > currentSma50;
  const emaTrendBear = currentEma9 < currentEma21 && currentEma21 < currentSma50;

  let bullScore = 0;
  if (structureTrendNum === 1) bullScore++;
  if (ob && isBullish) bullScore++;
  if (fvgBullish) bullScore++;
  if (trap === 'Bear Trap' || ssl) bullScore++;
  if (volAboveAvg && isBullish) bullScore++;
  if (bullAbsorption) bullScore++;
  if (pattern.includes('Bull') || pattern.includes('Hammer')) bullScore++; // Proxy for Delta Bull Div
  if (emaTrendBull || (close3 > currentSma200 && currentEma9 > currentEma21)) bullScore++;
  if (bb || rb || openingGap) bullScore++; // Extra Setups Proxy

  let bearScore = 0;
  if (structureTrendNum === -1) bearScore++;
  if (ob && !isBullish) bearScore++;
  if (fvgBearish) bearScore++;
  if (trap === 'Bull Trap' || bsl) bearScore++;
  if (volAboveAvg && !isBullish) bearScore++;
  if (bearAbsorption) bearScore++;
  if (pattern.includes('Bear') || pattern.includes('Shooting')) bearScore++; // Proxy for Delta Bear Div
  if (emaTrendBear || (close3 < currentSma200 && currentEma9 < currentEma21)) bearScore++;
  if (bb || rb || openingGap) bearScore++; // Extra Setups Proxy

  let nexusVerdict = "✕  NO CLEAR EDGE";
  let nexusVerdictColor = "text-slate-400";
  if (bullScore >= 5 && structureTrendNum === 1 && emaTrendBull) {
    nexusVerdict = "✓  HIGH CONFIDENCE LONG";
    nexusVerdictColor = "text-[#c8e624]";
  } else if (bearScore >= 5 && structureTrendNum === -1 && emaTrendBear) {
    nexusVerdict = "✓  HIGH CONFIDENCE SHORT";
    nexusVerdictColor = "text-[#ff1744]";
  } else if (bullScore >= 3 && structureTrendNum === 1) {
    nexusVerdict = "△  LEAN LONG — CAUTION";
    nexusVerdictColor = "text-[#9ab81c]";
  } else if (bearScore >= 3 && structureTrendNum === -1) {
    nexusVerdict = "▽  LEAN SHORT — CAUTION";
    nexusVerdictColor = "text-[#d50032]";
  } else if (bullScore >= 3 && bearScore >= 3) {
    nexusVerdict = "✕  MIXED — STAND ASIDE";
    nexusVerdictColor = "text-slate-400";
  }

  const nexusEmaTrend = emaTrendBull ? "▲ BULL ALIGNED" : emaTrendBear ? "▼ BEAR ALIGNED" : "— MIXED";
  
  const cloudFast = (Math.max(...klines.slice(-9).map(k => parseFloat(k[2]))) + Math.min(...klines.slice(-9).map(k => parseFloat(k[3])))) / 2;
  const cloudSlow = (Math.max(...klines.slice(-26).map(k => parseFloat(k[2]))) + Math.min(...klines.slice(-26).map(k => parseFloat(k[3])))) / 2;
  const nexusCloud = cloudFast > cloudSlow ? "▲ BULLISH" : cloudFast < cloudSlow ? "▼ BEARISH" : "— FLAT";

  const nexusDelta = isBullish ? "▲ BUYING" : "▼ SELLING";
  const nexusDeltaColor = isBullish ? "text-[#c8e624]" : "text-[#ff1744]";

  let activeZones = '';
  if (ob) activeZones += isBullish ? "IN OB▲ " : "IN OB▼ ";
  if (fvg) activeZones += isBullish ? "IN FVG▲ " : "IN FVG▼ ";
  const nexusActiveZones = activeZones.trim() || 'NONE';

  let nexusSetup = '— NONE YET';
  if (isLongSetup && trigger) nexusSetup = '▲ BUY / LONG';
  else if (isShortSetup && trigger) nexusSetup = '▼ SELL / SHORT';

  return {
    trend,
    fvg,
    ob,
    bb,
    mb,
    rb,
    vi,
    openingGap,
    bos,
    choch,
    mss,
    bsl,
    ssl,
    liquidityVoid,
    liquidity,
    displacement,
    trap,
    trapPrice,
    trapTime,
    trigger,
    sl,
    tp1,
    tp2,
    tp3,
    r: r ? parseFloat(r.toFixed(2)) : null,
    pattern,
    scalpingSignal,
    swingSignal,
    nexusBullScore: bullScore,
    nexusBearScore: bearScore,
    nexusVerdict,
    nexusVerdictColor,
    nexusEmaTrend,
    nexusCloud,
    nexusRelVol,
    nexusRelVolNum: relVolNum,
    nexusDelta,
    nexusDeltaColor,
    nexusActiveZones,
    nexusSetup
  };
}
