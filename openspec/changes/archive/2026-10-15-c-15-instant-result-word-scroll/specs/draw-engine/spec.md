# Spec Delta: draw-engine

## MODIFIED Requirements

### Requirement: Cancellable reveal timeout with fixed spin base

The system SHALL render the committed result immediately on the dashboard post-commit with no operator spin machinery (no operator reveal timeout, no 2750 ms spin base), and SHALL hold the pending public-buffer reveal in a cancellable handle so clearing or resetting mid-buffer cancels it and no ghost result appears (coherent with C-03/C-11 guards).

#### Scenario: Clear cancels in-flight reveal

- **WHEN** the operator clears the list mid-buffer (post-commit public window, the remaining in-flight window)
- **THEN** the pending public reveal never fires and no deleted song is shown

#### Scenario: Reset cancels in-flight reveal

- **WHEN** the operator resets the session mid-buffer
- **THEN** the pending public reveal never fires and the board stays in its reset state

#### Scenario: Spin base is a single named constant

- **WHEN** the spin duration is inspected
- **THEN** no spin-base constant governs the dashboard result (the 2750 ms operator base is retired); the only remaining timed window is the public-buffer delay owned by its single named constant, separate from any removed spin base

### Requirement: Spinning guard blocks draw and confirm

The system SHALL reject any new draw or played/void confirmation while the post-commit public buffer is pending; no spin-in-flight state exists, the buffer window is the single guard owner.

#### Scenario: Double draw blocked

- **WHEN** a second draw is triggered while the post-commit public buffer is pending
- **THEN** it returns no result and state is unchanged

#### Scenario: Confirm blocked mid-spin

- **WHEN** confirmation is attempted while the post-commit public buffer is pending
- **THEN** it has no effect until the public reveal completes
