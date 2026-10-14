# session-lock Specification

## Purpose

Freezes the song catalog once the show starts and offers exactly one audited way out: while the session is locked no import, edit, clear, or reset may mutate the list, and only an explicit administrative unlock with mandatory reason and double confirmation restores mutability, leaving a visible audit trail in history, CSV, and persisted state.

## Requirements

### Requirement: Locked session refuses every catalog mutation

The system SHALL refuse paste/demo/file imports, list edits, clear, and reset while `Session.locked=true`, disabling the corresponding controls in the operator UI and refusing in the seam with the shared blocked message, with no confirmation modal, no timer cancel, and no state mutation.

#### Scenario: Paste import refused while locked

- **WHEN** a paste import is attempted with `locked=true`
- **THEN** it returns blocked with `Lista bloqueada. Usá el Desbloqueo administrativo (C-11) para modificar el listado.` and songs, history, and lock are unchanged

#### Scenario: Demo import refused while locked

- **WHEN** the demo seed is attempted with `locked=true`
- **THEN** it returns blocked with the same message and the catalog is unchanged

#### Scenario: File import refused while locked

- **WHEN** a file is chosen with `locked=true`
- **THEN** the file is not read, the blocked message is shown, and the input resets with no mutation

#### Scenario: Clear and reset refused while locked

- **WHEN** clear or reset is invoked with `locked=true`
- **THEN** it returns false with zero mutation (songs, history, current, locked intact) and no confirm modal fires

#### Scenario: Edit refused while locked without admin path

- **WHEN** a list edit is attempted with `locked=true` outside the administrative unlock
- **THEN** the edit is rejected and the catalog is unchanged

#### Scenario: Unlocked imports still work

- **WHEN** paste, demo, or file import runs with `locked=false`
- **THEN** the normal import path executes and the catalog grows

### Requirement: Administrative unlock requires motivo plus double confirmation

The system SHALL expose an explicit administrative unlock that collects a non-empty trimmed motivo via `prompt()` and then requires two `confirm()` acceptances; cancelling the prompt, submitting an empty motivo, or declining either confirmation aborts with no state change.

#### Scenario: Unlock without motivo is blocked

- **WHEN** the operator submits an empty or whitespace-only motivo
- **THEN** the unlock is rejected and `locked` stays true with history unchanged

#### Scenario: Cancelled prompt aborts

- **WHEN** the operator cancels the motivo prompt
- **THEN** nothing changes and the session stays locked

#### Scenario: Declined confirmation aborts

- **WHEN** the operator provides a motivo but declines the first or the second confirmation
- **THEN** nothing changes and the session stays locked

#### Scenario: Valid motivo plus double confirm unlocks

- **WHEN** the operator provides a non-empty motivo and accepts both confirmations
- **THEN** `locked` becomes false and the unlock commits

### Requirement: Successful unlock writes an auditable entry and persists

The system SHALL, on a committed unlock, set `locked=false`, append exactly one song-less history entry carrying monotonic `n`, `es-AR HH:MM:SS` time, a visible administrative state, and the trimmed motivo, render it in the operator history, export it as a CSV row in the Motivo column, and persist it through the session autosave so it survives refresh.

#### Scenario: Unlock entry lands in history and CSV

- **WHEN** an unlock commits with motivo R
- **THEN** history holds one new entry with the next monotonic `n`, visible unlock state, and R, and the CSV export carries R in the Motivo column

#### Scenario: Unlock survives refresh

- **WHEN** the page reloads after an unlock
- **THEN** the restored state has `locked=false` and the unlock entry still carries R

#### Scenario: Unlock motivo renders inert

- **WHEN** the unlock motivo contains markup such as `<script>`
- **THEN** it renders as escaped text with no executable element

### Requirement: Clear and reset cancel in-flight timers with no ghost reveal

The system SHALL, on an unlocked clear or reset, cancel both the spin timer and the pending public reveal buffer before wiping state, so no delayed callback resurrects a cleared result on either screen.

#### Scenario: Clear mid-spin leaves no ghost

- **WHEN** the catalog is cleared while a spin reveal is pending
- **THEN** the pending reveal never fires and both screens stay on the cleared state

#### Scenario: Reset mid-buffer leaves no ghost

- **WHEN** the session resets while the public reveal buffer is pending
- **THEN** the pending public broadcast never fires and the public screen shows no title from the wiped draw

### Requirement: Full show route works offline in the multi-file layout

The system SHALL complete the route demo/paste/CSV import, draw, delayed public reveal, confirm/void, refresh recovery, blocked-edit attempt, and CSV export with no network access, loading only local files and treating CDN libraries as progressive enhancement with a proven paste-text fallback.

#### Scenario: Offline drill completes without network

- **WHEN** the operator runs the full route with networking disabled in the parted `index.html` + `public.html` + `css/` + `js/` structure
- **THEN** every step succeeds, the public reveal still delays ~3 s, refresh restores via autosave, and no step requires fetching a remote resource

#### Scenario: PDF/DOCX without network degrades to paste fallback

- **WHEN** a PDF/DOCX import is attempted offline
- **THEN** a visible message directs the operator to paste-text instead of failing silently
