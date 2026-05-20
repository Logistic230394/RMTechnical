/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  SlidersHorizontal, 
  RotateCcw, 
  Edit3, 
  TrendingUp, 
  ArrowUpDown, 
  FileSpreadsheet,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Grid,
  List,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { RawMaterial, Warehouse, StockItem } from '../types';
import { getStockStatus, STOCK_THRESHOLDS } from '../initialData';

interface StockTableProps {
  stockItems: StockItem[];
  materials: RawMaterial[];
  warehouses: Warehouse[];
  selectedWarehouseId: string | null;
  onSelectWarehouse: (id: string | null) => void;
  onUpdateStockClick: (stockItem: StockItem) => void;
}

type SortField = 'item' | 'warehouse' | 'qty' | 'weight' | 'status';
type SortOrder = 'asc' | 'desc';

export default function StockTable({
  stockItems,
  materials,
  warehouses,
  selectedWarehouseId,
  onSelectWarehouse,
  onUpdateStockClick
}: StockTableProps) {
  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'CRITICAL' | 'LOW' | 'SAFE'>('all');
  
  // Table state
  const [sortField, setSortField] = useState<SortField>('item');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showFilters, setShowFilters] = useState(false);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedMaterialId('all');
    setSelectedStatusFilter('all');
    onSelectWarehouse(null);
  };

  // Sort mechanism
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Core Stock List calculation
  const calculatedItems = useMemo(() => {
    return stockItems.map(item => {
      const material = materials.find(m => m.id === item.materialId);
      const warehouse = warehouses.find(w => w.id === item.warehouseId);
      
      const itemWeightKg = item.quantityDrums * (material?.packagingWeightKg || 0);
      const statusInfo = getStockStatus(item.quantityDrums);
      
      return {
        ...item,
        materialName: material?.name || 'Unknown',
        packagingWeightKg: material?.packagingWeightKg || 0,
        warehouseName: warehouse?.name || 'Unknown',
        warehouseAddress: warehouse?.address || '',
        totalWeightKg: itemWeightKg,
        statusLabel: statusInfo.label,
        statusType: statusInfo.statusType,
        badgeLabel: statusInfo.badgeLabel,
        colorClass: statusInfo.colorClass,
        badgeClass: statusInfo.badgeClass
      };
    });
  }, [stockItems, materials, warehouses]);

  // Filtered lists
  const filteredItems = useMemo(() => {
    return calculatedItems.filter(item => {
      // 1. Warehouse filter
      if (selectedWarehouseId && item.warehouseId !== selectedWarehouseId) {
        return false;
      }
      // 2. Material filter
      if (selectedMaterialId !== 'all' && item.materialId !== selectedMaterialId) {
        return false;
      }
      // 3. Status filter
      if (selectedStatusFilter !== 'all' && item.statusType !== selectedStatusFilter) {
        return false;
      }
      // 4. Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matMatch = item.materialName.toLowerCase().includes(query);
        const whMatch = item.warehouseName.toLowerCase().includes(query);
        return matMatch || whMatch;
      }
      return true;
    });
  }, [calculatedItems, selectedWarehouseId, selectedMaterialId, selectedStatusFilter, searchQuery]);

  // Sorted items
  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];
    sorted.sort((a, b) => {
      let valA: any = a[sortField as keyof typeof a];
      let valB: any = b[sortField as keyof typeof b];

      // Custom fields resolution
      if (sortField === 'item') {
        valA = a.materialName;
        valB = b.materialName;
      } else if (sortField === 'warehouse') {
        valA = a.warehouseName;
        valB = b.warehouseName;
      } else if (sortField === 'qty') {
        valA = a.quantityDrums;
        valB = b.quantityDrums;
      } else if (sortField === 'weight') {
        valA = a.totalWeightKg;
        valB = b.totalWeightKg;
      } else if (sortField === 'status') {
        valA = a.quantityDrums; // sort by stock danger levels (low first)
        valB = b.quantityDrums;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredItems, sortField, sortOrder]);

  // Stats for the currently filtered selection (very useful for operators!)
  const filteredStats = useMemo(() => {
    const totalDrums = filteredItems.reduce((acc, curr) => acc + curr.quantityDrums, 0);
    const totalWeight = filteredItems.reduce((acc, curr) => acc + curr.totalWeightKg, 0);
    const criticalCount = filteredItems.filter(i => i.statusType === 'CRITICAL').length;
    const lowCount = filteredItems.filter(i => i.statusType === 'LOW').length;
    
    return {
      totalDrums,
      totalWeight,
      criticalCount,
      lowCount
    };
  }, [filteredItems]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      
      {/* Table Action and Filter Header */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-800 text-base md:text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-4.5 w-4.5 text-blue-900" />
              Detail Monitoring Stok Gudang Eksternal
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan <span className="font-semibold text-slate-700">{filteredItems.length}</span> baris penempatan material
            </p>
          </div>
          
          {/* Quick search & filter toggle */}
          <div className="flex items-center gap-2 self-stretch md:self-auto">
            <div className="relative flex-1 md:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                id="search-input"
                type="text"
                placeholder="Cari item / gudang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white text-slate-800 border border-slate-200 rounded-lg text-xs leading-5 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <button
              id="filter-toggle"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                showFilters || selectedMaterialId !== 'all' || selectedStatusFilter !== 'all' || selectedWarehouseId !== null
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filter</span>
            </button>

            {/* View Mode Toggle (Table / Cards) */}
            <div className="border border-slate-200 rounded-lg overflow-hidden flex divide-x divide-slate-200">
              <button
                id="view-table-btn"
                onClick={() => setViewMode('table')}
                className={`p-1.5 cursor-pointer transition-colors ${viewMode === 'table' ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-500 hover:text-slate-800'}`}
                title="Tampilan Tabel"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                id="view-grid-btn"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 cursor-pointer transition-colors ${viewMode === 'grid' ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-500 hover:text-slate-800'}`}
                title="Tampilan Grid/Cards"
              >
                <Grid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Deep Filters Drawer panel */}
        <AnimatePresence>
          {(showFilters || selectedMaterialId !== 'all' || selectedStatusFilter !== 'all' || selectedWarehouseId !== null) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mt-4"
            >
              <div className="p-4 bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                {/* 1. Filter Gudang */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 block">Lokasi Gudang</label>
                  <select
                    id="filter-warehouse-select"
                    value={selectedWarehouseId || 'all'}
                    onChange={(e) => onSelectWarehouse(e.target.value === 'all' ? null : e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:bg-white"
                  >
                    <option value="all">Semua Gudang</option>
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Filter Item / RM */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 block">Raw Material (RM)</label>
                  <select
                    id="filter-material-select"
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:bg-white"
                  >
                    <option value="all">Semua Item Technical</option>
                    {materials.map(mat => (
                      <option key={mat.id} value={mat.id}>{mat.name} (@ {mat.packagingWeightKg} Kg)</option>
                    ))}
                  </select>
                </div>

                {/* 3. Filter Safe Status */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 block">Kategori Stok</label>
                  <select
                    id="filter-status-select"
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:bg-white"
                  >
                    <option value="all">Semua Kategori</option>
                    <option value="SAFE">Aman (Safe)</option>
                    <option value="LOW">Rendah (Low Stock)</option>
                    <option value="CRITICAL">Kritis / Habis (Critical)</option>
                  </select>
                </div>

                {/* Reset Filters & Clear info */}
                <div className="flex items-end justify-end">
                  <button
                    id="reset-filters"
                    onClick={handleResetFilters}
                    className="w-full sm:w-auto px-4 py-2 text-slate-600 hover:text-slate-950 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Saringan
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic mini subtotal bar of active selection */}
        {filteredItems.length !== stockItems.length && (
          <div className="mt-3 flex flex-wrap items-center gap-3 bg-blue-50/40 border border-blue-100/60 rounded-lg px-3 py-1.5 text-xs text-blue-900">
            <span className="font-medium">Subtotal Filtered:</span>
            <span><strong>{filteredStats.totalDrums}</strong> Drum</span>
            <span className="text-blue-300">|</span>
            <span><strong>{filteredStats.totalWeight.toLocaleString('id-ID')}</strong> Kg</span>
            {filteredStats.criticalCount > 0 && (
              <>
                <span className="text-blue-300">|</span>
                <span className="text-red-700 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 inline" /> <strong>{filteredStats.criticalCount}</strong> Status Kritis!
                </span>
              </>
            )}
            <button 
              id="clear-all-quick-filters"
              onClick={handleResetFilters} 
              className="ml-auto underline hover:text-blue-700 text-[11px] cursor-pointer"
            >
              Hapus filter
            </button>
          </div>
        )}
      </div>

      {/* Main Container Content */}
      <div className="p-0">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <div className="inline-flex justify-center items-center h-12 w-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <Search className="h-6 w-6" />
            </div>
            <h4 className="font-semibold text-slate-700 text-sm">Data Stok Tidak Ditemukan</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 px-4">
              Tidak ada data Raw Material yang cocok dengan saringan sanksi pencarian saat ini. Silakan atur ulang filter Anda.
            </p>
            <button
              id="empty-reset-button"
              onClick={handleResetFilters}
              className="mt-4 px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Tampilkan Semua Stok
            </button>
          </div>
        ) : viewMode === 'table' ? (
          // ==================== TABLE VIEW (DESKTOP) ====================
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] text-slate-500 font-medium uppercase tracking-wider select-none">
                  <th 
                    onClick={() => handleSort('item')}
                    className="py-3 px-5 cursor-pointer hover:bg-slate-100"
                  >
                    <div className="flex items-center gap-1">
                      Nama Item Code & Standard Packaging
                      <ArrowUpDown className="h-2.5 w-2.5 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('warehouse')}
                    className="py-3 px-5 cursor-pointer hover:bg-slate-100"
                  >
                    <div className="flex items-center gap-1">
                      Lokasi Gudang Eksternal
                      <ArrowUpDown className="h-2.5 w-2.5 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('qty')}
                    className="py-3 px-5 text-right cursor-pointer hover:bg-slate-100"
                    style={{ width: '130px' }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Jumlah (Qty)
                      <ArrowUpDown className="h-2.5 w-2.5 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('weight')}
                    className="py-3 px-5 text-right cursor-pointer hover:bg-slate-100"
                    style={{ width: '160px' }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total Berat (Kg)
                      <ArrowUpDown className="h-2.5 w-2.5 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('status')}
                    className="py-3 px-5 cursor-pointer hover:bg-slate-100"
                    style={{ width: '180px' }}
                  >
                    <div className="flex items-center gap-1">
                      Status & Keterangan
                      <ArrowUpDown className="h-2.5 w-2.5 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-5 text-right" style={{ width: '100px' }}>Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sortedItems.map((item) => (
                  <motion.tr 
                    key={item.id}
                    layoutId={item.id}
                    className="hover:bg-slate-50/55 transition-colors group align-middle"
                  >
                    {/* Item Name & Pack */}
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-800">{item.materialName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Standard Packing: @ {item.packagingWeightKg} Kg / Drum
                      </div>
                    </td>

                    {/* Warehouse Location */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        <MapPin className="h-3.5 w-3.5 text-blue-800" />
                        {item.warehouseName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs block mt-0.5" title={item.warehouseAddress}>
                        {item.warehouseAddress}
                      </div>
                    </td>

                    {/* Quantity (Drums) */}
                    <td className="py-4 px-5 text-right font-semibold text-slate-800 font-mono">
                      <span className="text-base">{item.quantityDrums}</span> <span className="text-xs font-normal text-slate-500">Drum</span>
                    </td>

                    {/* Total Weight in Kilograms */}
                    <td className="py-4 px-5 text-right">
                      <div className="font-semibold text-slate-950 font-mono">
                        {item.totalWeightKg.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500">Kg</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {(item.totalWeightKg / 1000).toFixed(2)} Ton
                      </div>
                    </td>

                    {/* Status badge pill */}
                    <td className="py-4 px-5">
                      <div className={`px-2.5 py-1 rounded-md text-xs border max-w-[170px] flex items-center gap-1.5 ${item.colorClass}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          item.statusType === 'CRITICAL' ? 'bg-red-500' :
                          item.statusType === 'LOW' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                        <span className="font-semibold">{item.statusLabel}</span>
                      </div>
                    </td>

                    {/* Actions dropdown inline */}
                    <td className="py-4 px-5 text-right">
                      <button
                        id={`update-stock-btn-${item.id}`}
                        onClick={() => onUpdateStockClick(item)}
                        className="p-2 text-slate-500 hover:text-blue-900 bg-slate-100 hover:bg-blue-50/80 rounded-lg transition-colors inline-flex cursor-pointer"
                        title="Perbarui Stok / Laporkan Transaksi"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // ==================== GRID / CARD VIEW (MOBILE/ADAPTIVE) ====================
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedItems.map((item) => (
              <motion.div
                key={item.id}
                layoutId={item.id}
                className="bg-slate-50/60 rounded-xl p-4 border border-slate-100 shadow-2xs hover:border-slate-300 hover:bg-white transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm md:text-base leading-tight">{item.materialName}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Pack: @ {item.packagingWeightKg} Kg</p>
                    </div>
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${item.colorClass}`}>
                      {item.badgeLabel}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {/* Warehouse Detail */}
                    <div className="flex items-start gap-1 text-xs text-slate-600">
                      <MapPin className="h-3.5 w-3.5 text-blue-800 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-700">{item.warehouseName}</span>
                        <span className="text-[10px] block text-slate-400 truncate w-48">{item.warehouseAddress}</span>
                      </div>
                    </div>

                    {/* Qty and Weight detail boxes */}
                    <div className="grid grid-cols-2 gap-2 bg-white rounded-lg p-2.5 border border-slate-200/50">
                      <div className="text-center border-r border-slate-100">
                        <span className="text-[10px] text-slate-400 block tracking-wider uppercase">DRUMS</span>
                        <span className="font-bold text-slate-800 font-mono text-base">{item.quantityDrums}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] text-slate-400 block tracking-wider uppercase">BERAT (KG)</span>
                        <span className="font-bold text-slate-800 font-mono text-base">{item.totalWeightKg.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Button triggers edit */}
                <button
                  id={`update-stock-btn-mob-${item.id}`}
                  onClick={() => onUpdateStockClick(item)}
                  className="mt-4 w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Sesuaikan / Update Stok
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer statistics breakdown */}
      <div className="bg-slate-50 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Sistem EIS memantau 15 titik koordinat stok secara berkala (5 RM x 3 WH)</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Stok Terendah: <span className="text-red-600 font-semibold">{calculatedItems.filter(i => i.quantityDrums <= STOCK_THRESHOLDS.CRITICAL).length} Kritis</span></span>
          <span className="text-slate-300">|</span>
          <span>Suhu Ruang Ideal RM: <span className="font-semibold text-slate-700">25°C - 30°C</span></span>
        </div>
      </div>
    </div>
  );
}
