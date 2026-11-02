/** Check the external boolean callback contract of MissingCodes.run, with public BIP39 data. */
import assert from "node:assert/strict";
import { MissingCodes } from "../../../src/core/missing-codes.ts";

const codes = MissingCodes.read("abandon ".repeat(11) + "about|abandon", "english", "direct");
let failures = 0;
try {
  for (const [name, value, wanted] of [
    ["boolean-false", false, 0],
    ["boolean-true", true, 1],
    ["object-matched-false", { matched: false }, null],
    ["string-false", "false", null],
  ]) {
    let reached = false;
    let result;
    try {
      result = await codes.run({
        check: () => {
          reached = true;
          return value;
        },
        maxFound: 1,
      });
      assert.equal(reached, true);
      assert.equal(result.count, 1);
      console.log(JSON.stringify({ name, count: result.count, passed: result.passed, kept: result.found.length }));
      if (wanted === null) failures += 1;
      else assert.equal(result.passed, wanted);
    } catch (error) {
      assert.equal(reached, true, "The public callback must have been reached.");
      if (wanted !== null) throw error;
      assert.ok(error instanceof TypeError && typeof error.code === "string");
      console.log(JSON.stringify({ name, refusedWith: error.code }));
    } finally {
      for (const backup of result?.found ?? []) backup.wipe();
    }
  }
} finally {
  codes.wipe();
}
console.log(JSON.stringify({ malformedAnswersAccepted: failures }));
process.exitCode = failures === 0 ? 0 : 1;
