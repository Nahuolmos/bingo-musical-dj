# Spec Delta

## Purpose

Single secure random draw engine with a cancellable reveal timeout and a spinning guard, so every sorteo is uniform, committed before animation, and never resurrected after clear or reset.

## ADDED Requirements

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

The system SHALL hold the reveal timeout in a cancellable handle with a named spin base of 2750 ms, and clearing or resetting the session SHALL cancel any in-flight reveal so no ghost result appears.

#### Scenario: Clear cancels in-flight reveal

- **WHEN** the operator clears the list mid-spin
- **THEN** the pending reveal never fires and no deleted song is shown

#### Scenario: Reset cancels in-flight reveal

- **WHEN** the operator resets the session mid-spin
- **THEN** the pending reveal never fires and the board stays in its reset state

#### Scenario: Spin base is a single named constant

- **WHEN** the spin duration is inspected
- **THEN** exactly one constant defines the 2750 ms base, separate from any public-screen delay

### Requirement: Spinning guard blocks draw and confirm

The system SHALL reject any new draw or played/void confirmation while a spin is in flight.

#### Scenario: Double draw blocked

- **WHEN** a second draw is triggered while spinning
- **THEN** it returns no result and state is unchanged

#### Scenario: Confirm blocked mid-spin

- **WHEN** confirmation is attempted while spinning
- **THEN** it has no effect until the reveal completes
