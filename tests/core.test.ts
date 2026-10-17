import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CODE_PATTERN, generateVerificationCode, hashVerificationCode, generateSignupToken, hashToken,
  rateLimitKey, safeEqualHex, parseSignupCookie,
} from "../src/lib/auth/codes.ts";
import { normalizeEduEmail, domainCandidates, registrableEduDomain, maskEmail } from "../src/lib/email/normalize.ts";
import { safeNext } from "../src/lib/auth/redirect.ts";
import { contrastRatio, readableOn, themeVars } from "../src/lib/theme/colors.ts";

const PEPPER = "x".repeat(40);

test("codes are exactly six digits and keep leading zeros", () => {
  for (let i = 0; i < 20000; i++) assert.match(generateVerificationCode(), CODE_PATTERN);
  const sawLeadingZero = Array.from({ length: 20000 }, generateVerificationCode).some((c) => c.startsWith("0"));
  assert.ok(sawLeadingZero, "expected some codes with a leading zero");
});

test("codes are not trivially repetitive", () => {
  const set = new Set(Array.from({ length: 5000 }, generateVerificationCode));
  assert.ok(set.size > 4900);
});

test("code hash is bound to challenge and pepper", () => {
  const a = hashVerificationCode(PEPPER, "c1", "012345");
  assert.equal(a, hashVerificationCode(PEPPER, "c1", "012345"));
  assert.notEqual(a, hashVerificationCode(PEPPER, "c2", "012345"));
  assert.notEqual(a, hashVerificationCode("y".repeat(40), "c1", "012345"));
  assert.ok(!a.includes("012345"));
  assert.ok(safeEqualHex(a, a));
  assert.ok(!safeEqualHex(a, hashVerificationCode(PEPPER, "c1", "012346")));
});

test("signup cookie round-trips and rejects junk", () => {
  const token = generateSignupToken();
  const id = "3f1a2b3c-1111-4222-8333-444455556666";
  assert.deepEqual(parseSignupCookie(`${id}.${token}`), { challengeId: id, token });
  assert.equal(parseSignupCookie(undefined), null);
  assert.equal(parseSignupCookie(`${id}.short`), null);
  assert.equal(parseSignupCookie(`not-a-uuid.${token}`), null);
  assert.equal(hashToken(token).length, 64);
});

test("rate limit keys hide raw values", () => {
  const k = rateLimitKey(PEPPER, "ip", "203.0.113.9");
  assert.ok(k.startsWith("ip:"));
  assert.ok(!k.includes("203.0.113.9"));
});

test("edu email normalization", () => {
  assert.deepEqual(normalizeEduEmail("  Bama.Fan+Books@Crimson.UA.edu "), {
    ok: true, email: "bama.fan+books@crimson.ua.edu", canonical: "bama.fan@crimson.ua.edu", domain: "crimson.ua.edu",
  });
  assert.deepEqual(normalizeEduEmail("someone@gmail.com"), { ok: false, reason: "not_edu" });
  assert.deepEqual(normalizeEduEmail("someone@edu"), { ok: false, reason: "invalid" });
  for (const bad of ["a@@ua.edu", "@ua.edu", ".a@ua.edu", "a..b@ua.edu", "a@-ua.edu", "a@ua..edu", "a b@ua.edu"]) {
    assert.equal(normalizeEduEmail(bad).ok, false, bad);
  }
  assert.equal(normalizeEduEmail("a@ua.edu.evil.com").ok, false);
});

test("domain candidates mirror the SQL resolver", () => {
  assert.deepEqual(domainCandidates("mail.cs.ua.edu"), ["mail.cs.ua.edu", "cs.ua.edu", "ua.edu"]);
  assert.equal(registrableEduDomain("crimson.ua.edu"), "ua.edu");
  assert.equal(maskEmail("alex@crimson.ua.edu"), "al••@crimson.ua.edu");
});

test("safeNext blocks open redirects", () => {
  assert.equal(safeNext("/app/listings?x=1"), "/app/listings?x=1");
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, "app"]) {
    assert.equal(safeNext(bad as string), "/app", String(bad));
  }
});

test("theme picks accessible foregrounds", () => {
  for (const c of ["#9E1B32", "#1F6F5C", "#C9A227", "#FFFFFF", "#000000", "#828A8F"]) {
    assert.ok(contrastRatio(c, readableOn(c)) >= 4.5, `${c} -> ${contrastRatio(c, readableOn(c)).toFixed(2)}`);
  }
  assert.equal(readableOn("#9E1B32"), "#FFFFFF");
  const vars = themeVars({ primary_color: "#9E1B32", secondary_color: "#828A8F" });
  assert.equal(vars["--campus"], "#9E1B32");
  assert.equal(themeVars({ primary_color: "red", secondary_color: "x" })["--campus"], "#2F5D8A");
});
