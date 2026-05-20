/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Warehouse as WhIcon, 
  Layers, 
  History, 
  User, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  RefreshCw,
  PlusCircle,
  TrendingUp,
  FileSpreadsheet,
  Gauge
} from 'lucide-react';

import { StockItem, StockTransaction, StockStats, RawMaterial, Warehouse } from './types';
import { 
  RAW_MATERIALS, 
  WAREHOUSES, 
  INITIAL_STOCK_ITEMS, 
  INITIAL_TRANSACTIONS,
  STOCK_THRESHOLDS,
  getStockStatus
} from './initialData';

import DashboardOverview from './components/DashboardOverview';
import StockTable from './components/StockTable';
import StockUpdateDrawer from './components/StockUpdateDrawer';
import TransactionLog from './components/TransactionLog';

export default function App() {
  // --- Persistent State Initialization ---
  const [stockItems, setStockItems] = useState<StockItem[]>(() => {
    const saved = localStorage.getItem('eis_stock_items');
    return saved ? JSON.parse(saved) : INITIAL_STOCK_ITEMS;
  });

  const [transactions, setTransactions] = useState<StockTransaction[]>(() => {
    const saved = localStorage.getItem('eis_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  // Filters State
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  // App Layout Navigation - Tabs representation (to toggle view cleanly)
  const [activeViewTab, setActiveViewTab] = useState<'monitoring' | 'ledger'>('monitoring');

  // Dynamic mutation drawer control
  const [isUpdateDrawerOpen, setIsUpdateDrawerOpen] = useState(false);
  const [selectedStockToUpdate, setSelectedStockToUpdate] = useState<StockItem | null>(null);

  // Feedback notifications (Success/Failure alerts)
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type: 'success' | 'info';
    visible: boolean;
  }>({ message: '', type: 'success', visible: false });

  // Time Sync logic
  const [currentTime, setCurrentTime] = useState(new Date('2026-05-20T03:38:00Z'));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(prev => new Date(prev.getTime() + 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync state with localStorage whenever items/tx change
  useEffect(() => {
    localStorage.setItem('eis_stock_items', JSON.stringify(stockItems));
  }, [stockItems]);

  useEffect(() => {
    localStorage.setItem('eis_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // --- Dynamic calculations (Overall Dashboard Statistics) ---
  const globalStats: StockStats = useMemo(() => {
    let totalDrums = 0;
    let totalWeightKg = 0;
    let lowStockItemsCount = 0;

    stockItems.forEach(item => {
      const mat = RAW_MATERIALS.find(m => m.id === item.materialId);
      if (mat) {
        totalDrums += item.quantityDrums;
        totalWeightKg += item.quantityDrums * mat.packagingWeightKg;
        if (item.quantityDrums <= STOCK_THRESHOLDS.LOW) {
          lowStockItemsCount++;
        }
      }
    });

    return {
      totalDrums,
      totalWeightKg,
      lowStockItemsCount
    };
  }, [stockItems]);

  // Alert Items List for the instant Alert Banner (specifically <= CRITICAL or empty)
  const criticalShortages = useMemo(() => {
    return stockItems
      .filter(item => item.quantityDrums <= STOCK_THRESHOLDS.LOW)
      .map(item => {
        const mat = RAW_MATERIALS.find(m => m.id === item.materialId);
        const wh = WAREHOUSES.find(w => w.id === item.warehouseId);
        return {
          ...item,
          materialName: mat?.name || 'Unknown',
          warehouseName: wh?.name || 'Unknown',
          status: getStockStatus(item.quantityDrums)
        };
      })
      .sort((a, b) => a.quantityDrums - b.quantityDrums); // show lowest first
  }, [stockItems]);

  // --- Core Handlers ---
  const handleOpenStockUpdate = (item: StockItem) => {
    setSelectedStockToUpdate(item);
    setIsUpdateDrawerOpen(true);
  };

  const handleSaveStockMutation = (
    materialId: string,
    warehouseId: string,
    type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT',
    qtyChangeDelta: number,
    notes: string
  ) => {
    const targetId = `${materialId}_${warehouseId}`;
    let previousQty = 0;
    let finalQty = 0;

    // 1. Update the stock quantity safely
    setStockItems(prevItems => {
      return prevItems.map(item => {
        if (item.id === targetId) {
          previousQty = item.quantityDrums;
          finalQty = type === 'ADJUSTMENT' 
            ? (qtyChangeDelta + previousQty) // in adjustments, delta is calculated as setting target final
            : item.quantityDrums + qtyChangeDelta;
          
          return {
            ...item,
            quantityDrums: finalQty,
            lastUpdated: currentTime.toISOString()
          };
        }
        return item;
      });
    });

    // 2. Insert new transaction record into the log ledger
    const materialObj = RAW_MATERIALS.find(m => m.id === materialId);
    const warehouseObj = WAREHOUSES.find(w => w.id === warehouseId);
    
    // Fallback resulting quantity calculation
    const calculatedFinalQty = type === 'ADJUSTMENT' 
      ? (previousQty + qtyChangeDelta) 
      : (previousQty + qtyChangeDelta);

    const newTx: StockTransaction = {
      id: `tx-${Date.now()}`,
      timestamp: currentTime.toISOString(),
      materialId,
      warehouseId,
      type,
      quantityDrumsChanged: qtyChangeDelta,
      resultingQuantity: calculatedFinalQty,
      notes,
      operatorEmail: 'logistic.technical@gmail.com'
    };

    setTransactions(prevTxs => [newTx, ...prevTxs]);
    setIsUpdateDrawerOpen(false);

    // 3. Trigger Toast notification feedback
    const actionText = type === 'INBOUND' ? 'Tambahan masuk' : type === 'OUTBOUND' ? 'Pengeluaran' : 'Penyesuaian';
    const volumeText = `${Math.abs(qtyChangeDelta)} Drum ${materialObj?.name || ''}`;
    
    setToastNotification({
      message: `Berhasil mencatat ${actionText} sebanyak ${volumeText} di gudang ${warehouseObj?.name || ''}.`,
      type: 'success',
      visible: true
    });

    // Auto-dismiss toast after 5s
    setTimeout(() => {
      setToastNotification(prev => ({ ...prev, visible: false }));
    }, 5000);
  };

  // Quick reset entire ledger (restores state to clean mock baseline data)
  const handleResetLedger = () => {
    if (window.confirm('Apakah Anda yakin ingin menyetel ulang semua data stok dan log transaksi sistem ke kondisi awal?')) {
      setStockItems(INITIAL_STOCK_ITEMS);
      setTransactions(INITIAL_TRANSACTIONS);
      setToastNotification({
        message: 'EIS Database berhasil disetel ulang ke kondisi awal.',
        type: 'info',
        visible: true
      });
      setTimeout(() => setToastNotification(prev => ({ ...prev, visible: false })), 4000);
    }
  };

  // Print/Download CSV simulation (Craftsmanship touch)
  const handleExportStockReport = () => {
    const headers = 'ID Item,Nama Material,Standard Kemasan,Gudang,Sisa Drum,Total Berat (Kg),Status,Tanggal Diperbarui\n';
    const rows = stockItems.map(item => {
      const mat = RAW_MATERIALS.find(m => m.id === item.materialId);
      const wh = WAREHOUSES.find(w => w.id === item.warehouseId);
      const statusInfo = getStockStatus(item.quantityDrums);
      const weight = item.quantityDrums * (mat?.packagingWeightKg || 0);
      return `${item.id},"${mat?.name || ''}",${mat?.packagingWeightKg || 0},"${wh?.name || ''}",${item.quantityDrums},${weight},"${statusInfo.badgeLabel}","${item.lastUpdated}"`;
    }).join('\n');

    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EIS_RM_Technical_Report_${currentTime.toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastNotification({
      message: 'Laporan Rekapitulasi Stok RM Technical (CSV) telah berhasil diunduh.',
      type: 'success',
      visible: true
    });
    setTimeout(() => setToastNotification(prev => ({ ...prev, visible: false })), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      
      {/* ==================== UPPER APP BAR / SYSTEM BAR ==================== */}
      <header className="bg-slate-900 border-b border-slate-950 text-white sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left section: Logo and Title */}
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/90 hover:bg-blue-600 p-2 rounded-lg transition-colors flex items-center justify-center text-white shadow-inner">
                <Gauge className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-blue-400 block -mb-0.5 leading-none uppercase">EIS CORE PLATFORM</span>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
                  External Inventory System
                  <span className="hidden sm:inline bg-blue-900 px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-300">Technical RM</span>
                </h1>
              </div>
            </div>

            {/* Right section: Info Bar, Time, Supervisor Email */}
            <div className="flex items-center gap-4 text-xs">
              <div className="hidden md:flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300">
                <Clock className="h-3.5 w-3.5 text-blue-400" />
                <span className="font-mono tracking-wide">
                  {currentTime.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  })} UTC
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400 font-mono">
                  {currentTime.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-850 hover:bg-slate-800 transition-colors border border-slate-850/60 rounded-lg px-3 py-1.5">
                <User className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <div className="text-left">
                  <span className="text-[10px] block text-slate-400 leading-none">Petugas Gudang</span>
                  <span className="font-semibold text-slate-200 block mt-0.5 leading-none">logistic.technical@gmail.com</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ==================== MAIN CONTENT CANVASES ==================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Sub-Header Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Evaluasi Stok Gudang Technical</h2>
            <p className="text-xs text-slate-500 mt-1">
              Pantau total tonase bahan baku, terima barang masuk, atau koordinasikan pengeluaran dari gudang logsitik eksternal.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="export-report-btn"
              onClick={handleExportStockReport}
              className="px-3.5 py-2 bg-white text-slate-755 hover:text-slate-950 border border-slate-200 hover:border-slate-350 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Download className="h-4 w-4 text-blue-900" />
              Ekspor rekap (.CSV)
            </button>
          </div>
        </div>

        {/* ==================== CRITICAL QUANTITY ALERTS BANNER ==================== */}
        {criticalShortages.some(s => s.quantityDrums <= STOCK_THRESHOLDS.CRITICAL) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50/50 dark:bg-red-950/10 border border-red-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 rounded-lg shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-red-900 text-sm md:text-base">Perhatian: Ketersediaan Item Kritis / Habis!</h4>
                <p className="text-xs text-red-700/80 mt-0.5 max-w-3xl">
                  Terdapat material teknik yang berada di bawah level keselamatan minimum (Kritis &le; 5 Drum) di gudang eksternal. Silakan koordinasi dengan Purchasing atau logistik internal untuk pengisian ulang.
                </p>
                
                {/* Visual badge tags of affected items */}
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {criticalShortages
                    .filter(s => s.quantityDrums <= STOCK_THRESHOLDS.CRITICAL)
                    .map(item => (
                      <span 
                        key={item.id} 
                        className="inline-flex items-center gap-1.5 bg-white border border-red-200 rounded px-2.5 py-1 text-[11px] font-semibold text-red-800"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block animate-ping"></span>
                        {item.materialName} ({item.quantityDrums} Drum di {item.warehouseName.replace('WH ', '')})
                      </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ==================== GLOBAL STATS DASHBOARD OVERVIEW ==================== */}
        <DashboardOverview
          stats={globalStats}
          warehouses={WAREHOUSES}
          materials={RAW_MATERIALS}
          stockItems={stockItems}
          onSelectWarehouse={setSelectedWarehouseId}
          selectedWarehouseId={selectedWarehouseId}
        />

        {/* ==================== APP MODE MENU / TABS NAVIGATION ==================== */}
        <div className="flex border-b border-slate-200 bg-white/50 p-1 rounded-xl border max-w-sm">
          <button
            id="tab-monitoring-mode"
            onClick={() => setActiveViewTab('monitoring')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeViewTab === 'monitoring'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Monitoring Stok
          </button>
          
          <button
            id="tab-ledger-mode"
            onClick={() => setActiveViewTab('ledger')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeViewTab === 'ledger'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Buku Ledger Mutasi
          </button>
        </div>

        {/* ==================== TAB 1: STOCK MONITORING GRID / LIST ==================== */}
        {activeViewTab === 'monitoring' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <StockTable
              stockItems={stockItems}
              materials={RAW_MATERIALS}
              warehouses={WAREHOUSES}
              selectedWarehouseId={selectedWarehouseId}
              onSelectWarehouse={setSelectedWarehouseId}
              onUpdateStockClick={handleOpenStockUpdate}
            />
          </motion.div>
        )}

        {/* ==================== TAB 2: TRANSACTION LEDGER ==================== */}
        {activeViewTab === 'ledger' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <TransactionLog
              transactions={transactions}
              materials={RAW_MATERIALS}
              warehouses={WAREHOUSES}
              onClearTransactions={handleResetLedger}
            />
          </motion.div>
        )}

      </main>

      {/* ==================== FOOTER PLATFORM CREDIT ==================== */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left sm:flex sm:items-center sm:justify-between">
          <div>
            <strong>EIS &mdash; External Inventory System</strong> v2.4.9
            <p className="mt-1 text-slate-400">Platform Pemantauan Stok Bahan Baku Technical Gudang Eksternal</p>
          </div>
          <div className="mt-3 sm:mt-0 flex gap-4 justify-center sm:justify-start">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Terminal Server Live
            </span>
            <span className="text-slate-300">|</span>
            <span>Database: React localStorage Persistence</span>
          </div>
        </div>
      </footer>

      {/* ==================== ACTION MUTATION DRAWER ==================== */}
      <AnimatePresence>
        {isUpdateDrawerOpen && (
          <StockUpdateDrawer
            isOpen={isUpdateDrawerOpen}
            onClose={() => setIsUpdateDrawerOpen(false)}
            stockItem={selectedStockToUpdate}
            materials={RAW_MATERIALS}
            warehouses={WAREHOUSES}
            onSaveStockUpdate={handleSaveStockMutation}
          />
        )}
      </AnimatePresence>

      {/* ==================== TOAST FEEDBACK FLOATER ==================== */}
      <AnimatePresence>
        {toastNotification.visible && (
          <div className="fixed bottom-5 right-5 z-55 pointer-events-none max-w-sm w-full">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-4 rounded-xl border text-xs shadow-xl pointer-events-auto flex items-start gap-2.5 ${
                toastNotification.type === 'info'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white border-slate-250 text-slate-800'
              }`}
            >
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1">
                <span className="font-semibold block text-slate-900">Pembaharuan Berhasil</span>
                <span className="text-slate-550 block mt-0.5 leading-relaxed">{toastNotification.message}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
