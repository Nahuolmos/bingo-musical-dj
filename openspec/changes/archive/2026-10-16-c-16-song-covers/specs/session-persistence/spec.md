# Spec Delta — session-persistence

## MODIFIED Requirements

### Requirement: Autosave versioned snapshot on every render
The system SHALL persist `{songs, history, current, locked, startedAt, savedAt, schemaVersion: 2}` to `localStorage` key `mbdj.v1` on every operator `render()`, migrating `schemaVersion: 1` snapshots forward (missing `coverUrl` becomes `null`) instead of rejecting them.

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

### Requirement: Corrupt backup falls back to empty with message
The system SHALL, when the stored payload is unparseable, has a wrong shape, or carries an unknown or future `schemaVersion` (anything other than 1 or 2), boot an empty session and show "Respaldo dañado — se inició vacío, revisá el CSV exportado".

#### Scenario: Corrupt JSON recovers loudly
- **WHEN** `mbdj.v1` contains truncated JSON, a non-object, or a future `schemaVersion`
- **THEN** the app boots empty (no partial songs/history applied) and the damage message is visible instead of crashing

#### Scenario: Version-one is migrated, not rejected
- **WHEN** `mbdj.v1` contains a well-formed `schemaVersion: 1` payload
- **THEN** the app restores it with covers migrated to `null` instead of showing the damage message
