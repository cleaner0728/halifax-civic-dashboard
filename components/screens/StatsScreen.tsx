import GasPriceCard from '@/components/GasPriceCard';
import GroceryPriceCard from '@/components/GroceryPriceCard';
import type { GasPriceData } from '@/lib/fetchers/gas';
import type { GroceryPriceData } from '@/lib/fetchers/grocery';

type Props = {
  gasPrices: GasPriceData;
  groceryPrices: GroceryPriceData;
};

export default function StatsScreen({ gasPrices, groceryPrices }: Props) {
  return (
    <div className="pt-14 md:pt-24 pb-24 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-2">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 dark:from-emerald-900 dark:via-green-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">Stats</p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">Cost of Living</h2>
              <p className="text-base text-white/70 mt-1">
                Halifax & Nova Scotia · gas, groceries, more soon
              </p>
            </div>
            <div className="text-5xl">📊</div>
          </div>
        </div>

        {/* On desktop the two charts sit side by side; mobile stays single
            column. Each card already manages its own internal layout. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <GasPriceCard data={gasPrices} />
          {groceryPrices.items.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/60 text-center py-10 text-foreground/40">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-base font-medium">Could not load grocery price data.</p>
              <p className="text-sm mt-1">Stats Canada API may be temporarily unavailable.</p>
            </div>
          ) : (
            <GroceryPriceCard data={groceryPrices} />
          )}
        </div>
      </div>
    </div>
  );
}
