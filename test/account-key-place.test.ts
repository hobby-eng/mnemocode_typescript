import { describe, expect, expectTypeOf, it } from "vitest";
import {
  assertWalletEvidence,
  matchWalletEvidence,
  type DerivationLocation,
  type WalletEvidence,
} from "../src/bitcoin-evidence.js";
import { parseArguments } from "../src/cli/arguments.js";
import {
  givenWallet,
  walletEvidence,
  walletEvidenceArguments,
} from "../src/cli/bitcoin-options.js";
import { FIRST_RECEIVING_LOCATION } from "../src/core/wallet-evidence.js";
import { TEST_ACCOUNT_ZPUB, TEST_PHRASE } from "./helpers/test-phrase.js";

// An account extended public key is the key of its account: a branch and an index place an address
// in the account, so beside the key they would be ignored. They are refused before any secret, as
// the account, the branch, the index and the profiles are beside a master key.

describe("an account extended public key, placed by its account alone", () => {
  it("refuses --branch and --index beside --account-xpub", () => {
    for (const option of ["branch", "index"])
      expect(() => givenWallet({ "account-xpub": TEST_ACCOUNT_ZPUB, [option]: "0" })).toThrow(
        expect.objectContaining({
          code: "cli.bitcoin-options.account-key-no-branch-or-index",
          message: `--${option} places an address, a key or a WIF in its account; an account key has no branch or index.`,
        }),
      );
  });

  it("refuses a branch or an index in the evidence a host gives", () => {
    // A TypeScript host that gives a location with a branch and an index does not compile.
    type AccountKey = Extract<WalletEvidence, { kind: "account-xpub" }>;
    expectTypeOf<DerivationLocation>().not.toExtend<AccountKey["location"]>();
    const key = { kind: "account-xpub", value: TEST_ACCOUNT_ZPUB, profiles: ["native-segwit"] };
    for (const place of [{ branch: 0 }, { index: 0 }]) {
      const location = { network: "mainnet", account: 0, ...place };
      // A branch or an index beside an account key, fed on purpose as a JavaScript host could.
      expect(() => assertWalletEvidence({ ...key, location } as unknown as WalletEvidence)).toThrow(
        expect.objectContaining({
          code: "core.wallet-evidence.account-key-no-branch-or-index",
          message:
            "An account extended public key has no branch or index: its location is the network and the account.",
        }),
      );
    }
  });

  it("takes the account, the network and the profiles, and finds the key at its account", () => {
    using wallet = givenWallet({
      "account-xpub": TEST_ACCOUNT_ZPUB,
      account: "0",
      network: "mainnet",
      "bitcoin-profile": "native-segwit",
    });
    expect(wallet.evidence).toEqual({
      kind: "account-xpub",
      value: TEST_ACCOUNT_ZPUB,
      profiles: ["native-segwit"],
      location: { network: "mainnet", account: 0 },
    });
    // A wallet asked later is looked for among the account's first receiving addresses.
    expect(wallet.place.location).toEqual(FIRST_RECEIVING_LOCATION);
    expect(matchWalletEvidence(TEST_PHRASE, wallet.evidence!)).toMatchObject({
      matched: true,
      path: "m/84'/0'/0'",
    });
  });

  it("reads back from the options that give it, its account included", () => {
    const evidence: WalletEvidence = {
      kind: "account-xpub",
      value: TEST_ACCOUNT_ZPUB,
      profiles: ["native-segwit"],
      location: { network: "mainnet", account: 3 },
    };
    expect(walletEvidenceArguments(evidence)).toEqual([
      "--account-xpub",
      TEST_ACCOUNT_ZPUB,
      "--account",
      "3",
      "--bitcoin-profile",
      "native-segwit",
    ]);
    expect(walletEvidence(parseArguments(walletEvidenceArguments(evidence)))).toEqual(evidence);
  });
});
