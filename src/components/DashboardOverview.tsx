/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Layers, Weight, AlertTriangle, ShieldCheck, Warehouse as WhIcon } from 'lucide-react';
import { RawMaterial, Warehouse, StockItem, StockStats } from '../types';
import { getStockStatus } from '../initialData';

interface DashboardOverviewProps {
  stats: StockStats;
  warehouses: Warehouse[];
  materials: RawMaterial[];
  stockItems: StockItem[];
  onSelectWarehouse: (id: string | null) => void;
  selectedWarehouseId: string | null;
}

export default function DashboardOverview({
  stats,
  warehouses,
  materials,
  stockItems,
  onSelectWarehouse,
  selectedWarehouseId
}: DashboardOverviewProps) {
  
  // Calculate distribution of drums per warehouse
  const totalDrumsGlobal = stats.totalDrums || 1; // Prevent divide by zero
  const warehouseDistribution = warehouses.map(wh => {
    const whStock = stockItems.filter(item => item.warehouseId === wh.id);
    const drumsCount = whStock.reduce((acc, curr) => acc + curr.quantityDrums, 0);
    const weightKg = whStock.reduce((acc, curr) => {
      const mat = materials.find(m => m.id === curr.materialId);
      return acc + (curr.quantityDrums * (mat?.packagingWeightKg || 0));
    }, 0);
    const percentage = Math.round((drumsCount / totalDrumsGlobal) * 100);
    
    return {
      id: wh.id,
      name: wh.name,
      drums: drumsCount,
      weightKg: weightKg,
      percentage: percentage
    };
  });

  return (
    <div className="space-y-6">
      {/* Upper Grid: Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Drums Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex items-start gap-4 hover:border-slate-200 transition-colors"
        >
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Volume</p>
            <h3 className="text-2xl font-semibold text-slate-800 mt-1">
              {stats.totalDrums.toLocaleString('id-ID')} <span className="text-sm font-normal text-slate-500">Drum</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">Seluruh RM Technical</p>
          </div>
        </motion.div>

        {/* Total Weight Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex items-start gap-4 hover:border-slate-200 transition-colors"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Weight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Berat</p>
            <h3 className="text-2xl font-semibold text-slate-800 mt-1">
              {stats.totalWeightKg.toLocaleString('id-ID')} <span className="text-sm font-normal text-slate-500">Kg</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {((stats.totalWeightKg) / 1000).toFixed(1)} <span className="text-[10px] text-slate-400">Ton metrik</span>
            </p>
          </div>
        </motion.div>

        {/* Low Stock count Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex items-start gap-4 hover:border-slate-200 transition-colors"
        >
          <div className={`p-3 rounded-lg ${stats.lowStockItemsCount > 0 ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider font-semibold">Stok Kritis/Rendah</p>
            <h3 className="text-2xl font-semibold text-slate-800 mt-1">
              {stats.lowStockItemsCount} <span className="text-sm font-normal text-slate-500">Materi</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {stats.lowStockItemsCount > 0 ? 'Butuh perhatian / restock segera' : 'Ketersediaan aman'}
            </p>
          </div>
        </motion.div>

        {/* Status System Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex items-start gap-4 hover:border-slate-200 transition-colors"
        >
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Status Gudang</p>
            <h3 className="text-lg font-semibold text-slate-800 mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
              Terpantau Baik
            </h3>
            <p className="text-xs text-slate-400 mt-1">Koneksi EIS Sinkron</p>
          </div>
        </motion.div>
      </div>

      {/* Lower Row: Warehouse Distribution Percentage & Fast Selector */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 border-b border-slate-100 pb-4">
          <div>
            <h4 className="font-semibold text-slate-800 text-base md:text-lg">Kapasitas & Distribusi Gudang</h4>
            <p className="text-xs text-slate-500">Presentase kontribusi stok Drum per lokasi penyimpanan eksternal</p>
          </div>
          <div className="flex gap-2 text-xs">
            <button
              id="filter-wh-all"
              onClick={() => onSelectWarehouse(null)}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                selectedWarehouseId === null
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Gudang
            </button>
            {warehouses.map(wh => (
              <button
                key={wh.id}
                id={`filter-wh-${wh.id}`}
                onClick={() => onSelectWarehouse(wh.id)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                  selectedWarehouseId === wh.id
                    ? 'bg-blue-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {wh.name.replace('WH ', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Visual progress bar distribution */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {warehouseDistribution.map((item, idx) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                selectedWarehouseId === item.id 
                  ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100' 
                  : 'bg-slate-50/40 border-slate-100 hover:bg-slate-50/90 hover:border-slate-200'
              }`}
              onClick={() => onSelectWarehouse(selectedWarehouseId === item.id ? null : item.id)}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-sm text-slate-700 mt-0.5 flex items-center gap-1.5">
                  <WhIcon className="h-3.5 w-3.5 text-slate-400" />
                  {item.name}
                </span>
                <span className="font-semibold text-sm text-slate-800">{item.percentage}%</span>
              </div>
              <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden mb-3">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="bg-blue-600 h-2 rounded-full"
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{item.drums} Drum</span>
                <span className="font-mono">{item.weightKg.toLocaleString('id-ID')} Kg</span>
              </div>
              <div className="mt-2.5 text-[11px] text-blue-800 dark:text-blue-500 font-medium hover:underline text-right">
                {selectedWarehouseId === item.id ? 'Tampilkan Semua Gudang' : 'Tingkatkan Filter Gudang'}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
