# Spec Delta — draw-no-repeat

## MODIFIED Requirements

### Requirement: Mid-spin draw and confirm stay locked

The system SHALL show the committed result immediately on the dashboard with copy available, and SHALL reject any new draw or played/void confirmation while the gated wait or the public buffer is pending.

#### Scenario: Instant result with copy available

- **WHEN** a draw commits
- **THEN** the dashboard shows title and artist at once with the copy action available, with no operator spin animation or operator delay

#### Scenario: Double draw blocked mid-spin

- **WHEN** a second draw is triggered while the post-commit gated wait or public buffer is pending (the remaining in-flight windows)
- **THEN** it returns no result and state is unchanged

#### Scenario: Confirm blocked mid-spin

- **WHEN** confirmation is attempted while the post-commit gated wait or public buffer is pending
- **THEN** it has no effect until the public reveal completes

#### Scenario: Operator sees SORTEANDO state

- **WHEN** a draw commits
- **THEN** the dashboard shows the committed result at once with no SORTEANDO intermediate state

#### Scenario: Draw and confirm enabled after reveal

- **WHEN** the public reveal completes
- **THEN** draw and played/void confirmation are enabled again under the standard current/drawn gating

## ADDED Requirements

### Requirement: Dashboard reveal-gate control

The system SHALL expose a dashboard-only reveal control that starts the public animation for the pending draw.

#### Scenario: Gate control visible only with a pending gate

- **WHEN** a draw commits and the gated wait is pending
- **THEN** the dashboard shows the reveal control enabled, and the public screen keeps waiting neutrally

#### Scenario: Gate control hidden without a pending gate

- **WHEN** no gated wait is pending
- **THEN** the reveal control is hidden or disabled and triggering it has no effect

#### Scenario: One gate starts one buffer

- **WHEN** the DJ triggers the reveal gate twice for the same pending draw
- **THEN** exactly one public buffer runs and exactly one reveal fires for that commit

#### Scenario: Gate fires without changing the commit

- **WHEN** the DJ triggers the reveal gate
- **THEN** song status, current pointer, history, and lock are unchanged and no extra history entry is added
