import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { PairData } from '../lib/bybit';

interface SymbolSelectorProps {
  pairs: PairData[];
  category: 'Spot' | 'Futures' | 'New';
  value: string;
  onChange: (value: string) => void;
}

export function SymbolSelector({ pairs, category, value, onChange }: SymbolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPairs = pairs
    .filter(p => p.category === category || (category === 'Spot' && p.category === 'New'))
    .filter(p => p.symbol.toLowerCase().includes(search.toLowerCase()) || search === '');

  const displayValue = value ? value.toUpperCase().replace('_', '/') : 'SELECT SYMBOL';

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        className="flex items-center gap-1 cursor-pointer bg-transparent text-sm font-bold text-white focus:outline-none pr-2 py-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        {displayValue}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-800 flex items-center gap-2 bg-slate-950/50">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-transparent border-none outline-none text-sm text-slate-200 w-full placeholder:text-slate-600"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredPairs.length > 0 ? (
              filteredPairs.map((p) => (
                <div
                  key={p.symbol}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-800 transition-colors ${value === p.symbol ? 'bg-indigo-500/20 text-indigo-400 font-bold' : 'text-slate-300'}`}
                  onClick={() => {
                    onChange(p.symbol);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  {p.symbol.toUpperCase().replace('_', '/')}
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-sm text-slate-500 text-center">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
