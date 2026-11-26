---
name: session-state
description: Keep a compact SESSION_STATE.md handoff and limit unnecessary file loading with configurable loose, moderate, or strict context budgets. Use at task start, when a task introduces files outside the active scope, and at task completion.
---

# Session state and context guardrails

Use the project-root `skill_lock.json` and `SESSION_STATE.md` to keep track of the task and the files already in scope. These rules guide the agent; they do not measure tokens or open a new chat automatically.

## Start each task

1. Read `skill_lock.json` from the repository root. If it is missing, use the defaults below.
2. Read `SESSION_STATE.md` if it exists. Carry forward its current focus, active files, blockers, and next step. If it does not exist, do not claim that a handoff has been initialized.
3. Use the configured strictness profile. Deep and standalone limits are separate budgets. Count a file once, in the category that best describes it.

| Profile | Deep or coupled files | Standalone files | Import trace depth | Context warning |
|---|---:|---:|---:|---:|
| strict | 2 | 4 | 2 | 50% |
| moderate | 4 | 6 | 2 | 65% |
| loose | 6 | 8 | 1 | 80% |

These are maximum active-file counts, not a required number of files to inspect. Do not load files that are not needed for the task.

## Before opening a new file

When a task requires a file that is not already in `Active Files in Scope`:

1. Inspect its import or dependency header, then follow internal imports toward their root, up to `import_trace_depth` hops. Use the language's import syntax; for files without imports, inspect the relevant dependency declarations.
2. Classify the candidate as **deep/coupled** if it imports or depends on three or more internal modules, schemas, or controllers. Otherwise classify it as **standalone**.
3. Check whether adding it would exceed the corresponding profile limit. Also check the context warning threshold if the agent exposes a reliable context-use measurement.
4. If the file limit would be exceeded, stop before reading the full file and ask the user whether to continue in this chat or start a fresh chat from `SESSION_STATE.md`. If the user chooses to continue, record that choice and proceed. If the user chooses a fresh chat, update the handoff when permitted and stop.
5. If the context threshold is crossed, report the measured percentage and suggest a fresh chat. If context use cannot be measured, say **unknown**; never invent an estimate.

Use this prompt when the file limit is exceeded:

```text
[Context Guardrail | Profile: <strictness> | Auto-Update: <on/off>]
- New File: <path> (<Deep/Coupled or Standalone>, <N> internal dependencies)
- Upstream Root Chain: <file_a -> file_b -> root_module>
- Active File Budget: <current>/<max> in this category
- Context Load: <measured percentage or unknown>
- Trade-off: Reading this file may add substantial context to the conversation.
- Decision: [1] Start a fresh chat from SESSION_STATE.md | [2] Continue here
```

Do not interrupt for files already in scope. A user request to inspect a file is not permission to ignore an exceeded budget; show the trade-off and let the user decide.

## Update the handoff

When `auto_update` is `true`, update `SESSION_STATE.md` at task completion. When it is `false`, update it only when the user asks. Always read it at task start if present.

Keep the handoff concise and preserve these fields:

- Last updated
- Strictness profile and state auto-update setting
- Current focus
- Active files in scope
- Completed and verified work
- Architecture notes or guardrails that matter to the next task
- Active blockers or open questions
- Exact next step

Record only facts supported by the conversation or repository. Mark context load **unknown** unless the agent provides a reliable measurement. If `max_state_lines` is set, keep the file within that limit by removing stale completed items first; preserve the current focus, active files, blockers, and next step.

`auto_update` controls `SESSION_STATE.md` only. It does not update this skill, the CLI package, or other installed copies.

## Configuration

The CLI creates or updates `skill_lock.json` in the current project directory. Without a config file, use:

```json
{
  "strictness": "moderate",
  "auto_update": true
}
```

The CLI also writes the default profile limits, `session_state_path`, and `max_state_lines`. Preserve valid user customizations when changing settings. If a config is invalid, report the error and leave it untouched.
