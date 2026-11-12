# Spec Delta — session-persistence

## MODIFIED Requirements

### Requirement: Autosave versioned snapshot on every render
The system SHALL persist `{songs, history, current, locked, startedAt, savedAt, schemaVersion: 2}` plus the pending reveal-gate flag to `localStorage` key `mbdj.v1` on every operator `render()`, without a schema bump for the flag: `schemaVersion: 1` snapshots migrate forward (missing `coverUrl` becomes `null`) and snapshots lacking the flag hydrate as no pending gate.

#### Scenario: Mid-show refresh restores full state
- **WHEN** songs are loaded, a draw is committed (`current` set, `locked=true`) and the page reloads
- **THEN** after boot the list, history, `current` and `locked` match the pre-reload snapshot

#### Scenario: Day-1 close restores on day-2 open
- **WHEN** the browser closes after day 1 with history present and reopens `index.html` later
- **THEN** songs, history order/`n`/`time`/`motivo`, `current`, `locked` and `startedAt` restore intact with `savedAt` of the last render

#### Scenario: Save includes timestamp and schema marker
- **WHEN** any render completes with storage available
- **THEN** the stored payload carries an ISO `savedAt` and `schemaVersion: 2`

#### Scenario: Version-one snapshot migrates covers to null
- **WHEN** `mbdj.v1` holds a `schemaVersion: 1` snapshot whose songs lack `coverUrl`
- **THEN** boot restores list, history, `current` and `locked` intact with every song exposing `coverUrl: null`, and the next render persists `schemaVersion: 2`

#### Scenario: Mid-gate refresh restores the pending gate

- **WHEN** the page reloads while a gated wait is pending
- **THEN** after boot the dashboard still shows the committed result with the reveal control enabled, and the public screen re-syncs into the neutral gated wait with no title

#### Scenario: Pre-gate snapshot hydrates as no pending gate

- **WHEN** `mbdj.v1` holds a snapshot saved before this change (no gate flag)
- **THEN** boot restores list, history, `current` and `locked` intact with no pending gate, and the next render persists the flag

#### Scenario: Cancelled gate persists as cancelled

- **WHEN** the operator clears or resets mid-gate and the page reloads
- **THEN** no pending gate restores and no reveal fires after boot
