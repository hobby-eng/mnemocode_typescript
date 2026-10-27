// Separate cards are saved under their number alone, such as 01.pdf: a file name never shows the
// code that its card prints, so that a folder listing tells nothing of the backup (owner,
// 2026-10-27). The cards are drawn and saved as they are, into a folder of the test's own.

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { selectTemplate } from "../src/cards.js";
import { EncodedBackup } from "../src/core/encoded-backup.js";
import { backupCardContent } from "../src/export/backup-cards.js";
import { exportIndividualCards } from "../src/export/individual-cards.js";
import { exportSskrCards, nodeShareCards } from "../src/export/sskr-cards.js";
import { LONG_TEST_TIME_LIMIT_MS } from "./helpers/limits.js";
import { testFolder } from "./helpers/test-folders.js";
import { TEST_PHRASE } from "./helpers/test-phrase.js";
import { sskrVectors } from "./helpers/vectors.js";

describe("the files of separate cards", () => {
  it(
    "are named after the number of each card, never after its code",
    async () => {
      const folder = join(await testFolder("mnemocode-card-names-"), "cards");
      const backup = EncodedBackup.encode(TEST_PHRASE, [], "colors", "direct").backup;
      const template = selectTemplate("business-it", "colors");
      await exportIndividualCards(template, backupCardContent(backup), folder);
      // The eight codes of the phrase, then the one decoy of separate cards.
      expect((await readdir(folder)).sort()).toEqual([
        "01.pdf",
        "02.pdf",
        "03.pdf",
        "04.pdf",
        "05.pdf",
        "06.pdf",
        "07.pdf",
        "08.pdf",
        "09.pdf",
      ]);
    },
    LONG_TEST_TIME_LIMIT_MS,
  );

  it(
    "of a share are named so too, in the folder of the share",
    async () => {
      const folder = join(await testFolder("mnemocode-share-card-names-"), "cards");
      const share = sskrVectors().deterministic[0]!.shares[0]!;
      const cards = await nodeShareCards([share], { style: "it", pageSize: "business" });
      await exportSskrCards(cards, folder);
      expect(await readdir(folder)).toEqual(["collection-376C-1-1"]);
      // The ten colors of the share, then its one decoy.
      expect((await readdir(join(folder, "collection-376C-1-1"))).sort()).toEqual([
        "01.pdf",
        "02.pdf",
        "03.pdf",
        "04.pdf",
        "05.pdf",
        "06.pdf",
        "07.pdf",
        "08.pdf",
        "09.pdf",
        "10.pdf",
        "11.pdf",
      ]);
    },
    LONG_TEST_TIME_LIMIT_MS,
  );
});
