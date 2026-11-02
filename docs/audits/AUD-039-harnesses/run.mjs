/** Run one AUD-039 command with retained output, source identity and sampled Linux memory bounds. */
import { createHash } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, openSync, closeSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { ErrorCatalog } from "../../../src/core/error-catalog.ts";

const ERRORS = new ErrorCatalog("audit039.runner", {
  memory: () => "AUD-039 cannot read available memory.",
  usage: () => "Use run.mjs LABEL COMMAND [ARGUMENTS].",
  limits: () => "AUD-039 resource limits are invalid.",
  evidence: () => "Choose a fresh label; command evidence is immutable.",
});

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const EVIDENCE = join(ROOT, "docs/audits/AUD-039-evidence");
const MIB = 1024 ** 2;
const RESERVE = 3072 * MIB;
const RSS_LIMIT = Number(process.env.AUD039_RSS_MIB ?? 1536) * MIB;
const HEAP_MIB = Number(process.env.AUD039_HEAP_MIB ?? 384);
const TIME_LIMIT = Number(process.env.AUD039_TIMEOUT_SECONDS ?? 1800) * 1000;
const SAMPLE_MS = 200;
const PAGE_SIZE = Number((await promisify(execFile)("getconf", ["PAGESIZE"])).stdout.trim());
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const now = () => new Date().toISOString();

function available() {
  const value = /^MemAvailable:\s+(\d+)\s+kB$/mu.exec(readFileSync("/proc/meminfo", "utf8"));
  if (value === null) throw ERRORS.create("memory", []);
  return Number(value[1]) * 1024;
}

function source() {
  const snapshot = JSON.parse(readFileSync(join(EVIDENCE, "snapshot.json"), "utf8"));
  const files = snapshot.files.map(({ path }) => ({
    path,
    sha256: hash(readFileSync(join(ROOT, path))),
  }));
  return { files, fingerprint: hash(JSON.stringify(files)) };
}

function processes() {
  const rows = new Map();
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/u.test(name)) continue;
    try {
      const stat = readFileSync(`/proc/${name}/stat`, "utf8");
      const fields = stat
        .slice(stat.lastIndexOf(")") + 2)
        .trim()
        .split(/\s+/u);
      // proc_pid_stat: state, parent, process group, start ticks and resident pages.
      rows.set(Number(name), {
        state: fields[0],
        parent: Number(fields[1]),
        group: Number(fields[2]),
        started: fields[19],
        rss: Number(fields[21]) * PAGE_SIZE,
      });
    } catch (error) {
      if (!["ENOENT", "ESRCH", "EACCES"].includes(error.code)) throw error;
    }
  }
  return rows;
}

function descendants(pid, table) {
  const selected = new Set([pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [child, value] of table) {
      if (!selected.has(child) && (selected.has(value.parent) || value.group === pid)) {
        selected.add(child);
        changed = true;
      }
    }
  }
  return [...selected].filter((child) => table.has(child));
}

