# btc-race-24h-20261117-akun1

BTC race trading bot for make.fun competition `btc-race-24h-20261117-0603`
(akun 2, wnezloc / lively-sparrow-53).

Strategy: dip-buy. Track the rolling peak close; when flat and the close has
fallen 1.5% from the peak, buy with all cash. When holding, sell everything
when the close has risen 2% above the average entry price, or fallen 1.5%
below it. Long-only, one asset (CBBTC), full size, deterministic.

Dev window (17 Nov, 1,440 bars): +$19.40 net PnL, 3 trades — passes the dev
gate (PnL > $0).

Run: `main.ts` (Node 22, standard library only) speaks
agent-fun/bars-replay/v1 via `vendor/makefun-bars.ts` (byte-identical copy of
the kit SDK shim).
