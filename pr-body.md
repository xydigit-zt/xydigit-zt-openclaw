## Summary

Add `openclaw skills uninstall <slug>` CLI command that cleanly removes a ClawHub-installed skill from the active workspace. Mirrors the existing `skills install` flow and the `plugins uninstall` pattern.

## Changes

- **`src/skills/lifecycle/clawhub.ts`**:
  - Added `SkillUninstallPlan` and `SkillUninstallResult` types
  - Added `planSkillUninstall()` - creates uninstall plan with slug validation
  - Added `executeSkillUninstall()` - removes skill dir and lockfile entry

- **`src/cli/skills-cli.ts`**:
  - Added `uninstall` command with `--dry-run`, `--yes`, `--json`, `--global`, `--agent` flags

## Proof

### `--dry-run` output

```
$ openclaw skills uninstall test-skill --dry-run
The following would be removed:
  - workspace directory:  /Users/.../.openclaw/workspace/skills/test-skill
  - lockfile entry:       .clawhub/lock.json#test-skill
(dry-run: no changes will be made)
```

### Actual uninstall with `--yes`

```
$ openclaw skills uninstall test-skill --yes
Removed skill directory: /Users/.../.openclaw/workspace/skills/test-skill
Removed lockfile entry: .clawhub/lock.json#test-skill
Uninstalled test-skill:
  ✓ removed workspace directory
  ✓ removed lockfile entry
```

### Non-existent skill

```
$ openclaw skills uninstall nonexistent
Skill 'nonexistent' is not installed in /Users/.../.openclaw/workspace
```

## Issue

Fixes #63272

---

**Labels**: clawsweeper:fix-shape-clear, clawsweeper:queueable-fix, P2
