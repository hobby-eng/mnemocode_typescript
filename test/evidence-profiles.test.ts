import { describe, expect, it } from "vitest";
import { BITCOIN } from "../src/core/coins/bitcoin-like.js";
import { assertWalletEvidence } from "../src/core/wallet-evidence.js";
import { TEST_ADDRESS } from "./helpers/test-phrase.js";

// An address of a type that none of the selected profiles writes could never match: a search would
// report every candidate as not matched. It is refused before any secret is typed.
// TEST_ADDRESS is a native SegWit address (BIP84).
const LOCATION = { network: "mainnet", account: 0, branch: 0, index: 0 } as const;

describe("an address checked against the profiles chosen for it", () => {
  it("refuses an address that none of the selected profiles writes", () => {
    for (const profiles of [["legacy"], ["nested-segwit", "taproot"]] as const)
      expect(() =>
        assertWalletEvidence(
          { kind: "address", value: TEST_ADDRESS, profiles, location: LOCATION },
          [BITCOIN],
        ),
      ).toThrow(
        expect.objectContaining({
          code: "core.wallet-evidence.address-outside-profiles",
          message:
            "The address is a native-segwit address, which none of the selected Bitcoin address profiles writes.",
        }),
      );
  });

  it("takes an address that one of the selected profiles writes", () => {
    expect(() =>
      assertWalletEvidence(
        {
          kind: "address",
          value: TEST_ADDRESS,
          profiles: ["legacy", "native-segwit"],
          location: LOCATION,
        },
        [BITCOIN],
      ),
    ).not.toThrow();
  });
});
