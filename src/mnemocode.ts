#!/usr/bin/env node
import { runCommandLine } from "./cli/command-line.js";
import { menuAvailable, runMenu } from "./cli/menu.js";
import { ProcessProtection, relaunchProtected, underProtection } from "./cli/protection.js";
import { endCancelled } from "./cli/interruption.js";
import { dumbTerminalReason, nodeTurn, terminalTooDumb } from "./cli/terminal-input.js";
import { CANCELLED, type Cancelled } from "./cli/terminal-keys.js";
import { standardOutputRefusal, watchStandardOutput } from "./cli/output-paths.js";
import { flushed, terminalFailure, terminalHint } from "./cli/terminal.js";
import { describeError } from "./core/refusal.js";

/** Runs the menu or one command line; CANCELLED when the person cancelled it with Ctrl+C. */
async function main(): Promise<Cancelled | undefined> {
  watchStandardOutput();
  const argv = process.argv.slice(2);
  // Every run is protected (protection.ts): a plain `node` start runs the program again so.
  if (!underProtection()) {
    process.exitCode = await relaunchProtected(argv);
    return undefined;
  }
  await ProcessProtection.harden();
  // Started without arguments at a terminal, as by a double-click, MnemoCode shows its menu; a
  // script or a pipe gets the help, as before.
  if (argv.length === 0 && menuAvailable()) return runMenu();
  // A terminal that says TERM=dumb cannot draw the menu: the help comes, with the reason.
  if (argv.length === 0 && terminalTooDumb()) terminalHint(dumbTerminalReason("The menu"));
  return runCommandLine(argv);
}

// A cancelled run says so in one line and ends as a process that Ctrl+C stopped (exit-codes.ts).
void main().then(
  async (end) => {
    if (end === CANCELLED) {
      endCancelled();
      return;
    }
    // A result that standard output did not take ends a command that would have succeeded: the
    // writes still pending are awaited, then the turn on which their stream reports an error.
    if (process.stdout.writableLength > 0) await flushed(process.stdout);
    await nodeTurn();
    const refusal = standardOutputRefusal();
    if (refusal !== undefined && (process.exitCode ?? 0) === 0) {
      terminalFailure(refusal.message);
      process.exitCode = 1;
    }
  },
  (error: unknown) => {
    terminalFailure(describeError(error));
    process.exitCode = 1;
  },
);
