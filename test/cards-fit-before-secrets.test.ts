// The cards are checked in the form they are printed in, before any secret is asked or read: the
// cards of Unicode codes too, a phrase in a file too, and without --format of sskr-export every
// form that a share keeps (owner, 2026-10-27). Public test data only: the BIP39 test phrase and
// the published shares of the longest secret.

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArguments } from "../src/cli/arguments.js";
import { prepareEncode } from "../src/cli/encode-command.js";
import { runSskrExport } from "../src/cli/sskr-export-command.js";
import { SSKR_LONG_VECTOR } from "../src/sskr/known-answers.js";
import { writeShare, type ShareFormat } from "../src/sskr/transport.js";
import { matching } from "./helpers/matchers.js";
import { testFolder } from "./helpers/test-folders.js";
import { TEST_PHRASE } from "./helpers/test-phrase.js";

/** A company too long for its line on a business card. */
const COMPANY = "Northern Atlantic Consolidated Engineering and Logistics Holdings";

/** The options of Encode's cards with COMPANY, saved as a PDF in `folder`, in form `format`. */
function cardsWithCompany(format: string, folder: string): string[] {
  return [
    "--mode",
    "direct",
    "--format",
    format,
    "--template",
    "business-it",
    "--card-company",
    COMPANY,
    "--pdf",
    join(folder, "never.pdf"),
  ];
}

/** A file in `folder` with the published shares of the longest secret written in `format`. */
async function sharesIn(folder: string, format: ShareFormat): Promise<string> {
  const shares = join(folder, "shares.txt");
  await writeFile(
    shares,
    SSKR_LONG_VECTOR.shares.map((share) => `${writeShare(share, format)}\n`).join(""),
  );
  return shares;
}

describe("cards checked in their form before any secret", () => {
  it("refuses a detail too long for the cards of Unicode codes", async () => {
    const folder = await testFolder("mnemocode-cards-fit-");
    await expect(
      prepareEncode(parseArguments(["--ask-secrets", ...cardsWithCompany("3", folder)])),
    ).rejects.toThrow("too long to fit");
  });

  it("refuses a detail too long for its card before a phrase in a file is read", async () => {
    const folder = await testFolder("mnemocode-cards-fit-");
    const phrase = join(folder, "phrase.txt");
    await writeFile(phrase, `${TEST_PHRASE}\n`);
    await expect(
      prepareEncode(parseArguments(["--mnemonic-file", phrase, ...cardsWithCompany("5", folder)])),
    ).rejects.toThrow("too long to fit");
  });

  it("refuses, before the shares are read, cards that cannot print a share in its own form", async () => {
    const folder = await testFolder("mnemocode-cards-fit-");
    await expect(
      runSskrExport(
        parseArguments([
          "--share-file",
          // Unicode codes keep their form without --format: more codes than the tile has samples.
          await sharesIn(folder, "unicode"),
          "--template",
          "material-tile",
          "--pdf",
          join(folder, "never.pdf"),
        ]),
      ),
    ).rejects.toMatchObject({
      code: "cli.sskr-export-command.cards-own-form-refused",
      message: matching(/Unicode codes; --format colors .*distinct samples/u),
    });
  });

  it("refuses a detail too long for its share card as it does with --format", async () => {
    const folder = await testFolder("mnemocode-cards-fit-");
    await expect(
      runSskrExport(
        parseArguments([
          "--share-file",
          await sharesIn(folder, "colors"),
          "--card-company",
          COMPANY,
          "--pdf",
          join(folder, "never.pdf"),
        ]),
      ),
    ).rejects.toMatchObject({
      code: "export.sskr-render.share-cards-cannot-printed-every-seed-phrase-longest",
      message: matching(/too long to fit/u),
    });
  });
});
