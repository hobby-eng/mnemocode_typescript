/** Reuse the project's real POSIX PTY driver to compare two interactive FIFO filename routes. */
import { spawnSync } from "node:child_process";

// Python supplies the existing PTY driver and POSIX mkfifo; it does not implement a second CLI.
const code = String.raw`
import json
import os
import signal
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path.cwd() / "scripts"))
import terminal_session as terminal

failed = False
with tempfile.TemporaryDirectory(prefix="aud039-public-fifo-") as folder:
    fifo = str(Path(folder) / "pipe.txt")
    os.mkfifo(fifo)
    for retry in (False, True):
        arguments = ["decode", "--ask-secrets", "--mode", "direct", "--format", "unicode"]
        if retry:
            arguments += ["--input-file", str(Path(folder) / "missing.txt")]
        session = terminal.Session(arguments)
        try:
            if retry:
                session.wait_for("Read another file")
                session.type("1")
                session.wait_for("Record file name:")
            else:
                session.wait_for("Encoded seed phrase, record or text file path:")
            session.type(fifo + terminal.ENTER)
            time.sleep(0.3)
            os.killpg(session.pid, signal.SIGINT)
            try:
                result = session.wait_for_exit(limit=2)
            except AssertionError:
                result = None
            print(json.dumps({"route": "retry-file" if retry else "common-input", "exitAfterSigint": result}))
            failed |= result != 130
        finally:
            try:
                os.killpg(session.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            session.close()
sys.exit(1 if failed else 0)
`;
const result = spawnSync("python3", ["-B", "-c", code], {
  stdio: "inherit",
  timeout: 45000,
});
if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 125;
