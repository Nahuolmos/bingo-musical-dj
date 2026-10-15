# Spec Delta: draw-no-repeat

## MODIFIED Requirements

### Requirement: Commit before animation with history entry

The system SHALL commit status, current pointer, and history entry synchronously before any result show or public message starts.

#### Scenario: Result fixed before reveal

- **WHEN** the operator triggers a draw
- **THEN** song status, current pointer, and history entry exist before the first result paint or public message

#### Scenario: Every draw has an auditable entry

- **WHEN** a draw commits
- **THEN** history gains one entry with monotonic `n`, song snapshot, `drawn` status, and `es-AR HH:MM:SS` time

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

## ADDED Requirements

### Requirement: No operator spin machinery

The system SHALL NOT run an operator spin animation, operator reveal timeout, or `SORTEANDO` operator state; the only pending window after commit is the public buffer.

#### Scenario: No operator timeout exists

- **WHEN** the draw path is inspected
- **THEN** no operator-side reveal timeout handle or spin-base constant governs the dashboard result

#### Scenario: Clear or reset only cancels the public buffer

- **WHEN** the operator clears the list or resets the session mid-buffer
- **THEN** the pending public reveal never fires and no deleted song is shown
