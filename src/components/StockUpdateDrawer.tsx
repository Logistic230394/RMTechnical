/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Sliders, 
  Save, 
  AlertCircle,
  Clock,
  User,
  Package
} from 'lucide-react';
import { RawMaterial, Warehouse, StockItem } from '../types';
import { getStockStatus } from '../initialData';

interface StockUpdateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  stockItem: StockItem | null;
  materials: RawMaterial[];
  warehouses: Warehouse[];
  onSaveStockUpdate: (
    materialId: string, 
    warehouseId: string, 
    type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT', 
    qtyChange: number, 
    notes: string
  ) => void;
}

export default function StockUpdateDrawer({
  isOpen,
  onClose,
  stockItem,
  materials,
  warehouses,
  onSaveStockUpdate
}: StockUpdateDrawerProps) {
  const [txType, setTxType] = useState<'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT'>('INBOUND');
  const [drumChangeInput, setDrumChangeInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');

  // Find associated details
  const material = stockItem ? materials.find(m => m.id === stockItem.materialId) : null;
  const warehouse = stockItem ? warehouses.find(w => w.id === stockItem.warehouseId) : null;

  // Reset inputs when selected stock item changes
  useEffect(() => {
    setTxType('INBOUND');
    setDrumChangeInput('');
    setNotes('');
    setErrorText('');
  }, [stockItem]);

  if (!isOpen || !stockItem || !material || !warehouse) return null;

  // Live Math calculations
  const originalQty = stockItem.quantityDrums;
  const packWeight = material.packagingWeightKg;
  const originalWeightKg = originalQty * packWeight;

  const changeQtyNumeric = parseInt(drumChangeInput) || 0;
  
  let finalQty = originalQty;
  if (txType === 'INBOUND') {
    finalQty = originalQty + changeQtyNumeric;
  } else if (txType === 'OUTBOUND') {
    finalQty = originalQty - changeQtyNumeric;
  } else {
    // ADJUSTMENT represents setting absolute replacement quantity
    finalQty = changeQtyNumeric;
  }

  const finalWeightKg = finalQty * packWeight;

  // Get status previews
  const originalStatus = getStockStatus(originalQty);
  const finalStatus = getStockStatus(finalQty);

  // Validate changes
  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorText('');

    const numericValue = parseInt(drumChangeInput);
    
    if (isNaN(numericValue) || numericValue < 0) {
      setErrorText('Jumlah drum harus berupa angka positif yang sah.');
      return;
    }

    if (txType !== 'ADJUSTMENT' && numericValue === 0) {
      setErrorText('Perubahan kuantitas untuk Inbound/Outbound tidak boleh nol.');
      return;
    }

    if (txType === 'OUTBOUND' && finalQty < 0) {
      setErrorText(`Stok tidak mencukupi untuk penarikan ini. Sisa stok maksimum adalah ${originalQty} drum.`);
      return;
    }

    if (finalQty < 0) {
      setErrorText('Hasil akhiran stok drum tidak boleh bernilai negatif.');
      return;
    }

    // Determine actual change in quantity for record purposes
    let actualIncrementValue = 0;
    if (txType === 'INBOUND') actualIncrementValue = numericValue;
    else if (txType === 'OUTBOUND') actualIncrementValue = -numericValue;
    else actualIncrementValue = numericValue - originalQty; // adjustment delta

    onSaveStockUpdate(
      stockItem.materialId,
      stockItem.warehouseId,
      txType,
      actualIncrementValue,
      notes.trim() || (txType === 'INBOUND' ? 'Stok masuk gudang' : txType === 'OUTBOUND' ? 'Stok keluar gudang' : 'Penyesuaian stok reguler')
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        {/* Dark overlay backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
        />

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="pointer-events-auto w-screen max-w-md"
          >
            <div className="flex h-full flex-col overflow-y-auto bg-white shadow-2xl border-l border-slate-100">
              
              {/* Slider Header */}
              <div className="bg-slate-900 px-6 py-5 sm:px-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-400" />
                    <h2 className="text-base sm:text-lg font-semibold" id="slide-over-title">
                      Mutasi & Penyesuaian Stok
                    </h2>
                  </div>
                  <button 
                    id="close-drawer-btn"
                    onClick={onClose}
                    className="rounded-full p-1 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-hidden cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-300">
                  Perbarui catatan ketersediaan Raw Material (RM) secara instan.
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col justify-between p-6 space-y-6">
                
                {/* 1. Item target Identification banner */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Target Penempatan</span>
                  <div className="font-bold text-slate-800 text-lg mt-0.5">{material.name}</div>
                  <div className="text-xs text-slate-600 font-semibold mt-1">
                    Gudang: <span className="text-blue-900">{warehouse.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Kemasan Default: <span className="font-mono">@ {packWeight} Kg / Drum</span>
                  </div>
                </div>

                {/* 2. Choose Mutation Action Type */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Pilih Operasi/Mutasi</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      id="btn-tx-inbound"
                      type="button"
                      onClick={() => setTxType('INBOUND')}
                      className={`py-2.5 px-3 rounded-lg text-xs font-semibold border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        txType === 'INBOUND'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs font-bold'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                      Inbound (+)
                    </button>

                    <button
                      id="btn-tx-outbound"
                      type="button"
                      onClick={() => setTxType('OUTBOUND')}
                      className={`py-2.5 px-3 rounded-lg text-xs font-semibold border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        txType === 'OUTBOUND'
                          ? 'bg-red-50 border-red-300 text-red-800 shadow-2xs font-bold'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <ArrowUpFromLine className="h-4 w-4 text-red-600" />
                      Outbound (-)
                    </button>

                    <button
                      id="btn-tx-adjustment"
                      type="button"
                      onClick={() => setTxType('ADJUSTMENT')}
                      className={`py-2.5 px-3 rounded-lg text-xs font-semibold border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        txType === 'ADJUSTMENT'
                          ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs font-bold'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Sliders className="h-4 w-4 text-amber-600" />
                      Penyesuaian (=)
                    </button>
                  </div>
                </div>

                {/* 3. Numeric Quantity input */}
                <div className="space-y-2">
                  <label htmlFor="drum-qty-input" className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    {txType === 'INBOUND' ? 'Jumlah Drum Masuk' : txType === 'OUTBOUND' ? 'Jumlah Drum Keluar' : 'Atur Jumlah Drum Baru'}
                  </label>
                  <div className="relative">
                    <input
                      id="drum-qty-input"
                      type="number"
                      min="0"
                      required
                      placeholder={txType === 'ADJUSTMENT' ? `Contoh: ${originalQty}` : "Contoh: 10"}
                      value={drumChangeInput}
                      onChange={(e) => setDrumChangeInput(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 rounded-lg p-3 text-sm font-semibold text-slate-800 text-right pr-16"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                      DRUMS
                    </div>
                  </div>
                </div>

                {/* Live Output comparison panel */}
                <div className="bg-slate-100/60 rounded-xl p-4 border border-slate-100 text-xs">
                  <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] block mb-2">Simulasi Ketersediaan</span>
                  
                  <div className="grid grid-cols-3 gap-2 text-center align-middle items-center">
                    <div className="p-2 bg-white rounded-lg border border-slate-200/50">
                      <span className="text-[9px] text-slate-400 block tracking-wider">SEBELUM</span>
                      <strong className="block text-slate-700 font-mono mt-0.5">{originalQty} Drum</strong>
                      <span className="text-[10px] text-slate-400 font-mono">({originalWeightKg.toLocaleString('id-ID')} Kg)</span>
                    </div>

                    <div className="text-xl font-bold text-slate-400 select-none">→</div>

                    <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="text-[9px] text-emerald-500 block tracking-wider font-bold">SETELAH Simpan</span>
                      <strong className="block text-emerald-800 font-mono mt-0.5">{finalQty} Drum</strong>
                      <span className="text-[10px] text-emerald-600 font-mono">({finalWeightKg.toLocaleString('id-ID')} Kg)</span>
                    </div>
                  </div>

                  {/* Safety alerts before saving */}
                  <div className="mt-3 flex gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200/50">
                    <span className="text-slate-400">Vibe:</span>
                    <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded ${finalStatus.badgeClass}`}>
                      {finalStatus.badgeLabel}
                    </span>
                    <span className="text-slate-500 text-[10px] italic">
                      {finalQty <= 5 ? 'Kritis, butuh supply order segera.' : finalQty <= 15 ? 'Siaga rendah.' : 'Kuantitas aman untuk produksi.'}
                    </span>
                  </div>
                </div>

                {/* 4. Notes input field */}
                <div className="space-y-2">
                  <label htmlFor="notes-input" className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Keterangan / Dokumen Referensi</label>
                  <textarea
                    id="notes-input"
                    placeholder="Contoh: DO-2026-X883 atau Per keperluan produksi Line C"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 rounded-lg p-3 text-xs text-slate-800 leading-relaxed"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Simulated system operator detail */}
                <div className="p-3 bg-blue-50/40 rounded-lg border border-blue-50/60 text-[11px] text-slate-500 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-blue-900">
                    <User className="h-3.5 w-3.5" />
                    <span className="font-semibold">User Log (Audit Trail)</span>
                  </div>
                  <div>Petugas: <strong className="text-slate-700">logistic.technical@gmail.com</strong></div>
                  <div>Model Transaksi: <span className="font-mono bg-white px-1 py-0.5 border border-slate-100 text-slate-600 rounded">EIS Client Update</span></div>
                </div>

                {/* Error Banner */}
                {errorText && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-50 text-red-800 text-xs p-3 rounded-lg border border-red-200 flex items-start gap-2"
                  >
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{errorText}</span>
                  </motion.div>
                )}

                {/* Submit and cancel actions footer */}
                <div className="pt-4 border-t border-slate-150 flex gap-3">
                  <button
                    id="cancel-drawer"
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer text-center transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    id="save-drawer"
                    type="submit"
                    className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                  >
                    <Save className="h-4 w-4" />
                    Simpan Mutasi
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
