# draw-engine Specification

## Purpose

Single secure random draw engine with a cancellable reveal timeout and a spinning guard, so every sorteo is uniform, committed before animation, and never resurrected after clear or reset.

## Requirements

### Requirement: Uniform secure selection without modulo bias

The system SHALL select the drawn song index via rejection sampling over `crypto.getRandomValues`, giving each eligible song equal probability.

#### Scenario: Uniform distribution over many draws

- **WHEN** the engine draws 6000 indices over a pool of 6
- **THEN** each index count falls within the chi-square 99% acceptance band (no index starved or dominant)

#### Scenario: No modulo-bias shortcut exists

- **WHEN** the codebase is inspected
- **THEN** no executable path computes an index as `random % pool.length` without rejection

#### Scenario: Single eligible song is deterministic

- **WHEN** exactly one song is available
- **THEN** that song is always the drawn result

#### Scenario: Empty pool blocks the draw

- **WHEN** no song is available
- **THEN** no result is produced and the draw control stays disabled with the "no songs" message

### Requirement: Commit before render

The system SHALL decide and persist the drawn song (status plus history entry) synchronously before any spin animation or broadcast starts.

#### Scenario: Result fixed before animation

- **WHEN** the operator triggers a draw
- **THEN** the song status, current pointer, and history entry exist before the first animation frame or public message

#### Scenario: Audit marker present

- **WHEN** the commit site is inspected
- **THEN** an explicit commit-before-render comment declares the ordering guarantee

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
