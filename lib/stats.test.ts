import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getHeadlineStats } from "./stats";

describe("getHeadlineStats", () => {
  it("returns empty-desk placeholders instead of 0% YTD", () => {
    const stats = getHeadlineStats([]);
    assert.equal(stats.total, 0);
    assert.equal(stats.avg_ytd_pct_longs, null);
    assert.equal(stats.best, null);
    assert.equal(stats.worst, null);
    assert.equal(stats.highest_conviction_count, 0);
  });

  it("averages longs only and reports tape extremes", () => {
    const stats = getHeadlineStats([
      { ticker: "AAA", stance: "long", conviction: "high", ytd_pct: 10 },
      { ticker: "BBB", stance: "long", conviction: "medium", ytd_pct: 20 },
      { ticker: "CCC", stance: "bearish", conviction: "low", ytd_pct: -50 },
    ]);
    assert.equal(stats.total, 3);
    assert.equal(stats.long_count, 2);
    assert.equal(stats.other_count, 1);
    assert.equal(stats.avg_ytd_pct_longs, 15);
    assert.deepEqual(stats.best, { ticker: "BBB", ytd_pct: 20 });
    assert.deepEqual(stats.worst, { ticker: "CCC", ytd_pct: -50 });
    assert.equal(stats.highest_conviction_count, 1);
  });
});
