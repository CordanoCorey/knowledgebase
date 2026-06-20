import { exec, execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const mode = process.argv[2];
const rawArgs = process.argv.slice(3);
const validModes = new Set(["status", "dry-run", "run"]);
const defaultBatchSize = 100;
const defaultMaxBatches = 1;

if (!validModes.has(mode) || hasFlag(rawArgs, "--help") || hasFlag(rawArgs, "-h")) {
  printHelp();
  process.exit(validModes.has(mode) ? 0 : 1);
}

const options = parseOptions(rawArgs);

if (mode === "run" && !options.execute) {
  throw new Error(
    "Refusing to rebuild scoped aggregates without --execute. Run dry-run first, then retry with run --execute.",
  );
}

const paginationOpts = {
  cursor: options.cursor,
  numItems: options.batchSize,
};
const totals = {
  evidenceGroups: 0,
  missingScopedAggregateGroups: 0,
  processedEvidence: 0,
  rebuiltGroups: 0,
  skippedGroups: 0,
};

let cursor = options.cursor;
let isDone = false;
let batchNumber = 0;

console.log(`Context Expertise scoped aggregate ${mode}`);
console.log(`Batch size: ${options.batchSize}`);
console.log(`Max batches: ${options.maxBatches === Infinity ? "all" : options.maxBatches}`);
console.log(`Starting cursor: ${cursor ?? "null"}`);

while (!isDone && batchNumber < options.maxBatches) {
  batchNumber += 1;
  paginationOpts.cursor = cursor;

  const result =
    mode === "status"
      ? await runStatusBatch(paginationOpts, options)
      : await runRebuildBatch(paginationOpts, options, mode === "dry-run");

  isDone = result.isDone;
  cursor = result.continueCursor;

  if (mode === "status") {
    totals.evidenceGroups += result.evidenceGroupCount;
    totals.missingScopedAggregateGroups += result.missingScopedAggregateGroupCount;
    console.log(
      [
        `Batch ${batchNumber}: sampled ${result.sampledEvidenceCount} evidence rows`,
        `${result.evidenceGroupCount} evidence groups`,
        `${result.missingScopedAggregateGroupCount} missing scoped aggregate groups`,
        `${result.scopedAggregateSampleCount}/${result.sampledAggregateCount} sampled aggregates scoped`,
        `${result.legacyAggregateSampleCount} sampled legacy aggregates`,
      ].join("; "),
    );
    printGroups("Missing groups", result.missingScopedAggregateGroups);
  } else {
    totals.processedEvidence += result.processedEvidenceCount;
    totals.rebuiltGroups += result.rebuiltGroupCount;
    totals.skippedGroups += result.skippedGroupCount;
    console.log(
      [
        `Batch ${batchNumber}: processed ${result.processedEvidenceCount} evidence rows`,
        `${result.groupCount} groups`,
        `${result.rebuiltGroupCount} rebuilt`,
        `${result.skippedGroupCount} skipped`,
      ].join("; "),
    );
    printGroups("Groups", result.groups);
  }

  console.log(`Continue cursor: ${cursor}`);
  console.log(`Done: ${isDone ? "yes" : "no"}`);
}

if (!isDone) {
  console.log(
    `Stopped before completion after ${batchNumber} batch(es). Resume with --cursor ${JSON.stringify(
      cursor,
    )}.`,
  );
}

if (mode === "status") {
  console.log(
    `Status totals: ${totals.evidenceGroups} evidence groups checked; ${totals.missingScopedAggregateGroups} missing scoped aggregate groups.`,
  );
} else {
  console.log(
    `${mode === "dry-run" ? "Dry-run" : "Rebuild"} totals: ${totals.processedEvidence} evidence rows processed; ${totals.rebuiltGroups} groups rebuilt; ${totals.skippedGroups} groups skipped.`,
  );
}

async function runStatusBatch(paginationOpts, options) {
  return await runConvex("contextExpertise:getScopedAggregateMigrationStatus", {
    aggregateSampleLimit: options.aggregateSampleLimit,
    paginationOpts,
  }, options);
}

async function runRebuildBatch(paginationOpts, options, dryRun) {
  return await runConvex("contextExpertise:rebuildScopedAggregateBatch", {
    dryRun,
    paginationOpts,
  }, options);
}

async function runConvex(functionName, args, options) {
  const commandArgs = ["convex", "run", functionName, JSON.stringify(args)];

  if (options.push) {
    commandArgs.push("--push");
  }
  if (options.prod) {
    commandArgs.push("--prod");
  }
  if (options.deployment !== undefined) {
    commandArgs.push("--deployment", options.deployment);
  }
  if (options.identity !== undefined) {
    commandArgs.push("--identity", options.identity);
  }

  const { stderr, stdout } = await runCommand("npx", commandArgs, {
    env: { ...process.env, NO_COLOR: "1" },
    maxBuffer: 1024 * 1024 * 20,
  });

  if (stderr.trim()) {
    process.stderr.write(stderr);
  }

  return parseConvexJson(stdout);
}

async function runCommand(command, args, options) {
  if (process.platform === "win32") {
    return await execAsync(
      [command, ...args].map(quoteWindowsShellArg).join(" "),
      options,
    );
  }

  return await execFileAsync(command, args, options);
}

function quoteWindowsShellArg(arg) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '\\"')}"`;
}

