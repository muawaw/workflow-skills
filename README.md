# Session State

I learned to work with AI agents gradually. At first, I did not know that skills existed. My dashboard UI already followed my guidelines and did not feel like AI slop. As I learned to use skills, I found more ways to improve the UI, make code a little cleaner, and write better prompts.

I also learned to divide work across tasks and subagents. My prompts and results have improved across the models I use, but token use is still hard to manage. Each agent may need its own copy of the task details, and long conversations carry more history forward. When several agents read or repeat the same context, token use can climb quickly.

Maintaining context matters even when I use a subagent team. I want to keep the useful project state, check before pulling more files into a conversation, and know when a fresh chat with a handoff would be easier to manage. I am still learning how agentic systems use context and how to prompt them well. This project is one small tool for that work. It sets file limits and maintains a handoff; it does not measure tokens or promise a specific saving.

The `npx` command configures the project. The skill instructions still need to be installed using the skill mechanism supported by your AI agent.

## What it does

- Keeps a short handoff with the current task, active files, blockers, and next step.
- Offers loose, moderate, and strict limits for deep/coupled and standalone files.
- Asks before loading a new file when it would exceed the active file budget.
- Reports context use only when the agent can measure it reliably.
- Can update `SESSION_STATE.md` after tasks when `auto_update` is enabled.

These are instructions for an AI agent, not a token meter. The skill cannot create or switch chats on your behalf. The CLI does not update itself or replace the skill installed in an AI agent.

## How this fits my workflow

For hobby full-stack experiments, my usual mix includes caveman, ponytail, humanizer, antislop, matt-pocock, and copywriting skills I have written. I use different skills for different parts of the work. Session State has a narrower job: keep track of files and task state so the conversation does not carry more project context than needed.

For enterprise work with raw data and heavy data manipulation, I mainly use caveman and ponytail. Session State adds file-context limits and a handoff when the task grows. It does not replace those skills or decide how to split work among agents.

When I delegate, I try to give each agent a bounded task, only the files it needs, a clear completion check, and a concise result to return. I want to keep shared project facts in the handoff instead of pasting the whole conversation into every task. This skill does not choose how many agents to start or control how much context each model consumes. I am still learning how to make that balance work.

As I learn more about agentic workflows, I may add another skill or update this one when I find something that helps my daily work.

## Install the skill

If you use the Vercel Skills CLI, install the skill from this repository with:

```bash
npx skills add muawaw/workflow-skills
```

Then run the project CLI below to choose the profile and initialize the handoff. Other agents may use a different skill installation flow.

## Run from GitHub

From the project directory, configure the strict profile and create a starter handoff:

```bash
npx --yes github:muawaw/workflow-skills --strictness strict --auto-update true --init-state
```

The command creates or updates `skill_lock.json` in the current directory. `--init-state` creates `SESSION_STATE.md` only if it does not already exist. Existing state files are left untouched.

After publishing the package to npm, use:

```bash
npx @muawaw/session-state@latest --strictness moderate --auto-update true --init-state
```

`@latest` selects the latest published package for that invocation. It does not update a separately installed copy in the background. Package self-updates are not implemented.

## Options

| Option | Values | Default | Effect |
|---|---|---|---|
| `--strictness` | `loose`, `moderate`, `strict` | `moderate` | Selects the active file limits and warning threshold. |
| `--auto-update` | `true`, `false` | `true` | Controls whether the agent updates `SESSION_STATE.md` after tasks. |
| `--init-state` | flag | off | Creates a starter `SESSION_STATE.md` if missing. |
| `--help` | flag | | Prints usage. |

The profiles use separate limits for deep/coupled files and standalone files:

| Profile | Deep/coupled | Standalone | Import trace depth | Context warning |
|---|---:|---:|---:|---:|
| strict | 2 | 4 | 2 | 50% |
| moderate | 4 | 6 | 2 | 65% |
| loose | 6 | 8 | 1 | 80% |

The agent pauses before reading a full new file if doing so would exceed its category's limit. It asks whether to continue in the current chat or start a fresh chat from the handoff. If the agent cannot measure context usage, it should say `unknown`, not guess.

Example CLI output:

```text
Updated skill_lock.json -> strictness: "strict", auto_update: true (SESSION_STATE.md)
Created SESSION_STATE.md
```

Example agent prompt when a strict deep-file limit is reached:

```text
[Context Guardrail | Profile: strict | Auto-Update: on]
- New File: src/auth/session.ts (Deep/Coupled, 3 internal dependencies)
- Upstream Root Chain: src/auth/session.ts -> src/auth/controller.ts -> src/auth/index.ts
- Active File Budget: 2/2 in this category
- Context Load: unknown
- Trade-off: Reading this file may add substantial context to the conversation.
- Decision: [1] Start a fresh chat from SESSION_STATE.md | [2] Continue here
```

## Configuration

The CLI writes `skill_lock.json` in the working directory. The default configuration is:

```json
{
  "strictness": "moderate",
  "auto_update": true
}
```

The file also contains the profile limits, `session_state_path`, and `max_state_lines`. Customizations to the built-in profiles are preserved when the CLI changes a setting. Invalid JSON or invalid setting values stop the command without replacing the file.
