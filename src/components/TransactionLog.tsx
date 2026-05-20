/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Sliders, 
  User, 
  Search,
  BookOpen,
  Calendar,
  Layers,
  Trash2
} from 'lucide-react';
import { StockTransaction, RawMaterial, Warehouse } from '../types';

interface TransactionLogProps {
  transactions: StockTransaction[];
  materials: RawMaterial[];
  warehouses: Warehouse[];
  onClearTransactions?: () => void;
}

export default function TransactionLog({
  transactions,
  materials,
  warehouses,
  onClearTransactions
}: TransactionLogProps) {
  const [filterType, setFilterType] = useState<'ALL' | 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Map transaction helper details
  const mappedTransactions = useMemo(() => {
    return transactions.map(tx => {
      const material = materials.find(m => m.id === tx.materialId);
      const warehouse = warehouses.find(w => w.id === tx.warehouseId);
      return {
        ...tx,
        materialName: material?.name || 'Unknown',
        warehouseName: warehouse?.name || 'Unknown',
        packagingWeightKg: material?.packagingWeightKg || 0
      };
    });
  }, [transactions, materials, warehouses]);

  // Combined search and type filters
  const filteredTransactions = useMemo(() => {
    return mappedTransactions.filter(tx => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false;
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return (
          tx.materialName.toLowerCase().includes(query) ||
          tx.warehouseName.toLowerCase().includes(query) ||
          (tx.notes && tx.notes.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [mappedTransactions, filterType, searchQuery]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      
      {/* Log Header */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
              <History className="h-4.5 w-4.5 text-blue-900" />
              Silsilah Log Transaksi & Audit Trail (EIS Ledger)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Catatan mutasi masuk, keluar, dan penyesuaian stok berkala
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Clear ledger triggers default state */}
            {onClearTransactions && transactions.length > 0 && (
              <button
                id="clear-logs-btn"
                onClick={onClearTransactions}
                className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-700 border border-red-200/50 hover:border-red-200 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-all"
                title="Reset seluruh log modifikasi ke setelan awal"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset Ledger</span>
              </button>
            )}

            {/* In-Log Simple Search */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                <Search className="h-3.5 w-3.5 text-slate-400" />
              </span>
              <input
                id="ledger-search-input"
                type="text"
                placeholder="Cari log..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-[11px] w-40 sm:w-48 focus:outline-hidden focus:ring-1 focus:ring-blue-600 transition-colors"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        {/* Ledger Type Filtering Pills */}
        <div className="flex gap-2 mt-4 text-[11px] overflow-auto">
          {(['ALL', 'INBOUND', 'OUTBOUND', 'ADJUSTMENT'] as const).map(type => (
            <button
              key={type}
              id={`ledger-filter-${type}`}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-md font-medium capitalize transition-all cursor-pointer ${
                filterType === type
                  ? 'bg-blue-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type === 'ALL' ? 'Semua Log' : type === 'INBOUND' ? 'Masuk (Inbound)' : type === 'OUTBOUND' ? 'Keluar (Outbound)' : 'Koreksi'}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List content */}
      <div className="p-0">
        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="inline-flex justify-center items-center h-10 w-10 rounded-full bg-slate-50 text-slate-400 mb-2">
              <BookOpen className="h-5 w-5" />
            </div>
            <p className="text-xs text-slate-500 font-medium">Belum ada riwayat transaksi yang cocok.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            <AnimatePresence initial={false}>
              {filteredTransactions.map((tx, idx) => {
                const isPositive = tx.quantityDrumsChanged > 0;
                const changeFormatted = isPositive ? `+${tx.quantityDrumsChanged}` : `${tx.quantityDrumsChanged}`;
                const calculatedKg = tx.quantityDrumsChanged * tx.packagingWeightKg;
                const weightFormatted = isPositive ? `+${calculatedKg.toLocaleString('id-ID')}` : `${calculatedKg.toLocaleString('id-ID')}`;

                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.02 }}
                    className="p-4 flex items-start gap-4 hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Visual indicators of direction */}
                    <div className="shrink-0 mt-0.5">
                      {tx.type === 'INBOUND' ? (
                        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                          <ArrowDownToLine className="h-4 w-4" />
                        </div>
                      ) : tx.type === 'OUTBOUND' ? (
                        <div className="p-2 bg-red-50 text-red-700 rounded-full border border-red-100">
                          <ArrowUpFromLine className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="p-2 bg-amber-50 text-amber-700 rounded-full border border-amber-100">
                          <Sliders className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    {/* Transaction Ledger text core */}
                    <div className="flex-1 min-w-0 text-xs text-slate-600">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        {/* Title of mutated item */}
                        <div className="font-semibold text-slate-800 text-sm">
                          {tx.materialName} <span className="font-medium text-slate-400">@ {tx.warehouseName}</span>
                        </div>
                        {/* Timestamp helper */}
                        <div className="text-slate-400 flex items-center gap-1 font-mono text-[10px]">
                          <Calendar className="h-3 w-3" />
                          {new Date(tx.timestamp).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>

                      {/* Modification Delta and resulting quantity */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`px-2 py-0.5 rounded-sm font-bold font-mono text-[11px] ${
                          tx.type === 'INBOUND' ? 'bg-emerald-50 text-emerald-800 border border-emerald-150' :
                          tx.type === 'OUTBOUND' ? 'bg-red-50 text-red-800 border border-red-150' : 
                          'bg-amber-50 text-amber-850 border border-amber-150'
                        }`}>
                          {tx.type === 'INBOUND' ? 'MASUK' : tx.type === 'OUTBOUND' ? 'KELUAR' : 'KOREKSI'} {changeFormatted} DRUM ({weightFormatted} Kg)
                        </span>

                        <span className="text-slate-300">|</span>

                        <span className="text-slate-500 flex items-center gap-1 font-medium font-mono">
                          <Layers className="h-3.5 w-3.5 text-slate-300" />
                          Sisa: {tx.resultingQuantity} Drum ({ (tx.resultingQuantity * tx.packagingWeightKg).toLocaleString('id-ID') } Kg)
                        </span>
                      </div>

                      {/* Supervisor transaction description */}
                      {tx.notes && (
                        <div className="mt-2 text-slate-700 italic bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] break-words">
                          &ldquo;{tx.notes}&rdquo;
                        </div>
                      )}

                      {/* Logged user audit info */}
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <User className="h-3 w-3" />
                        <span>Oleh: {tx.operatorEmail}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
}
