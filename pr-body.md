## Summary

Add `openclaw skills uninstall <slug>` CLI command that cleanly removes a ClawHub-installed skill from the active workspace.

## Changes

- **`src/skills/lifecycle/clawhub.ts`**:
  - Added `SkillUninstallPlan` and `SkillUninstallResult` types
  - Added `planSkillUninstall()` and `executeSkillUninstall()`
  - **Security**: Gate directory removal on ClawHub provenance (`isClawHubInstall`)

- **`src/cli/skills-cli.ts`**:
  - Added `uninstall` command with `--dry-run`, `--yes`, `--json`, `--global`, `--agent` flags

## real behavior proof

**Behavior or issue addressed**: Adds a new CLI command `openclaw skills uninstall` that safely removes ClawHub-installed skills from the workspace.

**Real environment tested**: Local macOS terminal with OpenClaw CLI built from the PR branch.

**Exact steps or command run after this patch**:

```
mkdir -p ~/.openclaw/workspace/skills/manual-demo
echo "# Manual" > ~/.openclaw/workspace/skills/manual-demo/SKILL.md
node openclaw.mjs skills uninstall manual-demo --yes
```

**Evidence after fix**: ![screenshot](https://github.com/user-attachments/assets/00f5e2cc-248f-4ea7-b8a2-07929f552901)

**Observed result after fix**:

```
Skill directory exists but is not a ClawHub install. Use "rm -rf" to remove manually.
Uninstalled manual-demo:
  ✗ removed workspace directory
  ✗ removed lockfile entry
```

The manual skill directory remains intact - NOT deleted!

**What was not tested**: Testing on Linux/Windows, testing with actual ClawHub network calls.

## Issue

Fixes #63272

---

**Labels**: clawsweeper:fix-shape-clear, clawsweeper:queueable-fix, P2
