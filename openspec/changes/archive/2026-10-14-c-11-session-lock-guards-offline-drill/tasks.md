# Tasks — c-11-session-lock-guards-offline-drill

## 1. Unlock seam RED (TDD, pre-agreed seam only)

- [x] 1.1 Write FAILING tests for `handleUnlockRequest(promptFn, confirmFn)` in `tests/session-lock-unlock.test.js`: empty/whitespace motivo blocked, cancelled prompt aborts, declined 1st/2nd confirm aborts (zero mutation, `locked` stays true), valid motivo + double confirm commits (`locked=false`, one song-less entry with next `n` + motivo); verify with `node --test tests/session-lock-unlock.test.js` showing red on the new cases
- [x] 1.2 Extend lock-guard tests in `tests/session-lock-recovery.test.js`: edit-with-locked refused without admin path, file-import refused while locked (no read, input reset), locked `render()` disables mutation controls; verify new cases fail before implementation

## 2. Unlock seam GREEN + guards (extend, don't duplicate C-09)

- [x] 2.1 Implement `handleUnlockRequest` in `js/app.js` reusing `BLOCKED_MESSAGE` verbatim pattern and `handleVoidRequest` gate order (locked? → prompt → trim/empty → confirm ×2 → commit entry + `locked=false` + `render()`), plus unlock entry factory in `js/core.js` (`unlock-` prefixed id, visible state, motivo); verify `node --test tests/session-lock-unlock.test.js tests/session-lock-recovery.test.js` green
- [x] 2.2 Wire the explicit "Desbloqueo administrativo" button in `index.html` + `initApp` (real `prompt`/`confirm` injection), extend `render()` locked disables to every mutation control (import/file/edit/clear/reset/unlock-visibility), keep unlocked clear/reset semantics (single confirm, double with history, both timers cancelled); verify full suite `node --test tests/*.test.js` green with no regressions (expect prior 193 + new cases)
- [x] 2.3 Verify unlock persistence + CSV: unlock entry survives `bootRestore` round-trip (`locked=false`, motivo intact), appears in operator history escaped, exports in 6-col CSV Motivo column with sanitization; verify via the new tests in 2.1 plus `node --test tests/history-export.test.js tests/store.test.js` green

## 3. Ghost-reveal + offline unit verification

- [x] 3.1 Add/extend timer-cancellation tests: unlocked clear mid-spin and unlocked reset mid-public-buffer cancel both handles and no delayed callback fires (injectable timer fns, deterministic); verify with `node --test tests/draw.test.js tests/public.test.js tests/session-lock-unlock.test.js` green
- [x] 3.2 Document CDN contingency in code comment + checklist text (pdf.js/mammoth progressive only, paste-text fallback proven); verify `grep -r "cdnjs" js/ index.html` shows only the guarded `loadScript` paths with the offline message intact

## 4. [manual, user-executed] Consolidated signed offline drill on the event machine (absorbs ALL deferred smokes)

> Owner: user on the event machine (Chrome/Edge, networking disabled). Orchestrator verifies by user report + signed checklist — never declare pass without the report.

- [x] 4.1 [manual] File:// multi-file boot: double-click `index.html` → panel loads with no console errors; double-click `public.html` → `ESPERANDO EL SORTEO`; double-click `tests.html` → all PASS (record counts); verify by user report of the three loads — user-executed 2026-10-14, reported OK ("todo funciono como dice el drill")
- [x] 4.2 [manual, absorbs C-07 smoke] Offline import → draw → lock: with network OFF, demo import (12), paste import, CSV import (`assets/lista-ejemplo.csv`); sortear 1 → wheel spins, title committed before animation, `locked=true`; attempt paste/demo/file import → refused with blocked message; verify by user report — user-executed 2026-10-14, reported OK ("todo funciono como dice el drill")
- [x] 4.3 [manual, absorbs C-08 projector] Public screen move: click `Abrir pantalla pública` → `public.html` opens (popup-blocker message if blocked → allow and retry), move to projector/2nd screen; sortear → pública shows cabin message WITHOUT title through spin + ~3 s buffer, then reveals the operator's title with matching counters + last-5; verify by user report — user-executed 2026-10-14, reported OK ("todo funciono como dice el drill")
- [x] 4.4 [manual, absorbs C-09 smoke] Confirm/void offline: played path closes one draw; next draw → void with motivo (empty/cancel aborts with no mutation) → list shows `Anulada — motivo`, history carries motivo, copy-title does not mutate; reload → banner `Partida recuperada…` with motivo intact; verify by user report — user-executed 2026-10-14, reported OK ("todo funciono como dice el drill")
- [x] 4.5 [manual] Unlock + blocked-edit + persistence day-1→day-2: attempt list edit while locked → refused; run Desbloqueo administrativo (empty motivo blocked, declined confirm aborts, valid + double confirm commits) → history shows unlock entry, edit works again; reload → `locked=false` + entry persist; export CSV → unlock row present in Motivo column; simulate day-1 export → close → day-2 open restores everything; verify by user report — user-executed 2026-10-14, reported OK ("todo funciono como dice el drill")
- [x] 4.6 [manual, absorbs C-10 4.3] Export + Excel + checklist sign-off: open `music-bingo-historial.csv` in Excel (BOM, 6 columns, motivo + unlock rows, `'=+-@` cells as text); reset path warns export-first; fill and SIGN `docs/PRE_SHOW_CHECKLIST.md` (name, date, browsers tested); verify by the signed checklist file + user report — user-executed 2026-10-14, reported OK ("todo funciono como dice el drill")

## 5. Checklist consolidation + final validate

- [x] 5.1 Extend `docs/PRE_SHOW_CHECKLIST.md` with the C-11 drill items (persistence day-1→day-2, lock guards, unlock, offline CDN contingency, signature line) referencing groups 4.1–4.6; verify the file renders the full drill sequence with checkboxes and sign-off
- [x] 5.2 Run `openspec validate --change c-11-session-lock-guards-offline-drill` (use `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass;` prefix or `cmd /c`) and the full Node suite; verify validate clean and all tests green, then stop (NO code beyond the plan, NO commit — orchestrator owns git)

## Workflow follow-up

- Apply the change after approval (`/opsx-apply` or explicit apply request).
- Archive with `/opsx:archive c-11-session-lock-guards-offline-drill` once green + drill signed (v1 show-ready).
