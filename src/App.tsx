import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiKeyManager } from './components/ApiKeyManager';
import { LightweightChart } from './components/LightweightChart';
import { SymbolSelector } from './components/SymbolSelector';
import { 
  PairData, 
  fetchAllPairs, 
  fetchHistoricalKlines, 
  toBybitSymbol, 
  categoryToMarket,
  toBybitInterval
} from './lib/bybit';
import { calculateEMA, calculateSMA, calculateRSI } from './lib/indicators';
import { analyzeSMC, SMCResult } from './lib/smc';
import { Activity, Clock, Layers, TrendingUp, Search } from 'lucide-react';
import { JctDashboard } from './components/NexusDashboard';
import BybitSearchInterface from './components/BybitSearchInterface';

export default function App() {
  const [pairs, setPairs] = useState<PairData[]>([]);
  const [symbol, setSymbol] = useState<string>('btc_usdt');
  const [timeframe, setTimeframe] = useState<string>('minute15');
  const [category, setCategory] = useState<'Spot' | 'Futures' | 'New'>('Spot');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [ema9, setEma9] = useState<any[]>([]);
  const [ema21, setEma21] = useState<any[]>([]);
  const [sma50, setSma50] = useState<any[]>([]);
  const [sma200, setSma200] = useState<any[]>([]);
  const [rsi9, setRsi9] = useState<any[]>([]);
  
  const [currentTick, setCurrentTick] = useState<{ price: number; time: number } | null>(null);
  const [realtimeCandle, setRealtimeCandle] = useState<{ time: number; open: number; high: number; low: number; close: number } | null>(null);
  const [smcData, setSmcData] = useState<SMCResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const market = categoryToMarket(category);

  // Fetch Real Bybit Pairs on Mount & refresh periodically
  useEffect(() => {
    const loadPairs = () => {
      fetchAllPairs().then(data => {
        if (data && data.length > 0) {
          setPairs(data);
        }
      });
    };
    loadPairs();
    const interval = setInterval(loadPairs, 20000);
    return () => clearInterval(interval);
  }, []);

  const activePairInfo = useMemo(() => {
    return pairs.find(p => p.symbol === symbol && (p.category === category || (category === 'Spot' && p.category === 'New')));
  }, [pairs, symbol, category]);

  // Fetch Historical Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setRealtimeCandle(null);
    const bybitSym = toBybitSymbol(symbol);
    const effectiveMarket = (bybitSym === 'XAUUSDT' || bybitSym === 'XAGUSDT') ? 'linear' : market;
    const klines = await fetchHistoricalKlines(symbol, timeframe, 200, effectiveMarket);
    
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

      // Instantly set current tick to latest candle close
      const lastCandle = formattedData[formattedData.length - 1];
      if (lastCandle) {
        setCurrentTick({ price: lastCandle.close, time: lastCandle.time });
      }
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

  // WebSocket for Live Updates & official Bybit real-time kline stream
  useEffect(() => {
    const bybitSymbol = toBybitSymbol(symbol);
    const bybitInterval = toBybitInterval(timeframe);
    const isGoldOrSilver = bybitSymbol === 'XAUUSDT' || bybitSymbol === 'XAGUSDT';
    const effectiveMarket = isGoldOrSilver ? 'linear' : market;
    const isCfd = symbol.includes('eur') || (!symbol.includes('usdt') && symbol.endsWith('usd') && !isGoldOrSilver);

    // If pure CFD/synthetic asset (like EURUSD), simulate live micro-ticks
    if (isCfd) {
      const cfdInterval = setInterval(() => {
        setCurrentTick(prev => {
          if (!prev) return prev;
          const delta = (Math.random() - 0.495) * (prev.price * 0.0002);
          const newPrice = Math.max(0.0001, prev.price + delta);
          return { price: newPrice, time: Math.floor(Date.now() / 1000) };
        });
      }, 1500);
      return () => clearInterval(cfdInterval);
    }

    const wsUrl = effectiveMarket === 'linear' 
      ? 'wss://stream.bybit.com/v5/public/linear' 
      : 'wss://stream.bybit.com/v5/public/spot';
      
    const ws = new WebSocket(wsUrl);
    let pingInterval: NodeJS.Timeout;

    ws.onopen = () => {
      // Subscribe to official real-time klines and live trades
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: [
          `kline.${bybitInterval}.${bybitSymbol}`,
          `publicTrade.${bybitSymbol}`
        ]
      }));

      // Bybit heartbeat required every 20 seconds
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: 'ping' }));
        }
      }, 20000);
    };

    let lastTradeUpdate = 0;
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 1. Official real-time Bybit candlestick stream (only for exact active symbol and interval)
        if (data.topic === `kline.${bybitInterval}.${bybitSymbol}` && Array.isArray(data.data)) {
          const k = data.data[0];
          if (k) {
            const candle = {
              time: Math.floor(Number(k.start) / 1000),
              open: parseFloat(k.open),
              high: parseFloat(k.high),
              low: parseFloat(k.low),
              close: parseFloat(k.close),
            };
            setRealtimeCandle(candle);
            setCurrentTick({ price: candle.close, time: candle.time });
          }
        }

        // 2. Real-time Bybit trade execution stream
        if (data.topic === `publicTrade.${bybitSymbol}` && Array.isArray(data.data)) {
          const latestTrade = data.data[0];
          if (latestTrade) {
            const now = Date.now();
            if (now - lastTradeUpdate > 250) {
              const price = parseFloat(latestTrade.p);
              const time = Math.floor(Number(latestTrade.T) / 1000);
              setCurrentTick({ price, time });
              lastTradeUpdate = now;
            }
          }
        }
      } catch {
        // Silently catch malformed WS payloads
      }
    };

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [symbol, market, timeframe]);

  // Global Keyboard Shortcut: ⌘K or Ctrl+K to toggle Bybit Market Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      } else if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

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
              onOpenSearch={() => setIsSearchOpen(true)}
            />
            <button
              type="button"
              id="bybit-search-trigger"
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/70 hover:border-slate-600 rounded text-xs text-slate-300 transition-all font-sans"
              title="Search Bybit Markets (⌘K / Ctrl+K)"
            >
              <Search className="w-3 h-3 text-blue-400" />
              <span>Search</span>
              <kbd className="text-[9px] bg-slate-950 text-slate-400 border border-slate-800 px-1 py-0.2 rounded font-mono">⌘K</kbd>
            </button>
            {currentTick && (
              <div className="flex items-center gap-3 ml-2 px-3 py-1 bg-slate-900 rounded-md border border-slate-700 shadow-inner">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-[10px] text-slate-400">PRICE</span>
                  <span className="font-bold text-emerald-400 text-xs sm:text-sm">
                    ${currentTick.price < 0.01 
                      ? currentTick.price.toFixed(6) 
                      : currentTick.price < 1 
                      ? currentTick.price.toFixed(4) 
                      : currentTick.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {activePairInfo && typeof activePairInfo.change24h === 'number' && (
                  <div className={`hidden md:flex items-center gap-1 text-[11px] font-mono font-bold ${
                    activePairInfo.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    <span>{activePairInfo.change24h >= 0 ? '▲' : '▼'}</span>
                    <span>{activePairInfo.change24h >= 0 ? '+' : ''}{activePairInfo.change24h.toFixed(2)}%</span>
                  </div>
                )}
                {activePairInfo && activePairInfo.high24h && (
                  <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono text-slate-400 border-l border-slate-800 pl-2">
                    <span>24h H: <strong className="text-slate-200">${activePairInfo.high24h.toLocaleString()}</strong></span>
                    <span>24h L: <strong className="text-slate-200">${activePairInfo.low24h?.toLocaleString()}</strong></span>
                  </div>
                )}
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
              realtimeCandle={realtimeCandle}
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

      {/* Bybit V5 Market Search & Filter Modal */}
      {isSearchOpen && (
        <BybitSearchInterface
          isModal={true}
          pairs={pairs}
          currentSymbol={symbol}
          currentCategory={category}
          onClose={() => setIsSearchOpen(false)}
          onSelectAsset={(newSymbol, newCategory) => {
            setCategory(newCategory);
            setSymbol(newSymbol);
            setIsSearchOpen(false);
          }}
        />
      )}
    </div>
  );
}
