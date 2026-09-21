import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries, LineSeries, SeriesMarker, Time, IPriceLine, createSeriesMarkers } from 'lightweight-charts';
import { analyzeSMC, SMCResult } from '../lib/smc';

import { JctDashboard } from './NexusDashboard';

interface ChartProps {
  data: { time: number; open: number; high: number; low: number; close: number }[];
  ema9?: { time: number; value: number }[];
  ema21?: { time: number; value: number }[];
  sma50?: { time: number; value: number }[];
  sma200?: { time: number; value: number }[];
  rsi9?: { time: number; value: number }[];
  currentTick?: { price: number; time: number } | null;
  realtimeCandle?: { time: number; open: number; high: number; low: number; close: number } | null;
  timeframe?: string;
  smcData?: SMCResult;
}

export function LightweightChart({ data, ema9, ema21, sma50, sma200, rsi9, currentTick, realtimeCandle, timeframe = 'minute15', smcData }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersPluginRef = useRef<any>(null);
  
  const ema9Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const sma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const sma200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi9Ref = useRef<ISeriesApi<"Line"> | null>(null);
  
  const entryLineRef = useRef<IPriceLine | null>(null);
  const slLineRef = useRef<IPriceLine | null>(null);
  const tp1LineRef = useRef<IPriceLine | null>(null);
  const tp2LineRef = useRef<IPriceLine | null>(null);

  const lastCandleRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  const timeframeToSeconds = (tf: string) => {
    if (tf.startsWith('minute')) return parseInt(tf.replace('minute', '')) * 60;
    if (tf.startsWith('hour')) return parseInt(tf.replace('hour', '')) * 3600;
    if (tf.startsWith('day')) return parseInt(tf.replace('day', '')) * 86400;
    return 60;
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8', // slate-400
      },
      grid: {
        vertLines: { color: '#1e293b' }, // slate-800
        horzLines: { color: '#1e293b' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        scaleMargins: {
          top: 0.1,
          bottom: 0.3, // Leave space at bottom for RSI
        }
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', // emerald-500
      downColor: '#f43f5e', // rose-500
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });
    const markersPlugin = createSeriesMarkers(series);

    const lEma9 = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, crosshairMarkerVisible: false }); // blue-500
    const lEma21 = chart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 2, crosshairMarkerVisible: false }); // violet-500
    const lSma50 = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, crosshairMarkerVisible: false }); // amber-500
    const lSma200 = chart.addSeries(LineSeries, { color: '#ec4899', lineWidth: 2, crosshairMarkerVisible: false }); // pink-500
    const lRsi9 = chart.addSeries(LineSeries, { 
      color: '#06b6d4', // cyan-500
      lineWidth: 2, 
      priceScaleId: 'rsi',
      crosshairMarkerVisible: false
    });

    chart.priceScale('rsi').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;
    markersPluginRef.current = markersPlugin;
    
    ema9Ref.current = lEma9;
    ema21Ref.current = lEma21;
    sma50Ref.current = lSma50;
    sma200Ref.current = lSma200;
    rsi9Ref.current = lRsi9;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update Data and Calculate Historical SMC Markers
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const sorted = [...data].sort((a, b) => a.time - b.time);
      const unique = sorted.filter((v, i, a) => i === 0 || v.time !== a[i - 1].time);
      
      seriesRef.current.setData(unique as any);
      lastCandleRef.current = { ...unique[unique.length - 1] };

      // Calculate Historical Markers (BOS, CHoCH, Traps)
      const markers: SeriesMarker<Time>[] = [];
      const klines = unique.map(d => [d.time.toString(), d.open.toString(), d.high.toString(), d.low.toString(), d.close.toString(), "0"]);
      
      // Look back through history to spot SMC events
      for (let i = 25; i < klines.length; i++) {
        const slice = klines.slice(0, i + 1);
        const smc = analyzeSMC(slice);
        const time = unique[i].time as Time;
        const isBull = unique[i].close > unique[i].open;

        if (smc.choch) {
            markers.push({
                time,
                position: isBull ? 'belowBar' : 'aboveBar',
                color: '#f59e0b', // amber-500
                shape: isBull ? 'arrowUp' : 'arrowDown',
                text: 'CHoCH'
            });
        } else if (smc.bos) {
            markers.push({
                time,
                position: isBull ? 'belowBar' : 'aboveBar',
                color: isBull ? '#3b82f6' : '#f43f5e', // blue / rose
                shape: isBull ? 'arrowUp' : 'arrowDown',
                text: 'BOS'
            });
        }
        
        if (smc.trap !== 'None') {
            markers.push({
                time,
                position: smc.trap === 'Bull Trap' ? 'aboveBar' : 'belowBar',
                color: smc.trap === 'Bull Trap' ? '#f43f5e' : '#10b981',
                shape: smc.trap === 'Bull Trap' ? 'arrowDown' : 'arrowUp',
                text: smc.trap === 'Bull Trap' ? 'Bull Trap' : 'Bear Trap'
            });
        }
      }

      // Lightweight charts requires strictly ascending markers, handle duplicates if they land on same time
      const uniqueMarkers = markers.filter((m, i, a) => i === 0 || m.time !== a[i - 1].time);
      if (markersPluginRef.current) {
        markersPluginRef.current.setMarkers(uniqueMarkers);
      }
    }
  }, [data]);

  // Handle live SMC Price Lines
  useEffect(() => {
    if (!seriesRef.current) return;

    if (entryLineRef.current) seriesRef.current.removePriceLine(entryLineRef.current);
    if (slLineRef.current) seriesRef.current.removePriceLine(slLineRef.current);
    if (tp1LineRef.current) seriesRef.current.removePriceLine(tp1LineRef.current);
    if (tp2LineRef.current) seriesRef.current.removePriceLine(tp2LineRef.current);

    entryLineRef.current = null;
    slLineRef.current = null;
    tp1LineRef.current = null;
    tp2LineRef.current = null;

    if (smcData?.trigger) {
      entryLineRef.current = seriesRef.current.createPriceLine({
        price: smcData.trigger,
        color: '#818cf8', // indigo-400
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'ENTRY',
      });
    }
    if (smcData?.sl) {
      slLineRef.current = seriesRef.current.createPriceLine({
        price: smcData.sl,
        color: '#fb7185', // rose-400
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'SL',
      });
    }
    if (smcData?.tp1) {
      tp1LineRef.current = seriesRef.current.createPriceLine({
        price: smcData.tp1,
        color: '#34d399', // emerald-400
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'TP1',
      });
    }
    if (smcData?.tp2) {
      tp2LineRef.current = seriesRef.current.createPriceLine({
        price: smcData.tp2,
        color: '#10b981', // emerald-500
        lineWidth: 2,
        lineStyle: 3,
        axisLabelVisible: true,
        title: 'TP2',
      });
    }
  }, [smcData]);

  useEffect(() => {
    if (ema9Ref.current && ema9) ema9Ref.current.setData(ema9 as any);
    if (ema21Ref.current && ema21) ema21Ref.current.setData(ema21 as any);
    if (sma50Ref.current && sma50) sma50Ref.current.setData(sma50 as any);
    if (sma200Ref.current && sma200) sma200Ref.current.setData(sma200 as any);
    if (rsi9Ref.current && rsi9) rsi9Ref.current.setData(rsi9 as any);
  }, [ema9, ema21, sma50, sma200, rsi9]);

  // Safe helper to update the latest candlestick without breaking Lightweight-Charts time ordering
  const safeUpdateCandle = (candle: { time: number; open: number; high: number; low: number; close: number }) => {
    if (!seriesRef.current || !lastCandleRef.current) return;
    const lastTime = lastCandleRef.current.time;

    // Lightweight charts enforces: candle.time >= lastTime in series
    // If the incoming candle has an older timestamp (e.g. out-of-order packet or previous timeframe), safely ignore it
    if (candle.time < lastTime) {
      return;
    }

    try {
      seriesRef.current.update(candle as any);
      lastCandleRef.current = candle;
    } catch (err) {
      // Gracefully prevent uncaught errors on race conditions
      console.warn('Candle update bypassed:', err);
    }
  };

  // 1. Official Bybit Real-Time Candlestick Updates
  useEffect(() => {
    if (realtimeCandle) {
      safeUpdateCandle(realtimeCandle);
    }
  }, [realtimeCandle]);

  // 2. Intra-Candle Live Price Ticks
  useEffect(() => {
    if (!currentTick || !lastCandleRef.current || !seriesRef.current) return;
    const lc = lastCandleRef.current;

    // If we have an official Bybit realtimeCandle stream, only update the active candle's high/low/close
    // keeping its start time strictly identical to avoid race conditions
    if (realtimeCandle) {
      safeUpdateCandle({
        ...lc,
        high: Math.max(lc.high, currentTick.price),
        low: Math.min(lc.low, currentTick.price),
        close: currentTick.price,
      });
      return;
    }

    // Fallback for simulated/CFD assets that don't have websocket kline stream
    const tfSeconds = timeframeToSeconds(timeframe);
    const currentCandleStartTime = Math.floor(currentTick.time / tfSeconds) * tfSeconds;

    if (currentCandleStartTime > lc.time) {
      // Roll over to new candle
      safeUpdateCandle({
        time: currentCandleStartTime,
        open: lc.close,
        high: Math.max(lc.close, currentTick.price),
        low: Math.min(lc.close, currentTick.price),
        close: currentTick.price,
      });
    } else {
      // Update existing candle
      safeUpdateCandle({
        ...lc,
        high: Math.max(lc.high, currentTick.price),
        low: Math.min(lc.low, currentTick.price),
        close: currentTick.price,
      });
    }
  }, [currentTick, timeframe, realtimeCandle]);

  return (
    <div className="relative w-full h-full">
      {/* Legend Overlay */}
      <div className="absolute top-3 left-4 z-10 flex gap-4 text-xs font-mono font-bold pointer-events-none bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/50 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-blue-500 rounded-full"></div>
          <span className="text-slate-300">EMA 9</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-violet-500 rounded-full"></div>
          <span className="text-slate-300">EMA 21</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-amber-500 rounded-full"></div>
          <span className="text-slate-300">SMA 50</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-pink-500 rounded-full"></div>
          <span className="text-slate-300">SMA 200</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-cyan-500 rounded-full"></div>
          <span className="text-slate-300">RSI 9</span>
        </div>
      </div>
      
      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full h-full absolute inset-0" />
    </div>
  );
}
