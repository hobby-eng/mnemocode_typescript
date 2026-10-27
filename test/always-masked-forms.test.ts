import { describe, expect, it } from "vitest";
import { EncodedBackup } from "../src/core/encoded-backup.js";
import { TEST_PHRASE } from "./helpers/test-phrase.js";

// English words and word numbers are always masked: unmasked, they are the seed phrase itself.
// The library refuses them without a Seedshift for every front end, before any secret, as the
// menu has always kept them from it (owner, 2026-10-27).
describe("forms that are always masked", () => {
  it("refuses English words and word numbers without a Seedshift", () => {
    for (const format of ["english", "indexes"] as const) {
      expect(() => EncodedBackup.assertEncodable("direct", {}, format)).toThrow(
        expect.objectContaining({ code: "core.encoded-backup.form-always-masked" }),
      );
      expect(() => EncodedBackup.encode(TEST_PHRASE, [], format, "direct")).toThrow(
        "English words and word numbers are always masked: unmasked, they are the seed phrase itself. Choose a Seedshift, or Unicode codes or colors.",
      );
    }
  });

  it("encodes the other forms without a Seedshift, and every form with one", () => {
    expect(() => EncodedBackup.assertEncodable("direct", {}, "unicode")).not.toThrow();
    expect(() => EncodedBackup.assertEncodable("seedshift", {}, "english")).not.toThrow();
  });
});
