import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toTradingViewSymbol } from "./tradingviewSymbol";

describe("toTradingViewSymbol", () => {
  it("maps US, London, and crypto tickers", () => {
    assert.equal(toTradingViewSymbol("AAPL", "NMS"), "NASDAQ:AAPL");
    assert.equal(toTradingViewSymbol("IBM", "NYQ"), "NYSE:IBM");
    assert.equal(toTradingViewSymbol("IQE.L"), "LSE:IQE");
    assert.equal(toTradingViewSymbol("BTC-USD"), "COINBASE:BTCUSD");
  });
});