function parseConvexJson(stdout) {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new Error("Convex returned no stdout to parse.");
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    console.error("Could not parse Convex output as JSON. Raw stdout follows:");
    console.error(trimmed);
    throw error;
  }
}

function parseOptions(args) {
  const parsed = {
    aggregateSampleLimit: 50,
    batchSize: defaultBatchSize,
    cursor: null,
    deployment: undefined,
    execute: false,
    identity: process.env.CONVEX_RUN_IDENTITY,
    maxBatches: defaultMaxBatches,
    prod: false,
    push: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--aggregate-sample-limit":
        parsed.aggregateSampleLimit = parsePositiveInteger(readValue(args, ++index, arg), arg);
        break;
      case "--all":
        parsed.maxBatches = Infinity;
        break;
      case "--batch-size":
        parsed.batchSize = parsePositiveInteger(readValue(args, ++index, arg), arg);
        break;
      case "--cursor":
        parsed.cursor = readValue(args, ++index, arg);
        break;
      case "--deployment":
        parsed.deployment = readValue(args, ++index, arg);
        break;
      case "--execute":
        parsed.execute = true;
        break;
      case "--identity":
      case "--identity-json":
        parsed.identity = readValue(args, ++index, arg);
        break;
      case "--identity-file":
        parsed.identity = readFileSync(readValue(args, ++index, arg), "utf8").trim();
        break;
      case "--max-batches":
        parsed.maxBatches = parsePositiveInteger(readValue(args, ++index, arg), arg);
        break;
      case "--prod":
        parsed.prod = true;
        break;
      case "--push":
        parsed.push = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function readValue(args, index, flag) {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return number;
}

function printGroups(label, groups) {
  if (!groups || groups.length === 0) {
    return;
  }

  console.log(`${label}:`);
  for (const group of groups) {
    const parts = [
      `subjectUserId=${group.subjectUserId}`,
      `contextKey=${group.contextKey}`,
      `audience=${group.audienceScopeKind}:${group.audienceScopeTargetKey}`,
    ];
    if (group.evidenceCount !== undefined) {
      parts.push(`evidenceCount=${group.evidenceCount}`);
    }
    if (group.aggregateId !== undefined) {
      parts.push(`aggregateId=${group.aggregateId}`);
    }
    if (group.skippedReason !== undefined) {
      parts.push(`skippedReason=${group.skippedReason}`);
    }
    console.log(`- ${parts.join("; ")}`);
  }
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function printHelp() {
  console.log(`Usage:
  node scripts/rebuild-context-expertise-scoped-aggregates.mjs status [options]
  node scripts/rebuild-context-expertise-scoped-aggregates.mjs dry-run [options]
  node scripts/rebuild-context-expertise-scoped-aggregates.mjs run --execute [options]

Modes:
  status   Check whether scoped aggregate groups are missing for evidence pages.
  dry-run  Call the rebuild mutation with dryRun: true and report affected groups.
  run      Rebuild scoped aggregate rows. Requires --execute.

Options:
  --batch-size <number>              Evidence rows per Convex pagination page. Default: 100.
  --max-batches <number>             Maximum pages to process. Default: 1.
  --all                              Process pages until Convex reports isDone.
  --cursor <cursor>                  Resume from a returned continue cursor.
  --aggregate-sample-limit <number>  Aggregate sample size for status. Default: 50.
  --identity-json <json>             UserIdentity JSON for a system admin.
  --identity-file <path>             Read UserIdentity JSON from a file.
  --deployment <deployment>          Pass through to convex run.
  --prod                             Pass through to convex run.
  --push                             Push code before running.
  --execute                          Required for run mode.

The runner also reads CONVEX_RUN_IDENTITY when --identity-json is omitted.`);
}
