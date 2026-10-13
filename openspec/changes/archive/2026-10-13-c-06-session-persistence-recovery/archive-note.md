# Archive note — c-06-session-persistence-recovery (2026-10-13)

- Tasks: 7/7 complete. Tests: 96/96 pass (Node `--test` + `tests.html` mirror: store 8 + app-restore 6 new).
- Manual evidence (user-verified 2026-10-13):
  1. Refresh restores with banner — PASS.
  2. Corrupt `mbdj.v1` → empty session + damage message — PASS.
  3. Restore-then-continue-draws appends to recovered history — PASS (by design).
  4. Close-tab shows no prompt but close-browser prompts + history recovered on reopen — ACCEPTED with note: guard is keyed off `exportedAt` (fires only when newest history entry is newer than last CSV export), so a plain tab close with no unexported draws stays silent; no data loss, the critical property.
- Built: `js/store.js` real boundary (`mbdj.v1`, `{songs, history, current, locked, startedAt, savedAt, schemaVersion: 1}`), app persist-on-`render()`/boot-hydrate/banner/discard/`beforeunload`, `index.html` `#restoreBanner`.
- Specs synced: `openspec/specs/session-persistence/spec.md` (6 ADDED requirements) — `openspec validate --specs` clean (6/6).
- Next: C-07 propose — requires C-03 ✓ + C-04 ✓ (both archived).
