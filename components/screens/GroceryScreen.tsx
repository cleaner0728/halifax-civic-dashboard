import GroceryPriceCard from '@/components/GroceryPriceCard';
import type { GroceryPriceData } from '@/lib/fetchers/grocery';

type Props = {
  groceryPrices: GroceryPriceData;
};

export default function GroceryScreen({ groceryPrices }: Props) {
  return (
    <div className="pt-20 pb-4 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 dark:from-emerald-900 dark:via-green-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">Prices</p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">Grocery Prices</h2>
              <p className="text-base text-white/70 mt-1">
                Nova Scotia monthly averages · {groceryPrices.items.length} categories · Stats Canada
              </p>
            </div>
            <div className="text-5xl">🛒</div>
          </div>
        </div>

        {groceryPrices.items.length === 0 ? (
          <div className="text-center py-16 text-foreground/40">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-lg font-medium">Could not load grocery price data.</p>
            <p className="text-sm mt-1">Stats Canada API may be temporarily unavailable.</p>
          </div>
        ) : (
          <GroceryPriceCard data={groceryPrices} />
        )}
      </div>
    </div>
  );
}
