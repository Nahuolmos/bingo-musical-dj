# Spec Delta

## Purpose

Guarantees a two-day DJ game survives refresh or close via versioned local autosave, restoring state with an explicit banner or failing loudly instead of losing the show silently.

## ADDED Requirements

### Requirement: Autosave versioned snapshot on every render

The system SHALL persist `{songs, history, current, locked, startedAt, savedAt, schemaVersion: 1}` to `localStorage` key `mbdj.v1` on every operator `render()`.

#### Scenario: Mid-show refresh restores full state

- **WHEN** songs are loaded, a draw is committed (`current` set, `locked=true`) and the page reloads
- **THEN** after boot the list, history, `current` and `locked` match the pre-reload snapshot

#### Scenario: Day-1 close restores on day-2 open

- **WHEN** the browser closes after day 1 with history present and reopens `index.html` later
- **THEN** songs, history order/`n`/`time`/`motivo`, `current`, `locked` and `startedAt` restore intact with `savedAt` of the last render

#### Scenario: Save includes timestamp and schema marker

- **WHEN** any render completes with storage available
- **THEN** the stored payload carries an ISO `savedAt` and `schemaVersion: 1`

### Requirement: Mandatory recovery banner with explicit discard

The system SHALL, when a stored snapshot restores non-empty state, show a mandatory banner with the save date/time plus a "Descartar y empezar de cero" button gated by `confirm()`.

#### Scenario: Banner forces acknowledgement

- **WHEN** `index.html` boots with a stored snapshot containing songs or history
- **THEN** a visible banner reads "Partida recuperada del HH:MM DD/MM — verificá historial antes de seguir" and stays until dismissed or discarded

#### Scenario: Discard is explicit and auditable by the operator

- **WHEN** the operator clicks "Descartar y empezar de cero" and confirms
- **THEN** storage is cleared, the session resets to empty unlocked state, and the banner leaves; cancelling the confirm keeps the restored game

### Requirement: Corrupt backup falls back to empty with message

The system SHALL, when the stored payload is unparseable, has a wrong shape, or carries an unknown `schemaVersion`, boot an empty session and show "Respaldo dañado — se inició vacío, revisá el CSV exportado".

#### Scenario: Corrupt JSON recovers loudly

- **WHEN** `mbdj.v1` contains truncated JSON, a non-object, or a future `schemaVersion`
- **THEN** the app boots empty (no partial songs/history applied) and the damage message is visible instead of crashing

### Requirement: No-storage mode warns instead of failing silently

The system SHALL, when `localStorage` is unavailable or throws (private mode, blocked storage, quota), show a persistence-unavailable warning and keep the in-memory game fully playable.

#### Scenario: Private mode warns but plays on

- **WHEN** storage writes/reads throw on boot or render
- **THEN** a warning states the game will not survive reload, and draw/confirm/history/export keep working in memory

### Requirement: beforeunload guards unexported history

The system SHALL register a `beforeunload` prompt only when history has entries not yet exported, and clear that guard right after a successful CSV export.

#### Scenario: Unsaved show warns on close

- **WHEN** history is non-empty since the last export and the operator closes or reloads the tab
- **THEN** the browser shows its leave-page confirmation

#### Scenario: Fresh or just-exported session closes silently

- **WHEN** history is empty or an export just completed with no newer draws
- **THEN** no `beforeunload` prompt appears
