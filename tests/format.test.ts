import { test } from "node:test";
import assert from "node:assert/strict";
import { clockTime, dollarsToCents, formatBudget, initials, splitTags, timeAgo } from "../src/lib/format.ts";

const NOW = Date.parse("2026-10-17T12:00:00Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

test("timeAgo: buckets from just now to a date", () => {
  assert.equal(timeAgo(ago(5), NOW), "just now");
  assert.equal(timeAgo(ago(5 * 60), NOW), "5m");
  assert.equal(timeAgo(ago(3 * 3600), NOW), "3h");
  assert.equal(timeAgo(ago(2 * 86400), NOW), "2d");
  assert.equal(timeAgo(ago(30 * 86400), NOW), "Sep 17");
  assert.equal(timeAgo(null, NOW), "");
  assert.equal(timeAgo("not a date", NOW), "");
  assert.equal(timeAgo(new Date(NOW + 60_000).toISOString(), NOW), "just now", "future timestamps don't go negative");
});

test("dollarsToCents: parses money input, rejects junk", () => {
  assert.equal(dollarsToCents("25"), 2500);
  assert.equal(dollarsToCents("$12.50"), 1250);
  assert.equal(dollarsToCents("1,200"), 120000);
  assert.equal(dollarsToCents("0"), 0);
  assert.equal(dollarsToCents(""), null);
  assert.equal(dollarsToCents("   "), null);
  assert.equal(dollarsToCents("abc"), null);
  assert.equal(dollarsToCents("-5"), null);
  assert.equal(dollarsToCents(null), null);
});

test("formatBudget", () => {
  assert.equal(formatBudget(null), "Flexible budget");
  assert.equal(formatBudget(2500), "Budget $25");
  assert.equal(formatBudget(1250), "Budget $12.50");
});

test("initials and splitTags", () => {
  assert.equal(initials("Maya Brooks"), "MB");
  assert.equal(initials("  cher "), "C");
  assert.equal(initials(""), "?");
  assert.equal(initials(null), "?");
  assert.deepEqual(splitTags("#ECE, weekend  #Budget"), ["ece", "weekend", "budget"]);
  assert.deepEqual(splitTags(""), []);
});

test("clockTime formats a time of day", () => {
  assert.match(clockTime("2026-10-17T15:42:00Z"), /^\d{1,2}:\d{2}\s?(AM|PM)$/);
});
