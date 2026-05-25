import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type GasPriceEntry = {
  date: string;    // YYYY-MM-DD
  regular: number; // ¢/L, Zone 1 max regulated price
  diesel: number;  // ¢/L, Zone 1 max regulated price
};

export type GasPriceData = {
  history: GasPriceEntry[];
  updatedAt?: string;
};

export async function fetchGasPrices(): Promise<GasPriceData> {
  try {
    const raw = await readFile(resolve('public/gas-prices.json'), 'utf8');
    const data = JSON.parse(raw) as GasPriceData;
    if (!Array.isArray(data.history)) return { history: [] };
    return data;
  } catch {
    return { history: [] };
  }
}
