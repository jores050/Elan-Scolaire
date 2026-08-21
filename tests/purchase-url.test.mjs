import assert from "node:assert/strict";
import test from "node:test";
import { getAbsoluteHttpUrl } from "../src/lib/config.ts";

test("purchase URL rejects relative and protocol-less values", () => {
  assert.equal(getAbsoluteHttpUrl("maketou.com"), "");
  assert.equal(getAbsoluteHttpUrl("/maketou.com"), "");
  assert.equal(getAbsoluteHttpUrl("javascript:alert(1)"), "");
  assert.equal(getAbsoluteHttpUrl("https://maketou.example/commande"), "https://maketou.example/commande");
});
