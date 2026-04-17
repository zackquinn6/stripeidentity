import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertToolioBooqableBaseUrl,
  normalizeBooqableBaseUrl,
  TOOLIO_BOOQABLE_BASE_URL,
} from "./toolioBooqableOrigin.js";

describe("assertToolioBooqableBaseUrl", () => {
  it("accepts canonical Toolio v4 API root", () => {
    const r = assertToolioBooqableBaseUrl("https://toolio-inc.booqable.com/api/4");
    assert.equal(r.ok, true);
    assert.equal(r.normalized, TOOLIO_BOOQABLE_BASE_URL);
  });

  it("accepts v4 root with trailing slash stripped", () => {
    const r = assertToolioBooqableBaseUrl("https://toolio-inc.booqable.com/api/4/");
    assert.equal(r.ok, true);
    assert.equal(r.normalized, TOOLIO_BOOQABLE_BASE_URL);
  });

  it("accepts legacy host-only Toolio origin and normalizes to v4 root", () => {
    const r = assertToolioBooqableBaseUrl("https://toolio-inc.booqable.com");
    assert.equal(r.ok, true);
    assert.equal(r.normalized, TOOLIO_BOOQABLE_BASE_URL);
  });

  it("accepts legacy host with trailing slash stripped", () => {
    const r = assertToolioBooqableBaseUrl("https://toolio-inc.booqable.com/");
    assert.equal(r.ok, true);
    assert.equal(r.normalized, TOOLIO_BOOQABLE_BASE_URL);
  });

  it("rejects other hosts", () => {
    const r = assertToolioBooqableBaseUrl("https://other.booqable.com");
    assert.equal(r.ok, false);
    assert.ok(r.error && r.error.includes("other"));
  });

  it("rejects unset", () => {
    const r = assertToolioBooqableBaseUrl("");
    assert.equal(r.ok, false);
  });
});

describe("normalizeBooqableBaseUrl", () => {
  it("trims and strips trailing slashes on legacy host", () => {
    assert.equal(
      normalizeBooqableBaseUrl("  https://toolio-inc.booqable.com///  "),
      TOOLIO_BOOQABLE_BASE_URL
    );
  });

  it("trims and strips trailing slashes on v4 root", () => {
    assert.equal(
      normalizeBooqableBaseUrl("  https://toolio-inc.booqable.com/api/4///  "),
      TOOLIO_BOOQABLE_BASE_URL
    );
  });
});
