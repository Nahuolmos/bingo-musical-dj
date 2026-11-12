# Spec Delta — confirm-void

## MODIFIED Requirements

### Requirement: Played confirmation closes the draw

The system SHALL confirm the current `drawn` song as `played` via in-place history update, clear `current`, and only allow this when the gated wait is released, the public buffer is finished, and the public reveal has completed.

#### Scenario: Mark played after reveal

- **WHEN** the operator confirms with `current` in `drawn` and no gate or buffer pending and the public reveal completed
- **THEN** the song and its last history entry become `played` and `current` clears

#### Scenario: Played blocked mid-spin or mid-buffer

- **WHEN** confirmation is attempted while the gated wait is pending or while the public buffer is pending
- **THEN** it has no effect and song, history, and `current` are unchanged

#### Scenario: Played with no current draw is a no-op

- **WHEN** there is no `current` or it is not in `drawn`
- **THEN** no song or history entry changes

### Requirement: Confirm controls gate on current, spin, and buffer

The system SHALL enable played/void confirmation only with `current` in `drawn` and with neither gated wait nor public buffer pending, keeping the draw control under the same gate-plus-buffer lock.

#### Scenario: Buttons disabled without a pending draw

- **WHEN** there is no `current` in `drawn`
- **THEN** both confirm controls stay disabled

#### Scenario: Buttons disabled through spin and buffer

- **WHEN** a gated wait is pending or the public buffer is pending
- **THEN** draw and both confirm controls stay disabled until the public reveal completes
