import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiKeyManager } from './components/ApiKeyManager';
import { LightweightChart } from './components/LightweightChart';
import { SymbolSelector } from './components/SymbolSelector';
import { 
  PairData, 
  fetchAllPairs, 
  fetchHistoricalKlines, 
  toBybitSymbol, 
  categoryToMarket 
} from './lib/bybit';
import { calculateEMA, calculateSMA, calculateRSI } from './lib/indicators';
import { analyzeSMC, SMCResult } from './lib/smc';
import { Activity, Clock, Layers, TrendingUp } from 'lucide-react';
import { JctDashboard } from './components/NexusDashboard';

export default function App() {
  const [pairs, setPairs] = useState<PairData[]>([]);
  const [symbol, setSymbol] = useState<string>('btc_usdt');
  const [timeframe, setTimeframe] = useState<string>('minute15');
  const [category, setCategory] = useState<'Spot' | 'Futures' | 'New'>('Spot');
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [ema9, setEma9] = useState<any[]>([]);
  const [ema21, setEma21] = useState<any[]>([]);
  const [sma50, setSma50] = useState<any[]>([]);
  const [sma200, setSma200] = useState<any[]>([]);
  const [rsi9, setRsi9] = useState<any[]>([]);
  
  const [currentTick, setCurrentTick] = useState<{ price: number; time: number } | null>(null);
  const [smcData, setSmcData] = useState<SMCResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const market = categoryToMarket(category);

  // Fetch Pairs on Mount
  useEffect(() => {
    fetchAllPairs().then(data => {
      if (data && data.length > 0) {
        setPairs(data);
      }
    });
  }, []);

  // Fetch Historical Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    const klines = await fetchHistoricalKlines(symbol, timeframe, 200, market);
    
    if (klines && klines.length > 0) {
      const formattedData = klines.map((k: string[]) => ({
        time: parseInt(k[0], 10),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
      }));
      
      setChartData(formattedData);

      const closes = formattedData.map(d => d.close);
      const e9 = calculateEMA(closes, 9).map((v, i) => ({ time: formattedData[i].time, value: v })).filter(d => !Number.isNaN(d.value));
      const e21 = calculateEMA(closes, 21).map((v, i) => ({ time: formattedData[i].time, value: v })).filter(d => !Number.isNaN(d.value));
      const s50 = calculateSMA(closes, 50).map((v, i) => ({ time: formattedData[i].time, value: v })).filter(d => !Number.isNaN(d.value));
      const s200 = calculateSMA(closes, 200).map((v, i) => ({ time: formattedData[i].time, value: v })).filter(d => !Number.isNaN(d.value));
      const r9 = calculateRSI(closes, 9).map((v, i) => ({ time: formattedData[i].time, value: v })).filter(d => !Number.isNaN(d.value));
      
      setEma9(e9);
      setEma21(e21);
      setSma50(s50);
      setSma200(s200);
      setRsi9(r9);

      const result = analyzeSMC(klines);
      setSmcData(result);
    }
    setIsLoading(false);
  }, [symbol, timeframe, market]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep-Alive for Render backend
  useEffect(() => {
    const keepAliveInterval = setInterval(() => {
      fetch('/api/health').catch(() => {});
    }, 55000);
    return () => clearInterval(keepAliveInterval);
  }, []);

  // WebSocket for Live Updates
  useEffect(() => {
    const wsUrl = market === 'linear' 
      ? 'wss://stream.bybit.com/v5/public/linear' 
      : 'wss://stream.bybit.com/v5/public/spot';
      
    const ws = new WebSocket(wsUrl);
    const bybitSymbol = toBybitSymbol(symbol);
    let pingInterval: NodeJS.Timeout;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: [`publicTrade.${bybitSymbol}`]
      }));

      // Bybit heartbeat required every 20 seconds
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: 'ping' }));
        }
      }, 20000);
    };

    let lastUpdate = 0;
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.topic === `publicTrade.${bybitSymbol}` && data.data) {
        const latestTrade = data.data[0];
        if (latestTrade) {
          const now = Date.now();
          // Throttle updates to max 2 times per second to prevent React render flooding
          if (now - lastUpdate > 500) {
            const price = parseFloat(latestTrade.p);
            const time = Math.floor(Number(latestTrade.T) / 1000);
            setCurrentTick({ price, time });
            lastUpdate = now;
          }
        }
      }
    };

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [symbol, market]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 mr-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-rose-500 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white leading-tight">jcbybit</h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">App</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <select
              value={category}
              onChange={(e) => {
                const newCat = e.target.value as any;
                setCategory(newCat);
                const firstPair = pairs.find(p => p.category === newCat || (newCat === 'Spot' && p.category === 'New'))?.symbol;
                if (firstPair) setSymbol(firstPair);
              }}
              className="bg-transparent text-sm font-semibold text-white focus:outline-none pl-2 py-1 cursor-pointer [&>option]:bg-slate-900 [&>option]:text-slate-200"
            >
              <option value="Spot">Spot</option>
              <option value="Futures">Futures</option>
            </select>
            <div className="w-px h-4 bg-slate-800"></div>
            <SymbolSelector
              pairs={pairs}
              category={category}
              value={symbol}
              onChange={setSymbol}
            />
            {currentTick && (
              <div className="flex items-center gap-2 ml-2 px-3 py-1 bg-slate-900 rounded-md border border-slate-700 shadow-inner">
                <span className="text-[10px] text-slate-400 font-mono">PRICE</span>
                <span className="font-mono font-bold text-emerald-400">{currentTick.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <Clock className="w-4 h-4 text-slate-500 ml-2" />
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-transparent text-sm font-semibold text-white focus:outline-none px-2 py-1 cursor-pointer [&>option]:bg-slate-900 [&>option]:text-slate-200"
            >
              <option value="minute1">1m</option>
              <option value="minute5">5m</option>
              <option value="minute15">15m</option>
              <option value="minute30">30m</option>
              <option value="hour1">1H</option>
              <option value="hour4">4H</option>
              <option value="day1">1D</option>
              <option value="week1">1W</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            LIVE
          </div>
          <ApiKeyManager />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden bg-[#0a0a0a]">
        <div className="flex-1 relative border-r border-[#555555]/30">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-4">
              <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="text-sm font-mono text-slate-500 animate-pulse">SYNCING ORDER FLOW...</div>
            </div>
          ) : (
            <LightweightChart 
              data={chartData}
              ema9={ema9}
              ema21={ema21}
              sma50={sma50}
              sma200={sma200}
              rsi9={rsi9}
              currentTick={currentTick}
              timeframe={timeframe}
              smcData={smcData}
            />
          )}
        </div>
        <div className="w-80 shrink-0 overflow-y-auto bg-[#0a0a0a]">
          <JctDashboard smcData={smcData} />
        </div>
      </main>
      
      {/* Footer Status Bar */}
      <footer className="h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-4 text-[10px] font-mono text-slate-500 shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><Layers className="w-3 h-3" /> Bybit API v5</span>
          <span className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> Smart Money Concepts</span>
        </div>
        <div className="flex items-center gap-4">
          <span>JCBYBIT ENGINE</span>
          <span className="text-emerald-500 font-bold">CONNECTED</span>
        </div>
      </footer>
    </div>
  );
}