async function retire(known) {
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    const table = processes();
    for (const [pid, started] of known) {
      if (table.get(pid)?.started !== started || table.get(pid)?.state === "Z") continue;
      try {
        process.kill(pid, signal);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
    if (signal === "SIGTERM") await delay(SAMPLE_MS);
  }
}

async function run(label, command) {
  if (!/^[a-z][a-z0-9-]{0,79}$/u.test(label) || command.length === 0)
    throw ERRORS.create("usage", []);
  if (
    ![RSS_LIMIT, HEAP_MIB, TIME_LIMIT, PAGE_SIZE].every(Number.isFinite) ||
    RSS_LIMIT < 256 * MIB ||
    RSS_LIMIT > 3 * 1024 * MIB ||
    HEAP_MIB < 128 ||
    HEAP_MIB > 768 ||
    TIME_LIMIT < 1000 ||
    TIME_LIMIT > 7200 * 1000 ||
    PAGE_SIZE <= 0
  )
    throw ERRORS.create("limits", []);
  const log = join(EVIDENCE, `${label}.log`);
  if (existsSync(log)) throw ERRORS.create("evidence", []);
  const before = source();
  const startedAtUtc = now();
  const samples = [{ availableBytes: available(), processRssBytes: 0 }];
  const environment = {
    TZ: "UTC",
    NODE_OPTIONS: `--max-old-space-size=${HEAP_MIB}`,
    GOMEMLIMIT: "128MiB",
    CARGO_BUILD_JOBS: "1",
  };
  const fd = openSync(log, "wx");
  let stopReason = null;
  let exitCode = 125;
  let signal = null;
  if (samples[0].availableBytes < RESERVE + RSS_LIMIT) {
    stopReason = "insufficient-memory-before-start";
  } else {
    const child = spawn(command[0], command.slice(1), {
      cwd: ROOT,
      env: { ...process.env, ...environment },
      detached: true,
      stdio: ["ignore", fd, fd],
    });
    let finished = false;
    const terminal = new Promise((done) => {
      child.once("error", (error) => {
        stopReason = `spawn-${error.code}`;
        finished = true;
        done();
      });
      child.once("exit", (code, stopped) => {
        exitCode = code;
        signal = stopped;
        finished = true;
        done();
      });
    });
    const known = new Map();
    const deadline = Date.now() + TIME_LIMIT;
    while (!finished) {
      const table = processes();
      const children = child.pid === undefined ? [] : descendants(child.pid, table);
      for (const pid of children) known.set(pid, table.get(pid).started);
      const processRssBytes = children.reduce((sum, pid) => sum + table.get(pid).rss, 0);
      const availableBytes = available();
      samples.push({ availableBytes, processRssBytes });
      if (availableBytes < RESERVE) stopReason = "host-memory-reserve-reached";
      else if (processRssBytes > RSS_LIMIT) stopReason = "process-rss-budget-reached";
      else if (Date.now() > deadline) stopReason = "timeout";
      if (stopReason !== null) {
        await retire(known);
        break;
      }
      await delay(SAMPLE_MS);
    }
    await terminal;
    const table = processes();
    if (
      [...known].some(
        ([pid, started]) => table.get(pid)?.started === started && table.get(pid)?.state !== "Z",
      )
    ) {
      stopReason ??= "owned-child-remained";
      await retire(known);
    }
  }
  closeSync(fd);
  const after = source();
  const changedFiles = after.files
    .filter((row, index) => row.sha256 !== before.files[index].sha256)
    .map(({ path }) => path);
  const wrapperExitCode = stopReason === null ? (exitCode ?? 125) : 125;
  const record = {
    auditId: "AUD-039",
    command,
    environment,
    startedAtUtc,
    endedAtUtc: now(),
    exitCode,
    signal,
    stopReason,
    wrapperExitCode,
    sourceBefore: before.fingerprint,
    sourceAfter: after.fingerprint,
    changedFiles,
    reserveBytes: RESERVE,
    rssBudgetBytes: RSS_LIMIT,
    nodeHeapMiB: HEAP_MIB,
    timeoutMilliseconds: TIME_LIMIT,
    peakProcessRssBytes: Math.max(...samples.map((sample) => sample.processRssBytes)),
    minimumAvailableBytes: Math.min(...samples.map((sample) => sample.availableBytes)),
    samples,
    logSha256: hash(readFileSync(log)),
    runnerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  };
  writeFileSync(join(EVIDENCE, `${label}.command.json`), JSON.stringify(record, null, 2) + "\n", {
    flag: "wx",
  });
  process.stdout.write(
    JSON.stringify({
      label,
      exitCode,
      stopReason,
      wrapperExitCode,
      peakProcessRssBytes: record.peakProcessRssBytes,
      minimumAvailableBytes: record.minimumAvailableBytes,
    }) + "\n",
  );
  process.exitCode = wrapperExitCode;
}

const [label, ...command] = process.argv.slice(2);
await run(label, command);
