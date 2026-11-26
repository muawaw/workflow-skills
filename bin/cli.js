#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (args[0] === "--") args.shift();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function getArg(flag) {
  const index = args.indexOf(flag);
  if (index !== -1) {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for ${flag}.`);
    }
    return value;
  }

  const equalsArg = args.find((arg) => arg.startsWith(`${flag}=`));
  return equalsArg ? equalsArg.slice(flag.length + 1) : null;
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Usage:
  npx github:muawaw/workflow-skills [options]
  npx @muawaw/session-state@latest [options]

Options:
  --strictness <loose|moderate|strict>  Set the file-context budget (default: moderate)
  --auto-update <true|false>            Update SESSION_STATE.md after tasks (default: true)
  --init-state                          Create SESSION_STATE.md if it does not exist
  -h, --help                            Show help

The auto-update option controls SESSION_STATE.md, not package updates.
`);
  process.exit(0);
}

const allowedFlags = new Set(["--strictness", "--auto-update", "--init-state"]);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--") continue;
  const flag = arg.split("=")[0];
  if (!allowedFlags.has(flag)) {
    fail(`Unknown option "${arg}". Use --help to see available options.`);
  }
  if (flag === "--init-state" && arg !== flag) {
    fail("--init-state does not take a value.");
  }
  if (flag !== "--init-state" && arg === flag) index += 1;
}

const strictness = getArg("--strictness");
const autoUpdate = getArg("--auto-update");
const initState = args.includes("--init-state");
const validStrictness = ["loose", "moderate", "strict"];

if (strictness && !validStrictness.includes(strictness)) {
  fail(`Invalid --strictness "${strictness}". Use: loose, moderate, or strict.`);
}
if (autoUpdate !== null && autoUpdate !== "true" && autoUpdate !== "false") {
  fail('Invalid --auto-update value. Use "true" or "false".');
}

const defaultConfig = {
  strictness: "moderate",
  auto_update: true,
  profiles: {
    strict: {
      max_deep_files: 2,
      max_standalone_files: 4,
      import_trace_depth: 2,
      context_warn_threshold_pct: 50
    },
    moderate: {
      max_deep_files: 4,
      max_standalone_files: 6,
      import_trace_depth: 2,
      context_warn_threshold_pct: 65
    },
    loose: {
      max_deep_files: 6,
      max_standalone_files: 8,
      import_trace_depth: 1,
      context_warn_threshold_pct: 80
    }
  },
  session_state_path: "SESSION_STATE.md",
  max_state_lines: 100
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const projectRoot = process.cwd();
const lockPath = path.join(projectRoot, "skill_lock.json");
let savedConfig = {};

if (fs.existsSync(lockPath)) {
  let contents;
  try {
    contents = fs.readFileSync(lockPath, "utf8");
  } catch (error) {
    fail(`Could not read skill_lock.json: ${error.message}`);
  }

  try {
    savedConfig = JSON.parse(contents);
  } catch {
    fail("skill_lock.json is invalid JSON; it was left unchanged.");
  }

  if (!isRecord(savedConfig)) {
    fail("skill_lock.json must contain a JSON object; it was left unchanged.");
  }
}

if (savedConfig.profiles !== undefined && !isRecord(savedConfig.profiles)) {
  fail("The profiles setting in skill_lock.json must be an object.");
}

const config = {
  ...defaultConfig,
  ...savedConfig,
  profiles: Object.fromEntries(
    Object.keys(defaultConfig.profiles).map((name) => {
      const savedProfile = savedConfig.profiles?.[name] ?? {};
      if (!isRecord(savedProfile)) {
        fail(`The ${name} profile in skill_lock.json must be an object.`);
      }
      return [
        name,
        { ...defaultConfig.profiles[name], ...savedProfile }
      ];
    })
  )
};

if (!validStrictness.includes(config.strictness)) {
  fail('The strictness setting must be "loose", "moderate", or "strict".');
}
if (typeof config.auto_update !== "boolean") {
  fail("The auto_update setting in skill_lock.json must be true or false.");
}
if (
  typeof config.session_state_path !== "string" ||
  !config.session_state_path.trim() ||
  path.isAbsolute(config.session_state_path)
) {
  fail("session_state_path must be a non-empty path relative to the project.");
}
if (!Number.isInteger(config.max_state_lines) || config.max_state_lines < 1) {
  fail("max_state_lines must be a positive integer.");
}

for (const [name, profile] of Object.entries(config.profiles)) {
  for (const key of ["max_deep_files", "max_standalone_files", "import_trace_depth"]) {
    if (!Number.isInteger(profile[key]) || profile[key] < 0) {
      fail(`${name}.${key} must be a non-negative integer.`);
    }
  }
  if (
    !Number.isInteger(profile.context_warn_threshold_pct) ||
    profile.context_warn_threshold_pct < 0 ||
    profile.context_warn_threshold_pct > 100
  ) {
    fail(`${name}.context_warn_threshold_pct must be between 0 and 100.`);
  }
}

if (strictness) config.strictness = strictness;
if (autoUpdate !== null) config.auto_update = autoUpdate === "true";

const relativeStatePath = path.normalize(config.session_state_path);
const statePath = path.resolve(projectRoot, relativeStatePath);
const relativeToRoot = path.relative(projectRoot, statePath);
if (relativeToRoot === ".." || relativeToRoot.startsWith(`..${path.sep}`)) {
  fail("session_state_path must stay inside the project directory.");
}

try {
  fs.writeFileSync(lockPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
} catch (error) {
  fail(`Could not write skill_lock.json: ${error.message}`);
}
console.log(
  `Updated skill_lock.json -> strictness: "${config.strictness}", ` +
    `auto_update: ${config.auto_update} (SESSION_STATE.md)`
);

if (initState && !fs.existsSync(statePath)) {
  const today = new Date().toISOString().slice(0, 10);
  const template = `# Session State

- **Last Updated:** ${today}
- **Strictness Profile:** ${config.strictness}
- **Auto-Update:** ${config.auto_update}
- **Current Focus:** None
- **Context Load:** Unknown (not measured)

## Active Files in Scope

- None

## Completed & Verified

- None

## Architecture & Guardrails

- None recorded

## Active Blocker / Open Questions

- None

## Exact Next Step

1. Record the next task when work begins.
`;
  try {
    fs.writeFileSync(statePath, template, { encoding: "utf8", flag: "wx" });
    console.log(`Created ${config.session_state_path}`);
  } catch (error) {
    if (error.code === "EEXIST") {
      console.log(`${config.session_state_path} already exists; left unchanged.`);
    } else {
      fail(`Could not create ${config.session_state_path}: ${error.message}`);
    }
  }
} else if (initState) {
  console.log(`${config.session_state_path} already exists; left unchanged.`);
}
