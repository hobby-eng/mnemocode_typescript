// What the recorders of recovery and of its shares share: the public phrases, fingerprints and
// dates, the clock, and the plain forms of a wallet and of a finding.

/** The public phrase, and another. */
export const TWELVE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
export const LEGAL = "legal winner thank year wave sausage worth useful legal winner thank yellow";
/** The master fingerprint of the public phrase, and one that matches nothing here. */
export const FINGERPRINT = "73c5da0a";
export const NO_FINGERPRINT = "00000000";
/** The date the public phrase is masked with. */
export const DATE = "23-09-2026";
/** The most candidates shown of a recorded list: the rest are counted and hashed. */
export const SHOWN = 8;
/** A public seed in place of randomness: only the recorder uses it. */
export const SEED = 7;
/** What the recorder calls the host's reader of an encoded phrase. */
export const DECODE = "Decode";

/** A clock of fixed steps: each read one second later, in milliseconds. */
export function steps() {
  let now = 0;
  return () => {
    now += 1000;
    return now;
  };
}

/** The wallet of `fingerprint`, as the command line checks it. */
export function wallet({ evidence }, fingerprint) {
  return evidence.walletCheckOf({
    kind: "master-fingerprint",
    value: fingerprint,
    network: "mainnet",
  });
}

/** `words` with the ones at `places`, from 0, written `as`. */
export function replaced(words, places, as) {
  const copy = words.split(" ");
  for (const place of places) copy[place] = as;
  return copy.join(" ");
}

/** A finding as data. */
export const resultPlain = (result) => ({
  verdict: result.verdict,
  message: result.message,
  finding:
    result.finding === undefined ? null : { ...result.finding, places: [...result.finding.places] },
  notes: [...result.notes],
});
