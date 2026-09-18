import React from 'react';
import { SMCResult } from '../lib/smc';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface JctmgProps {
  smcData?: SMCResult;
}

export function JctDashboard({ smcData }: JctmgProps) {
  if (!smcData) return null;

  return (
    <div className="w-full bg-[#0a0a0a] font-mono text-[10px] sm:text-[11px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#555555]/70 bg-[#0a0a0a]">
        <div className="text-[#c8e624] font-bold tracking-wider text-sm">jcbybit app</div>
        <div className="text-[#888888] mt-0.5 tracking-tight uppercase text-[9px] sm:text-[10px]">SMC × ORDER FLOW × TRADE LEVELS × PRO SUITE</div>
      </div>

        {/* Table Header */}
        <div className="grid grid-cols-3 bg-[#555555]/20 border-b border-[#555555]/70 px-3 py-1.5 font-bold">
          <div className="text-[#888888]">METRIC</div>
          <div className="text-[#888888]">STATE</div>
          <div className="text-[#888888]">DETAIL</div>
        </div>

        {/* Table Body */}
        <div className="flex flex-col">
          {/* Structure */}
          <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
            <div className="text-[#cccccc]">STRUCTURE</div>
            <div className={cn("font-bold", smcData.trend === 'Bullish' ? "text-[#c8e624]" : smcData.trend === 'Bearish' ? "text-[#ff1744]" : "text-[#888888]")}>
              {smcData.trend === 'Bullish' ? "▲ BULLISH" : smcData.trend === 'Bearish' ? "▼ BEARISH" : "— RANGING"}
            </div>
            <div className="text-[#888888]">
              {(smcData.bos ? "BOS " : "") + (smcData.choch ? "CHoCH" : "") || "-"}
            </div>
          </div>

          {/* EMA Trend */}
          <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
            <div className="text-[#cccccc]">EMA TREND</div>
            <div className={cn("font-bold", smcData.nexusEmaTrend.includes('BULL') ? "text-[#c8e624]" : smcData.nexusEmaTrend.includes('BEAR') ? "text-[#ff1744]" : "text-[#888888]")}>
              {smcData.nexusEmaTrend}
            </div>
            <div className="text-[#888888]">-</div>
          </div>

          {/* Cloud */}
          <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
            <div className="text-[#cccccc]">CLOUD</div>
            <div className={cn("font-bold", smcData.nexusCloud.includes('BULL') ? "text-[#c8e624]" : smcData.nexusCloud.includes('BEAR') ? "text-[#ff1744]" : "text-[#888888]")}>
              {smcData.nexusCloud}
            </div>
            <div className="text-[#888888]">-</div>
          </div>

          {/* Divider */}
          <div className="px-3 py-1 border-b border-[#555555]/30 text-[#555555] tracking-widest text-[8px] text-center">
            ───────────────────────────
          </div>

          {/* Rel Volume */}
          <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
            <div className="text-[#cccccc]">REL VOLUME</div>
            <div className={cn("font-bold", smcData.nexusRelVol === 'SPIKE' ? "text-[#d4f03a]" : smcData.nexusRelVol === 'HIGH' ? "text-[#9ab81c]" : "text-[#888888]")}>
              {smcData.nexusRelVol}
            </div>
            <div className={cn("font-bold", smcData.nexusRelVol === 'SPIKE' ? "text-[#d4f03a]" : smcData.nexusRelVol === 'HIGH' ? "text-[#9ab81c]" : "text-[#888888]")}>
              {smcData.nexusRelVolNum.toFixed(2)}x
            </div>
          </div>

          {/* Delta Flow */}
          <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
            <div className="text-[#cccccc]">DELTA FLOW</div>
            <div className={cn("font-bold", smcData.nexusDeltaColor)}>{smcData.nexusDelta}</div>
            <div className={cn("font-bold", smcData.nexusDeltaColor)}>
              {smcData.nexusDelta.includes('BUY') ? 'ACCUM' : 'DISTR'}
            </div>
          </div>

          {/* Active Zones */}
          <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
            <div className="text-[#cccccc]">ACTIVE ZONES</div>
            <div className="text-[#888888] flex gap-1 items-center">
               OB: {smcData.ob ? 1 : 0} • FVG: {smcData.fvg ? 1 : 0}
            </div>
            <div className={cn("font-bold", smcData.nexusActiveZones.includes('▲') ? "text-[#c8e624]" : smcData.nexusActiveZones.includes('▼') ? "text-[#ff1744]" : "text-[#888888]")}>
              {smcData.nexusActiveZones}
            </div>
          </div>

          {/* Divider */}
          <div className="px-3 py-1 border-b border-[#555555]/30 text-[#555555] tracking-widest text-[8px] text-center">
            ───────────────────────────
          </div>

          {/* Scores */}
          <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
            <div className="text-[#cccccc]">BULL SCORE</div>
            <div className={cn("font-bold", smcData.nexusBullScore >= 3 ? "text-[#c8e624]" : "text-[#888888]")}>
              {smcData.nexusBullScore} / 9 • {Math.min(100, smcData.nexusBullScore * 11)}%
            </div>
            <div className={cn("font-bold", smcData.nexusBullScore >= 7 ? "text-[#c8e624]" : smcData.nexusBullScore >= 4 ? "text-[#9ab81c]" : "text-[#888888]")}>
              {smcData.nexusBullScore >= 7 ? 'A' : smcData.nexusBullScore >= 4 ? 'B' : 'C'}
            </div>
          </div>

          <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
            <div className="text-[#cccccc]">BEAR SCORE</div>
            <div className={cn("font-bold", smcData.nexusBearScore >= 3 ? "text-[#ff1744]" : "text-[#888888]")}>
              {smcData.nexusBearScore} / 9 • {Math.min(100, smcData.nexusBearScore * 11)}%
            </div>
            <div className={cn("font-bold", smcData.nexusBearScore >= 7 ? "text-[#ff1744]" : smcData.nexusBearScore >= 4 ? "text-[#d50032]" : "text-[#888888]")}>
              {smcData.nexusBearScore >= 7 ? 'A' : smcData.nexusBearScore >= 4 ? 'B' : 'C'}
            </div>
          </div>

          {/* Verdict */}
          <div className="grid grid-cols-[1fr_2fr] px-3 py-2 border-b border-[#555555]/30">
            <div className="text-[#cccccc]">VERDICT</div>
            <div className={cn("font-bold", smcData.nexusVerdictColor)}>
              {smcData.nexusVerdict}
            </div>
          </div>

          {/* Divider */}
          <div className="px-3 py-1 border-b border-[#555555]/30 text-[#555555] tracking-widest text-[8px] text-center">
            ───────────────────────────
          </div>

          {/* Trade Setup */}
          <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
            <div className="text-[#cccccc]">LAST SETUP</div>
            <div className={cn("font-bold", smcData.nexusSetup.includes('LONG') ? "text-[#c8e624]" : smcData.nexusSetup.includes('SHORT') ? "text-[#ff1744]" : "text-[#888888]")}>
              {smcData.nexusSetup}
            </div>
            <div className="text-[#888888] font-bold">
              {smcData.trigger ? '● ACTIVE' : ''}
            </div>
          </div>

          {smcData.trigger && (
            <>
              <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
                <div className="text-[#cccccc]">ENTRY</div>
                <div className="text-white font-bold">{smcData.trigger.toFixed(6)}</div>
                <div></div>
              </div>
              <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
                <div className="text-[#cccccc]">STOP LOSS</div>
                <div className="text-[#ff1744] font-bold">{smcData.sl?.toFixed(6)}</div>
                <div></div>
              </div>
              <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
                <div className="text-[#cccccc]">TAKE PROFIT 1</div>
                <div className="text-[#c8e624] font-bold">{smcData.tp1?.toFixed(6)}</div>
                <div className="text-[#888888]">1:1.0</div>
              </div>
              <div className="grid grid-cols-3 px-3 py-1.5 border-b border-[#555555]/30">
                <div className="text-[#cccccc]">TAKE PROFIT 2</div>
                <div className="text-[#d4f03a] font-bold">{smcData.tp2?.toFixed(6)}</div>
                <div className="text-[#888888]">1:2.0</div>
              </div>
            </>
          )}

          {/* Extra Setups */}
          <div className="grid grid-cols-3 px-3 py-2 bg-[#1a1a1a]">
            <div className="text-[#cccccc]">EXTRA SETUPS</div>
            <div className={cn("font-bold", (smcData.bb || smcData.openingGap || smcData.rb) ? (smcData.trend === 'Bullish' ? "text-[#c8e624]" : "text-[#ff1744]") : "text-[#888888]")}>
              {(smcData.bb || smcData.openingGap || smcData.rb) ? (smcData.trend === 'Bullish' ? "▲ CONFIRM" : "▼ CONFIRM") : "— none"}
            </div>
            <div className="text-[#888888]">
              {(smcData.bb ? 'BB ' : '') + (smcData.rb ? 'RB ' : '') + (smcData.openingGap ? 'GAP' : '')}
            </div>
          </div>
        </div>
    </div>
  );
}
