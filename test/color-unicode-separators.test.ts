import { describe, expect, it } from "vitest";
import { colorSymbolsOf, unicodeToColorCodes } from "../src/core/colors.js";
import { EncodedForm } from "../src/core/encoded-form.js";

// Color Unicode is read with one rule of separators, whether written as the codes' digits or as
// the Private Use symbols themselves: white space, commas, semicolons and the # before a color
// (core/code-text.ts), as every reader of codes takes them (owner, 2026-10-27).
describe("Color Unicode separators", () => {
  it("reads Private Use symbols apart at white space, commas, semicolons and #", () => {
    expect(colorSymbolsOf("\u{E000},\u{F8FF}; #?")).toEqual(["\u{E000}", "\u{F8FF}", "?"]);
    expect(unicodeToColorCodes("\u{E000}\u{E000}, \u{E000}\u{E001};\u{E000}\u{E002}")).toEqual([
      "#000000",
      "#000001",
      "#000002",
    ]);
  });

  it("guesses symbols with a # before them as Color Unicode, not as colors", () => {
    expect(EncodedForm.likely("#\u{E000}\u{E000} #\u{E000}\u{E001}")).toBe("colors-unicode");
    expect(EncodedForm.likely("#01AB63 #000000")).toBe("colors");
  });

  it("reads codes written in digits apart at the same separators", () => {
    expect(unicodeToColorCodes("E000E000, E000 E001;#E000E002")).toEqual([
      "#000000",
      "#000001",
      "#000002",
    ]);
  });
});
