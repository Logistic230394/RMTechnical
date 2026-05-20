/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RawMaterial {
  id: string;
  name: string;
  packagingWeightKg: number;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
}

export interface StockItem {
  id: string; // materialId_warehouseId
  materialId: string;
  warehouseId: string;
  quantityDrums: number;
  lastUpdated: string;
}

export interface StockTransaction {
  id: string;
  timestamp: string;
  materialId: string;
  warehouseId: string;
  type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT';
  quantityDrumsChanged: number;
  resultingQuantity: number;
  notes?: string;
  operatorEmail: string;
}

export interface StockStats {
  totalDrums: number;
  totalWeightKg: number;
  lowStockItemsCount: number;
}
