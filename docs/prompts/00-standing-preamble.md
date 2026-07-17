# Standing context — now lives in AGENTS.md

This used to be a block you'd paste at the top of every prompt. It's now `AGENTS.md` at the repo root
instead — Codex CLI loads that file into context automatically at the start of every session in this
repo, so you don't need to paste anything.

**Setup, once:** before running Task 1, copy `AGENTS.md` (in the repo root of this kit) into the root of
your actual `rally/` repo. Task 1 will formalize the folder structure it describes; from Task 2 onward,
Codex already knows the rules without you repeating them.

**If you're not using Codex CLI** (e.g. a plain chat interface with no repo-file auto-loading), fall back
to the old approach: paste the contents of `AGENTS.md` at the top of every task prompt from Task 2 on.

**One caveat either way:** AGENTS.md shapes behavior, it doesn't enforce it — on a long session Codex can
still drift from a rule it read hours ago. If you notice it violating something in AGENTS.md (e.g.
importing across the `apps/web` / `apps/api` boundary), it's fine to just restate that one rule inline in
your next message rather than the whole file.
