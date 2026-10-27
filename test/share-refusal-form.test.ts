import { describe, expect, it } from "vitest";
import { ShareSet } from "../src/sskr/share-set.js";
import { readShare, writeShare } from "../src/sskr/transport.js";
import { sskrVectors } from "./helpers/vectors.js";

// A share that reads as none is refused by the reader of the form its text is written in (owner,
// 2026-10-27): codes apart or run together, most of them the Unicode codes of words, by the reader
// of Unicode codes, although colors, which come first of the hexadecimal forms, could read the same
// digits.
// Public data only: the repository's SSKR vectors.
const SHARE = sskrVectors().official.shares[0]!;

/** The elements of SHARE written in `format`, apart, as the writer of shares separates them. */
function elementsOf(format: "unicode" | "colors"): string[] {
  return writeShare(SHARE, format).split(" ");
}

/** The digits of `text`, its separators left out, apart in codes of four. */
function inFours(text: string): string[] {
  return text.replace(/[#\s]/gu, "").match(/.{4}/gu)!;
}

describe("the refusal of a damaged share", () => {
  it("refuses Unicode codes, apart or run together, as the reader of Unicode codes does", () => {
    const codes = elementsOf("unicode");
    const truncated = {
      code: "sskr.transport.mixed-share-refused",
      message: "Unsupported or truncated SSKR share in word numbers or Unicode codes.",
    };
    expect(() => readShare(codes.slice(0, -1).join(" "))).toThrow(
      expect.objectContaining(truncated),
    );
    expect(() => readShare(codes.slice(0, -1).join(""))).toThrow(
      expect.objectContaining(truncated),
    );
    // 9FFF is no word's code: the refusal names its place.
    expect(() => readShare(["9FFF", ...codes.slice(1)].join(" "))).toThrow(
      expect.objectContaining({
        code: "core.words.unicode-code-not-bip39-word",
        message: "The Unicode code at place 1 is not a BIP39 word.",
      }),
    );
    // A code that lost a digit, apart, and the codes run together that lost or gained one at
    // their start: the codes after the slip are still words' codes, one place along.
    const notWhole = {
      code: "core.words.unicode-codes-four-hexadecimal-digits-each-separated-by",
    };
    expect(() => readShare([codes[0]!.slice(0, -1), ...codes.slice(1)].join(" "))).toThrow(
      expect.objectContaining(notWhole),
    );
    const joined = codes.join("");
    for (const slipped of [joined.slice(1), `${joined.charAt(0)}${joined}`])
      expect(() => readShare(slipped)).toThrow(expect.objectContaining(notWhole));
  });

  it("refuses Unicode codes with a letter typed for a digit as Unicode codes", () => {
    const codes = elementsOf("unicode");
    const typo = codes.findIndex((code) => code.includes("0"));
    const mistyped = codes.map((code, place) => (place === typo ? code.replace("0", "O") : code));
    for (const spacing of [" ", ""])
      expect(() => readShare(mistyped.join(spacing))).toThrow(
        expect.objectContaining({
          code: "core.words.unicode-codes-four-hexadecimal-digits-each-separated-by",
        }),
      );
  });

  it("is a refusal of the shares, which a host asks others for (ShareSet.isRefusal)", () => {
    const codes = elementsOf("unicode");
    for (const damaged of [
      ["9FFF", ...codes.slice(1)],
      [codes[0]!.slice(0, -1), ...codes.slice(1)],
    ]) {
      let refusal: unknown;
      try {
        readShare(damaged.join(" "));
      } catch (error) {
        refusal = error;
      }
      expect(ShareSet.isRefusal(refusal)).toBe(true);
    }
  });

  it("refuses colors and Color Unicode codes as the reader of colors does, as before", () => {
    const colors = elementsOf("colors");
    const colorRecord = {
      code: "sskr.transport.mixed-share-refused",
      message: "Unsupported or truncated SSKR color record.",
    };
    for (const spacing of [" ", ""])
      expect(() => readShare(colors.slice(0, -1).join(spacing))).toThrow(
        expect.objectContaining(colorRecord),
      );
    expect(() => readShare([colors[0]!.slice(0, -1), ...colors.slice(1)].join(" "))).toThrow(
      expect.objectContaining({
        code: "sskr.transport.invalid-sskr-rgb-codes-preserve-their-printed-order",
      }),
    );
    // Codes of four digits too, but no word's: Color Unicode, apart or run together, is not taken
    // for Unicode codes, nor where one of its codes is mistyped as a word's.
    const points = inFours(writeShare(SHARE, "colors-unicode"));
    for (const spacing of [" ", ""])
      expect(() => readShare(points.slice(0, -2).join(spacing))).toThrow(
        expect.objectContaining(colorRecord),
      );
    const mistyped = [points[0], elementsOf("unicode")[0], ...points.slice(2)];
    expect(() => readShare(mistyped.join(" "))).toThrow(
      expect.objectContaining({
        code: "sskr.transport.invalid-sskr-rgb-codes-preserve-their-printed-order",
      }),
    );
  });

  it("reads colors apart in codes of four, a word's code among them, as colors", () => {
    expect(readShare(inFours(writeShare(SHARE, "colors")).join(" "))).toEqual({
      ur: SHARE,
      format: "colors",
    });
  });
});
