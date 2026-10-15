# draw-no-repeat Specification

## Purpose

Uniform live draw without repetition that commits before animating and freezes the catalog on first draw, so the show stays fair and the list cannot change mid-game.

## Requirements

### Requirement: Uniform draw without replacement

The system SHALL draw uniformly from available songs only, so no drawn, played, or void song is ever eligible again in the same partida.

#### Scenario: No repeat over a full catalog

- **WHEN** the operator draws until the catalog is exhausted
- **THEN** every song is drawn exactly once and no id appears twice

#### Scenario: Drawn song leaves the eligible pool

- **WHEN** a draw commits
- **THEN** that song no longer appears in the available pool for later draws

### Requirement: Commit before animation with history entry

The system SHALL commit status, current pointer, and history entry synchronously before any result show or public message starts.

#### Scenario: Result fixed before reveal

- **WHEN** the operator triggers a draw
- **THEN** song status, current pointer, and history entry exist before the first result paint or public message

#### Scenario: Every draw has an auditable entry

- **WHEN** a draw commits
- **THEN** history gains one entry with monotonic `n`, song snapshot, `drawn` status, and `es-AR HH:MM:SS` time

### Requirement: First draw activates the session lock

The system SHALL set `Session.locked=true` on the first committed draw, and the flag SHALL persist through the session autosave.

#### Scenario: Lock activates on first draw

- **WHEN** the first draw of a partida commits
- **THEN** `locked` becomes true and remains true for later draws

#### Scenario: Locked flag survives refresh

- **WHEN** the page reloads after at least one draw
- **THEN** the restored session still reports `locked=true`

#### Scenario: Draw to import-reject round-trip

- **WHEN** the operator draws once and then attempts a paste or demo import
- **THEN** the import is rejected with the blocked message and the catalog is unchanged

### Requirement: Empty pool blocks with a clear message

The system SHALL disable the draw control and show `No quedan canciones disponibles` when zero songs are eligible, never producing a fictitious result.

#### Scenario: Empty catalog blocks

- **WHEN** no songs are loaded
- **THEN** no result is produced, the draw control stays disabled, and the empty message is shown

#### Scenario: Exhausted catalog blocks

- **WHEN** every song is already drawn, played, or void
- **THEN** no result is produced, the draw control stays disabled, and the exhausted message is shown

### Requirement: Single eligible song is deterministic

The system SHALL return the only available song when exactly one song is eligible.

#### Scenario: One song left

- **WHEN** exactly one song is available
- **THEN** that song is always the drawn result

### Requirement: Mid-spin draw and confirm stay locked

The system SHALL show the committed result immediately on the dashboard with copy available, and SHALL reject any new draw or played/void confirmation while the public buffer is pending.

#### Scenario: Instant result with copy available

- **WHEN** a draw commits
- **THEN** the dashboard shows title and artist at once with the copy action available, with no operator spin animation or operator delay

#### Scenario: Double draw blocked mid-spin

- **WHEN** a second draw is triggered while the post-commit public buffer is pending (the remaining in-flight window)
- **THEN** it returns no result and state is unchanged

#### Scenario: Confirm blocked mid-spin

- **WHEN** confirmation is attempted while the post-commit public buffer is pending
- **THEN** it has no effect until the public reveal completes

#### Scenario: Operator sees SORTEANDO state

- **WHEN** a draw commits
- **THEN** the dashboard shows the committed result at once with no SORTEANDO intermediate state

#### Scenario: Draw and confirm enabled after reveal

- **WHEN** the public reveal completes
- **THEN** draw and played/void confirmation are enabled again under the standard current/drawn gating

### Requirement: No operator spin machinery

The system SHALL NOT run an operator spin animation, operator reveal timeout, or `SORTEANDO` operator state; the only pending window after commit is the public buffer.

#### Scenario: No operator timeout exists

- **WHEN** the draw path is inspected
- **THEN** no operator-side reveal timeout handle or spin-base constant governs the dashboard result

#### Scenario: Clear or reset only cancels the public buffer

- **WHEN** the operator clears the list or resets the session mid-buffer
- **THEN** the pending public reveal never fires and no deleted song is shown
