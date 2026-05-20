/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RawMaterial, Warehouse, StockItem, StockTransaction } from './types';

export const RAW_MATERIALS: RawMaterial[] = [
  { id: 'benzofuranol', name: 'Benzofuranol', packagingWeightKg: 220 },
  { id: 'osbp', name: 'OSBP', packagingWeightKg: 200 },
  { id: 'odcb', name: 'ODCB', packagingWeightKg: 250 },
  { id: 'oipop', name: 'Oipop', packagingWeightKg: 210 },
  { id: 'mcs', name: 'MCS', packagingWeightKg: 200 }
];

export const WAREHOUSES: Warehouse[] = [
  { id: 'wh-bcs', name: 'WH BCS Logistic', address: 'Kawasan Industri Merak, Cilegon' },
  { id: 'wh-salira', name: 'WH Salira', address: 'Jl. Raya Salira, Anyer' },
  { id: 'wh-mjs', name: 'WH MJS (Teratai, Bojonegara)', address: 'Bojonegara, Serang' }
];

// Initial stock mapping for 5 RM x 3 WH
export const INITIAL_STOCK_ITEMS: StockItem[] = [
  // Benzofuranol (@ 220 Kg)
  { id: 'benzofuranol_wh-bcs', materialId: 'benzofuranol', warehouseId: 'wh-bcs', quantityDrums: 45, lastUpdated: '2026-05-19T08:30:00Z' },
  { id: 'benzofuranol_wh-salira', materialId: 'benzofuranol', warehouseId: 'wh-salira', quantityDrums: 12, lastUpdated: '2026-05-18T10:15:00Z' }, // Low Stock
  { id: 'benzofuranol_wh-mjs', materialId: 'benzofuranol', warehouseId: 'wh-mjs', quantityDrums: 4, lastUpdated: '2026-05-20T01:00:00Z' }, // Critical

  // OSBP (@ 200 Kg)
  { id: 'osbp_wh-bcs', materialId: 'osbp', warehouseId: 'wh-bcs', quantityDrums: 60, lastUpdated: '2026-05-19T14:45:00Z' },
  { id: 'osbp_wh-salira', materialId: 'osbp', warehouseId: 'wh-salira', quantityDrums: 25, lastUpdated: '2026-05-17T09:20:00Z' },
  { id: 'osbp_wh-mjs', materialId: 'osbp', warehouseId: 'wh-mjs', quantityDrums: 0, lastUpdated: '2026-05-20T02:30:00Z' }, // Critical Out of stock

  // ODCB (@ 250 Kg)
  { id: 'odcb_wh-bcs', materialId: 'odcb', warehouseId: 'wh-bcs', quantityDrums: 30, lastUpdated: '2026-05-19T16:00:00Z' },
  { id: 'odcb_wh-salira', materialId: 'odcb', warehouseId: 'wh-salira', quantityDrums: 18, lastUpdated: '2026-05-15T11:00:00Z' },
  { id: 'odcb_wh-mjs', materialId: 'odcb', warehouseId: 'wh-mjs', quantityDrums: 14, lastUpdated: '2026-05-20T00:45:00Z' }, // Low Stock

  // Oipop (@ 210 Kg)
  { id: 'oipop_wh-bcs', materialId: 'oipop', warehouseId: 'wh-bcs', quantityDrums: 22, lastUpdated: '2026-05-18T13:10:00Z' },
  { id: 'oipop_wh-salira', materialId: 'oipop', warehouseId: 'wh-salira', quantityDrums: 3, lastUpdated: '2026-05-20T03:00:00Z' }, // Critical
  { id: 'oipop_wh-mjs', materialId: 'oipop', warehouseId: 'wh-mjs', quantityDrums: 40, lastUpdated: '2026-05-19T11:15:00Z' },

  // MCS (@ 200 Kg)
  { id: 'mcs_wh-bcs', materialId: 'mcs', warehouseId: 'wh-bcs', quantityDrums: 15, lastUpdated: '2026-05-19T07:15:00Z' }, // Low Stock
  { id: 'mcs_wh-salira', materialId: 'mcs', warehouseId: 'wh-salira', quantityDrums: 35, lastUpdated: '2026-05-18T15:20:00Z' },
  { id: 'mcs_wh-mjs', materialId: 'mcs', warehouseId: 'wh-mjs', quantityDrums: 8, lastUpdated: '2026-05-20T02:00:00Z' } // Low Stock
];

export const INITIAL_TRANSACTIONS: StockTransaction[] = [
  {
    id: 'tx-1681290321',
    timestamp: '2026-05-20T03:00:00Z',
    materialId: 'oipop',
    warehouseId: 'wh-salira',
    type: 'OUTBOUND',
    quantityDrumsChanged: -5,
    resultingQuantity: 3,
    notes: 'Kirim ke line produksi Tech B',
    operatorEmail: 'logistic.technical@gmail.com'
  },
  {
    id: 'tx-1681290199',
    timestamp: '2026-05-20T02:30:00Z',
    materialId: 'osbp',
    warehouseId: 'wh-mjs',
    type: 'OUTBOUND',
    quantityDrumsChanged: -12,
    resultingQuantity: 0,
    notes: 'Stok habis untuk formulasi batch #104',
    operatorEmail: 'logistic.technical@gmail.com'
  },
  {
    id: 'tx-1681289542',
    timestamp: '2026-05-20T02:00:00Z',
    materialId: 'mcs',
    warehouseId: 'wh-mjs',
    type: 'INBOUND',
    quantityDrumsChanged: 8,
    resultingQuantity: 8,
    notes: 'Terima kiriman dari pemasok utama',
    operatorEmail: 'logistic.technical@gmail.com'
  },
  {
    id: 'tx-1681289123',
    timestamp: '2026-05-20T01:00:00Z',
    materialId: 'benzofuranol',
    warehouseId: 'wh-mjs',
    type: 'ADJUSTMENT',
    quantityDrumsChanged: -1,
    resultingQuantity: 4,
    notes: 'Penyesuaian stok berkala: 1 drum rusak',
    operatorEmail: 'logistic.technical@gmail.com'
  }
];

export const STOCK_THRESHOLDS = {
  CRITICAL: 5, // <= 5 Drums is Critical
  LOW: 15       // <= 15 Drums is Low Stock
};

export function getStockStatus(drums: number) {
  if (drums <= STOCK_THRESHOLDS.CRITICAL) {
    return {
      label: drums === 0 ? 'Habis (Out of Stock)' : 'Kritis (Critical)',
      colorClass: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900/50',
      badgeClass: 'bg-red-500 text-white',
      badgeLabel: 'Kritis',
      statusType: 'CRITICAL' as const
    };
  } else if (drums <= STOCK_THRESHOLDS.LOW) {
    return {
      label: 'Stok Rendah (Low)',
      colorClass: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900/50',
      badgeClass: 'bg-amber-500 text-black',
      badgeLabel: 'Perlu Order',
      statusType: 'LOW' as const
    };
  } else {
    return {
      label: 'Aman (Safe)',
      colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/50',
      badgeClass: 'bg-emerald-500 text-white',
      badgeLabel: 'Aman',
      statusType: 'SAFE' as const
    };
  }
}
