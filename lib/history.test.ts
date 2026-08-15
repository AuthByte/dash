import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  capHistory,
  dateOnly,
  isAllowedTicker,
  sliceHistory,
  snapToSession,
} from "./history";

describe("sliceHistory", () => {
  const history = [
    { date: "2025-12-31", close: 1 },
    { date: "2026-01-15", close: 2 },
    { date: "2026-07-01", close: 3 },
    { date: "2026-08-14", close: 4 },
  ];
  const now = new Date("2026-08-14T12:00:00Z");

  it("keeps YTD points", () => {
    const sliced = sliceHistory(history, "YTD", now);
    assert.deepEqual(
      sliced.map((p) => p.date),
      ["2026-01-15", "2026-07-01", "2026-08-14"],
    );
  });

  it("caps to the most recent points", () => {
    assert.deepEqual(capHistory([1, 2, 3, 4], 2), [3, 4]);
  });
});

describe("snapToSession", () => {
  it("snaps weekend mentions onto Friday", () => {
    const sessions = new Set(["2026-08-13", "2026-08-14"]);
    assert.equal(snapToSession("2026-08-15", sessions), "2026-08-14");
    assert.equal(snapToSession("2026-08-14", sessions), "2026-08-14");
  });

  it("matches tweet days against timezone-stamped history dates", () => {
    const sessions = new Set(["2026-03-30T00:00:00-04:00", "2026-03-31T00:00:00-04:00"]);
    assert.equal(snapToSession("2026-03-30T02:19:36+00:00", sessions), "2026-03-30");
    assert.equal(dateOnly("2026-03-30T00:00:00-05:00"), "2026-03-30");
  });
});

describe("isAllowedTicker", () => {
  it("accepts Yahoo-style symbols and rejects junk", () => {
    assert.equal(isAllowedTicker("AAPL"), true);
    assert.equal(isAllowedTicker("IQE.L"), true);
    assert.equal(isAllowedTicker("BTC-USD"), true);
    assert.equal(isAllowedTicker("../etc/passwd"), false);
    assert.equal(isAllowedTicker("A".repeat(21)), false);
  });
});
