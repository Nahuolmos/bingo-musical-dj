# Spec Delta — public-screen

## MODIFIED Requirements

### Requirement: Two-phase reveal without spoiler

The system SHALL show the committed title at once on the dashboard at commit time, hold the public screen in a title-free neutral gated wait until the DJ triggers the reveal gate, and only then run the title-free word-scrolling buffer phase and reveal the committed title publicly after the public delay elapses from the gate.

#### Scenario: Dashboard shows the title immediately

- **WHEN** a draw commits
- **THEN** the dashboard shows the committed title and artist at once with the copy action available

#### Scenario: Public waits neutral with no title and no scroll before the gate

- **WHEN** a draw commits and the DJ has not yet triggered the reveal gate
- **THEN** the public screen shows the neutral gated wait with no committed title and no word-scroll animation

#### Scenario: Public shows no title during operator spin

- **WHEN** a draw commits and the dashboard already shows the result
- **THEN** the public screen still shows no committed title and shows the gated wait instead of the word-scrolling buffer

#### Scenario: Public shows no title during the post-spin buffer

- **WHEN** the public delay has not yet elapsed after the reveal gate
- **THEN** the public screen still shows no committed title and shows the word-scrolling buffer instead

#### Scenario: Public reveals after the delay

- **WHEN** the public delay elapses after the reveal gate
- **THEN** the public screen reveals the committed title and artist, matching the operator result

### Requirement: Buffer-aware input guards and cancellation

The system SHALL disable draw and confirmation during the gated wait and the public buffer, and clearing or resetting SHALL cancel the pending gate or public reveal.

#### Scenario: Draw and confirm disabled through the buffer

- **WHEN** the post-commit gated wait or public buffer is in flight
- **THEN** draw and played/void confirmation have no effect until the public reveal completes

#### Scenario: Reveal gate triggers the public buffer

- **WHEN** the DJ triggers the reveal gate while a gated wait is pending
- **THEN** the word-scrolling buffer starts and the public reveal fires after the public delay

#### Scenario: Clear cancels both pending reveals

- **WHEN** the operator clears the list mid-gate or mid-buffer
- **THEN** the pending gate never triggers and the pending public reveal (the only remaining reveal window) never fires afterward

#### Scenario: Reset cancels both pending reveals

- **WHEN** the operator resets the session mid-gate or mid-buffer
- **THEN** the pending gate never triggers and the pending public reveal (the only remaining reveal window) never fires afterward

#### Scenario: No overlapping reveals

- **WHEN** draws, gates, clears, or resets interleave with a pending gate or buffer
- **THEN** at most one public reveal fires per commit and no stale title ever renders

## ADDED Requirements

### Requirement: Neutral gated wait with DJ-only trigger

The system SHALL hold the public screen in a neutral gated wait (no title, no scroll, cover placeholder) until the DJ triggers the reveal from the dashboard.

#### Scenario: Gated wait shows its own message

- **WHEN** the gated wait is in flight
- **THEN** the public screen shows a neutral waiting text distinct from the in-buffer cabin message, with no committed title, artist, or cover image

#### Scenario: Gated cover slot stays neutral

- **WHEN** the gated wait is in flight
- **THEN** the cover slot shows the neutral placeholder with no committed artwork, closing with the real cover only at reveal

#### Scenario: Re-sync mid-gate never leaks the title

- **WHEN** the public screen opens or re-syncs while a gated wait is pending
- **THEN** it renders the neutral gated wait with no committed title, artist, cover, or scroll content

#### Scenario: No auto-reveal without the DJ

- **WHEN** a gated wait is pending and the DJ never triggers the gate
- **THEN** no scroll starts and no reveal fires; the wait holds until the DJ acts or the gate is cancelled
