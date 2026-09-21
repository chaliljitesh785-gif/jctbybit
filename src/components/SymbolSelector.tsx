import React from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { PairData } from '../lib/bybit';

interface SymbolSelectorProps {
  pairs: PairData[];
  category: 'Spot' | 'Futures' | 'New';
  value: string;
  onChange: (value: string, category?: 'Spot' | 'Futures') => void;
  onOpenSearch?: () => void;
}

export function SymbolSelector({
  value,
  onOpenSearch,
}: SymbolSelectorProps) {
  const displayValue = value ? value.toUpperCase().replace('_', '/') : 'SELECT SYMBOL';

  return (
    <div className="relative">
      <button 
        type="button"
        id="symbol-selector-button"
        className="flex items-center gap-2 cursor-pointer bg-slate-900 hover:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-800 hover:border-slate-700 text-sm font-bold text-white transition-all focus:outline-none"
        onClick={() => onOpenSearch?.()}
        title="Open Bybit Market Search (⌘K)"
      >
        <Search className="w-3.5 h-3.5 text-blue-400" />
        <span className="font-mono tracking-tight">{displayValue}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
    </div>
  );
}
