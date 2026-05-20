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


// --- Utilities for Google Spreadsheet CSV integration ---
function parseCSV(text: string) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const parseRow = (rowText: string): string[] => {
    const result: string[] = [];
    let currentVal = '';
    let insideQuotes = false;
    for (let i = 0; i < rowText.length; i++) {
      const char = rowText[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    result.push(currentVal.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase());
  
  // Find column indexes
  const itemIdx = headers.findIndex(h => h.includes('item'));
  const bcsIdx = headers.findIndex(h => h.includes('bcs_logistic') || h.includes('bcs') || h.includes('logistic'));
  const saliraIdx = headers.findIndex(h => h.includes('salira'));
  const mjsIdx = headers.findIndex(h => h.includes('mjs_teratai') || h.includes('mjs') || h.includes('teratai'));

  const parsedData = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const vals = parseRow(rawLine);
    if (vals.length < 2) continue;
    
    const materialName = itemIdx !== -1 && vals[itemIdx] ? vals[itemIdx] : '';
    if (!materialName) continue;

    parsedData.push({
      item: materialName,
      bcs_logistic: Number((bcsIdx !== -1 && vals[bcsIdx] ? vals[bcsIdx] : '0').replace(/[^0-9.-]/g, '')) || 0,
      salira: Number((saliraIdx !== -1 && vals[saliraIdx] ? vals[saliraIdx] : '0').replace(/[^0-9.-]/g, '')) || 0,
      mjs_teratai: Number((mjsIdx !== -1 && vals[mjsIdx] ? vals[mjsIdx] : '0').replace(/[^0-9.-]/g, '')) || 0,
    });
  }
  return parsedData;
}

function resolveMaterialId(itemName: string): string | null {
  const norm = itemName.toLowerCase();
  if (norm.includes('benzofuranol')) return 'benzofuranol';
  if (norm.includes('osbp')) return 'osbp';
  if (norm.includes('odcb')) return 'odcb';
  if (norm.includes('oipop')) return 'oipop';
  if (norm.includes('mcs')) return 'mcs';
  return null;
}

export default function App() {
  // --- Persistent State Initialization ---
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('eis_spreadsheet_id') || '';
  });

  const [stockItems, setStockItems] = useState<StockItem[]>(() => {
    const saved = localStorage.getItem('eis_stock_items');
    return saved ? JSON.parse(saved) : INITIAL_STOCK_ITEMS;
  });

  const [transactions, setTransactions] = useState<StockTransaction[]>(() => {
    const saved = localStorage.getItem('eis_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  // Google Sheets integration status states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const saved = localStorage.getItem('eis_last_sync');
    return saved ? new Date(saved) : null;
  });
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

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

  // Sync states with localStorage
  useEffect(() => {
    localStorage.setItem('eis_stock_items', JSON.stringify(stockItems));
  }, [stockItems]);

  useEffect(() => {
    localStorage.setItem('eis_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('eis_spreadsheet_id', spreadsheetId);
  }, [spreadsheetId]);

  useEffect(() => {
    if (lastSyncTime) {
      localStorage.setItem('eis_last_sync', lastSyncTime.toISOString());
    }
  }, [lastSyncTime]);

  // Core Google Sheets Fetcher
  const fetchStockFromGoogleSheets = async (targetId: string) => {
    if (!targetId || targetId.trim() === '') {
      setSyncError('Spreadsheet ID kosong. Silakan masukkan Google Spreadsheet ID Anda.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const url = `https://docs.google.com/spreadsheets/d/${targetId.trim()}/gviz/tq?tqx=out:csv`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Koneksi ke Google Sheets gagal dengan status HTTP ${res.status}.`);
      }

      const csvText = await res.text();
      const rows = parseCSV(csvText);

      if (rows.length === 0) {
        throw new Error('Gagal mendeteksi kolom yang sesuai. Pastikan Spreadsheet memiliki header: "item", "bcs_logistic", "salira", "mjs_teratai".');
      }

      const nowStr = new Date().toISOString();
      const updatedStockItems: StockItem[] = [];

      rows.forEach(row => {
        const matId = resolveMaterialId(row.item);
        if (!matId) return; // ignore unknown materials

        // Map BCS Logistic
        updatedStockItems.push({
          id: `${matId}_wh-bcs`,
          materialId: matId,
          warehouseId: 'wh-bcs',
          quantityDrums: row.bcs_logistic,
          lastUpdated: nowStr
        });

        // Map Salira
        updatedStockItems.push({
          id: `${matId}_wh-salira`,
          materialId: matId,
          warehouseId: 'wh-salira',
          quantityDrums: row.salira,
          lastUpdated: nowStr
        });

        // Map MJS
        updatedStockItems.push({
          id: `${matId}_wh-mjs`,
          materialId: matId,
          warehouseId: 'wh-mjs',
          quantityDrums: row.mjs_teratai,
          lastUpdated: nowStr
        });
      });

      if (updatedStockItems.length === 0) {
        throw new Error('Tidak ada data material yang cocok. Periksa kembali nama material (Benzofuranol, OSBP, ODCB, Oipop, MCS).');
      }

      setStockItems(updatedStockItems);
      setLastSyncTime(new Date());
      setSyncError(null);

      // Trigger short visual confirmation
      setToastNotification({
        message: 'Data ketersediaan berhasil disinkronkan langsung dari Google Sheets.',
        type: 'success',
        visible: true
      });
      setTimeout(() => setToastNotification(prev => ({ ...prev, visible: false })), 4000);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setSyncError(
        err.message || 'Gagal memproses URL Google Sheets. Pastikan Spreadsheet Anda sudah disetel "Siapa saja yang memiliki link dapat melihat" (Public Link Sharing).'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // Triggers for syncing Google Sheets
  useEffect(() => {
    if (spreadsheetId && spreadsheetId.trim() !== '') {
      fetchStockFromGoogleSheets(spreadsheetId);
    }
  }, [spreadsheetId]);

  // Auto-refresh timer (customizable up to 30s)
  useEffect(() => {
    if (!isAutoRefresh || !spreadsheetId || spreadsheetId.trim() === '') return;

    const interval = setInterval(() => {
      fetchStockFromGoogleSheets(spreadsheetId);
    }, 30000); // exactly 30 seconds count

    return () => clearInterval(interval);
  }, [isAutoRefresh, spreadsheetId]);


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

        {/* ==================== GOOGLE SHEETS SYNCHRONIZATION PANE ==================== */}
        <div id="google-sheets-sync-panel" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-100">
            <div className="space-y-1 md:max-w-xl">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-green-50 text-green-700 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="h-4 w-4" />
                </span>
                <h3 className="text-sm md:text-base font-bold text-slate-900 tracking-tight">Koneksi Sinkronisasi Google Sheets</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Aplikasi mengambil (fetch) data secara real-time dari Google Sheets yang di-export sebagai CSV secara eksternal. Sisa stok akan otomatis terupdate tanpa perlu refresh manual.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
              {/* Auto Refresh Switch */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-semibold text-slate-600">Auto-refresh (30s)</span>
                <input 
                  type="checkbox" 
                  checked={isAutoRefresh}
                  onChange={(e) => setIsAutoRefresh(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>

              <button
                id="sync-now-btn"
                disabled={isSyncing || !spreadsheetId}
                onClick={() => fetchStockFromGoogleSheets(spreadsheetId)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSyncing 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                }`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sinkronisasi...' : 'Sinkronkan Sekarang'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-5">
            {/* Input Form Column */}
            <div className="md:col-span-7 space-y-3.5">
              <div>
                <label htmlFor="spreadsheet-id-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                  ID Spreadsheet Google Sheets
                </label>
                <div className="flex gap-2">
                  <input
                    id="spreadsheet-id-input"
                    type="text"
                    placeholder="Masukkan ID Spreadsheet Anda di sini..."
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    className="flex-1 bg-slate-50 text-slate-800 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:bg-white px-3.5 py-2 rounded-lg text-xs font-mono placeholder:text-slate-400 focus:outline-hidden transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const demoId = '1OPhL-p8tS-3L1Kk3qVz9r0KKeen_a6x7Y62X_fG-Uks';
                      setSpreadsheetId(demoId);
                      fetchStockFromGoogleSheets(demoId);
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Gunakan ID Demo
                  </button>
                </div>
              </div>

              {/* Collapsible Setup Guide */}
              <details className="group border border-slate-100 hover:border-slate-200 rounded-lg p-2.5 transition-colors">
                <summary className="text-xs font-bold text-slate-700 cursor-pointer list-none flex items-center justify-between select-none">
                  <span>Cara setup Google Sheets Anda (Klik untuk petunjuk)</span>
                  <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">&darr;</span>
                </summary>
                <div className="mt-3 text-xs text-slate-550 space-y-2 pl-1 whitespace-pre-line leading-relaxed">
                  1. Buat spreadsheet baru di Google Sheets.
                  2. Isi baris pertama (Header) persis dengan kolom: <strong className="font-mono text-emerald-800">item, bcs_logistic, salira, mjs_teratai</strong>.
                  3. Tulis nama material teknik di kolom <span className="font-mono">item</span>: <strong className="text-slate-800">Benzofuranol, OSBP, ODCB, Oipop, MCS</strong>.
                  4. Masukkan angka sisa stok drum di kolom masing-masing gudang.
                  5. Klik tombol <strong className="text-slate-800">"Bagikan" (Share)</strong> di kanan atas Google Sheets.
                  6. Ubah Akses Umum dari "Dibatasi" menjadi <strong className="text-emerald-700">"Siapa saja yang memiliki link dapat melihat" (Anyone with the link can view)</strong>.
                  7. Salin ID Spreadsheet dari URL browser Anda. (ID adalah string acak panjang di antara <code className="bg-slate-100 px-1 font-mono">/d/</code> dan <code className="bg-slate-100 px-1 font-mono">/edit</code>).
                  8. Tempel ke kolom input di atas lalu tekan tombol <strong className="text-slate-800">Sinkronkan Sekarang</strong>!
                </div>
              </details>
            </div>

            {/* Sync Status Info Column */}
            <div className="md:col-span-5 bg-slate-50 border border-slate-150 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold tracking-widest text-slate-400 block uppercase">STATUS INTEGRASI</span>
                
                {syncError ? (
                  <div className="p-2.5 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      Gagal Sinkronisasi
                    </div>
                    <p className="text-[11px] text-red-700/90 leading-relaxed font-medium">{syncError}</p>
                  </div>
                ) : spreadsheetId ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 py-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Terkoneksi Real-time (Google Sheets)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700 py-1">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <span>Menggunakan Data Simulasi Memori</span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 space-y-1 font-mono border-t border-slate-200/65 pt-3">
                <div className="flex justify-between">
                  <span>Waktu Sinkronisasi Terakhir:</span>
                  <span className="font-semibold text-slate-700">
                    {lastSyncTime ? lastSyncTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC' : 'Belum pernah'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Mode Koneksi:</span>
                  <span className="font-semibold text-slate-700">{spreadsheetId ? 'Google Sheets Export CSV' : 'Simulasi Offline (localStorage)'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

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
