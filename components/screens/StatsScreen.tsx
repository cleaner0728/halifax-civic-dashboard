import GasPriceCard from '@/components/GasPriceCard';
import GroceryPriceCard from '@/components/GroceryPriceCard';
import { IconChart, IconInbox } from '@/components/icons';
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
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 mb-6">
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-widest">Stats</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground mt-0.5">Cost of Living</h2>
            <p className="text-sm text-foreground/50 mt-0.5">
              Halifax & Nova Scotia · gas, groceries, more soon
            </p>
          </div>
          <IconChart className="w-7 h-7 text-foreground/30 shrink-0" />
        </div>

        {/* On desktop the two charts sit side by side; mobile stays single
            column. Each card already manages its own internal layout. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <GasPriceCard data={gasPrices} />
          {groceryPrices.items.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card/60 text-center py-10 text-foreground/40">
              <IconInbox className="w-8 h-8 mb-2 text-foreground/25" />
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
