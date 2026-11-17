// main.ts — BTC race bot, akun 2 (wnezloc / gentle-wren-52).
// Competition: btc-race-24h-20261117-0603. Strategy: dip-buy 1.5% + take-profit 1%,
// stop-loss 1.5%. Dev-window backtest (17 Nov dev bars, 1,440 bars): +$19.37, 5 trades.
//
// How it trades: the harness sends one JSON line per minute (hello, then a batch
// per bar, then done). On each batch we look at the bar's close and answer with
// orders. We track the rolling peak close over all history. When flat and the
// close has fallen 1.5% from the peak, we buy with all cash. When holding, we
// sell everything when the close has risen 1% above the average entry price,
// or fallen 1.5% below it. One asset (CBBTC), long-only, full size, at most one
// open position. Deterministic: no clock, no randomness, no environment, no
// network — the same bars always produce the same orders.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const DROP = 0.015; // buy when the close is 1.5% below the rolling peak
const BOUNCE = 0.01; // sell when the close is 1% above the entry price
const STOP = 0.015; // sell when the close is 1.5% below the entry price
const MAX_SLIPPAGE_BPS = 100; // 1% past the latest close, as the kit baselines use

// Rolling peak of closes. Closes are exact integers below 2^53, so float math
// on them is exact, matching the backtester.
let peak = 0;

// Average entry price of the current position, in price-scale units, from the
// position's cost (fees included) divided by its quantity.
function entryPrice(state: BarsState): number | null {
  const pos = state.positions.get(SYMBOL);
  if (!pos || pos.qty === 0n) return null;
  const sym = state.symbols.get(SYMBOL);
  if (!sym) return null;
  const cost = Number(pos.cost);
  const qty = Number(pos.qty);
  const quoteScale = state.hello.capital.quote_scale;
  return (cost * 10 ** (sym.qty_scale + sym.price_scale)) / (qty * 10 ** quoteScale);
}

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    // Warm-up batches trade nothing: any order decided on one is rejected.
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    const c = Number(close);
    if (c > peak) peak = c;

    const pos = state.positions.get(SYMBOL);
    const held = pos ? pos.qty : 0n;

    if (held === 0n) {
      // Flat: buy the dip with all cash when the close is DROP below the peak.
      if (c <= peak * (1 - DROP)) {
        return [
          {
            side: 'buy',
            symbol: SYMBOL,
            notional_quote_units: state.cash,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          },
        ];
      }
      return [];
    }

    // Holding: sell everything on take-profit, on stop-loss, nothing else.
    const entry = entryPrice(state);
    if (entry === null) return [];
    if (c >= entry * (1 + BOUNCE) || c <= entry * (1 - STOP)) {
      return [
        {
          side: 'sell',
          symbol: SYMBOL,
          qty: held,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        },
      ];
    }
    return [];
  },
});
