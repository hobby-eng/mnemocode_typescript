// The entries of the start menu as it shows them, each a digit and a label. The menu lists them
// (menu.ts), and the messages and the sheet for heirs that send a person to an entry name it from
// here (heir-sheet.ts, share-repair.ts, date-search.ts, backup-check.ts), so that every text names
// an entry as the menu shows it.

/** A public menu task, its short explanation and the README section that describes it. */
export interface MenuTopic {
  readonly label: string;
  readonly description: string;
  readonly anchor: string;
}

/** One entry of the start menu, with its task description and README section. */
export interface MenuEntryName extends MenuTopic {
  readonly digit: number | null;
}

export const MENU_ENTRY_NAMES = {
  encode: {
    digit: 1,
    label: "Encode a seed phrase as numbers, codes or colors",
    description: "Choose how to write your backup, whether to use dates, and where to save it.",
    anchor: "1-encode",
  },
  // Its own entry after Encode (owner, 2026-10-13).
  reEncode: {
    digit: 2,
    label: "Re-encode a backup with other dates or in another form",
    description: "Restore and confirm the original phrase before making a replacement backup.",
    anchor: "2-re-encode",
  },
  decode: {
    digit: 3,
    label: "Decode numbers, codes or colors back into a seed phrase",
    description: "Read a backup and undo its date masking to recover the original words.",
    anchor: "3-decode",
  },
  split: {
    digit: 4,
    label: "Split a seed phrase into standard Shamir shares",
    description: "Choose how many shares to make and how many are needed to restore the phrase.",
    anchor: "4-split-into-shares",
  },
  restore: {
    digit: 5,
    label: "Restore a seed phrase from Shamir shares",
    description: "Combine enough distinct shares, then undo Seedshift if it was used.",
    anchor: "5-restore-from-shares",
  },
  recover: {
    digit: 6,
    label: "Find a forgotten word, code, date digit or share code",
    description: "Choose what is missing and use what you still know to narrow the search.",
    anchor: "6-recovery",
  },
  preview: {
    digit: 7,
    label: "Print sample cards with a random sample phrase",
    description: "Try a card design with sample data before entering your own phrase.",
    anchor: "7-preview-cards",
  },
  table: {
    digit: 8,
    label: "Look up a seed word, its number or its Unicode code",
    description: "Look up a BIP39 word or export dictionaries and a manual recovery guide.",
    anchor: "8-word-lookup",
  },
  // As the self-test is named in mhfe too, so that the tools read alike (owner, 2026-10-13).
  selfTest: {
    digit: 9,
    label: "Run the self-test",
    description: "Check the installation, including its share engine, cards and QR output.",
    anchor: "9-self-test",
  },
  help: {
    digit: 0,
    label: "Show every command and option",
    description: "Read the command list and find the options for a particular task.",
    anchor: "0-help",
  },
  // As in mhfe: the last entry, without a digit; Escape quits as well (owner, 2026-10-13).
  quit: {
    digit: null,
    label: "Quit",
    description: "Leave MnemoCode. Escape at the main menu also quits.",
    anchor: "quit",
  },
} as const satisfies Readonly<Record<string, MenuEntryName>>;

/** The task shown before an entry is chosen or after returning from it. */
export const MENU_OVERVIEW: MenuTopic = {
  label: "Offline seed phrase encoding",
  description: "Create or restore a wallet backup, or search for missing recovery material.",
  anchor: "menu",
};

/** The four recovery tasks, each with its own explanation rather than the general menu link. */
export const RECOVERY_TOPICS = {
  word: {
    label: "Forgotten words",
    description: "Mark unknown words with ? or find where one missing word belongs.",
    anchor: "forgotten-word-recovery",
  },
  code: {
    label: "Unreadable backup codes",
    description: "Mark unreadable codes with ? and check candidates against the wallet.",
    anchor: "codes-that-cannot-be-read",
  },
  date: {
    label: "Forgotten date digits",
    description: "Keep the date digits you know and use a wallet reference to test the rest.",
    anchor: "date-recovery-helper",
  },
  share: {
    label: "Damaged Shamir shares",
    description: "Keep every readable share code; use ? where an element cannot be read.",
    anchor: "damaged-shares",
  },
} as const satisfies Readonly<Record<string, MenuTopic>>;

/** The answer of the menu that types an encoded seed phrase in, which the sheet for heirs names. */
export const TYPED_SOURCE = "Type or paste it";

/** The question of how many words the typed codes stand for, and its answer for `words` words. */
export const PHRASE_WORDS_QUESTION = "How many words does the seed phrase have?";
export function phraseWordsAnswer(words: number): string {
  return `${words} words`;
}

/** An entry as the menu shows it, its digit before its label: "3 Decode numbers, …". */
export function shownEntry(entry: MenuEntryName): string {
  return entry.digit === null ? entry.label : `${entry.digit} ${entry.label}`;
}
