import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePickRow, parsePickRows } from "./pickParse";

describe("parsePickRow", () => {
  it("skips malformed rows instead of throwing", () => {
    assert.equal(parsePickRow(null), null);
    assert.equal(parsePickRow({ ticker: "AAPL" }), null);
  });

  it("normalizes theme slugs and drops invalid tweet URLs", () => {
    const pick = parsePickRow({
      ticker: "nvda",
      name: "NVIDIA",
      theme: "AI Semi",
      stance: "long",
      conviction: "high",
      thesis_short: "Accelerators",
      thesis_long: "Data center GPUs",
      first_mentioned_at: "2026-01-01",
      tweet_url: "not-a-url",
      tweet_id: "1",
      exited_at: null,
      exit_price: null,
    });
    assert.ok(pick);
    assert.equal(pick?.ticker, "NVDA");
    assert.equal(pick?.theme, "ai-semi");
    assert.equal(pick?.tweet_url, "");
  });

  it("dedupes tickers", () => {
    const rows = parsePickRows([
      {
        ticker: "AAPL",
        name: "Apple",
        theme: "consumer",
        stance: "long",
        conviction: "high",
        thesis_short: "Hardware",
        thesis_long: "Hardware",
        first_mentioned_at: "2026-01-01",
        tweet_url: "https://x.com/a/status/1",
        tweet_id: "1",
        exited_at: null,
        exit_price: null,
      },
      {
        ticker: "AAPL",
        name: "Apple duplicate",
        theme: "consumer",
        stance: "long",
        conviction: "low",
        thesis_short: "Dup",
        thesis_long: "Dup",
        first_mentioned_at: "2026-01-02",
        tweet_url: "https://x.com/a/status/2",
        tweet_id: "2",
        exited_at: null,
        exit_price: null,
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.thesis_short, "Hardware");
  });
});
