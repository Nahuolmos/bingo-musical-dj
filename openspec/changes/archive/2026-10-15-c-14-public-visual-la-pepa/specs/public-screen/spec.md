# Spec Delta — public-screen (C-14 visual La Pepa)

## ADDED Requirements

### Requirement: La Pepa visual identity on the public screen

The system SHALL render the public screen with the Bodegón La Pepa identity: solid red background with cream frame, real logo on top, vinyl + cover art in the center, and title / artist / recent songs below in cream.

#### Scenario: Red background with cream frame

- **WHEN** the public screen is opened in any phase
- **THEN** the page shows a solid red background with a cream outer frame matching the reference layout

#### Scenario: Real logo on top

- **WHEN** the public screen renders
- **THEN** the header shows the versioned `Logo-La-Pepa` artwork instead of the generic LOGO placeholder

#### Scenario: Vinyl and cover in the center

- **WHEN** the public screen renders
- **THEN** the center stage shows a vinyl + cover composition per `referencia-página-pública.png` (cover static, vinyl spins during the spinning phase)

#### Scenario: Title artist recents below in cream

- **WHEN** a reveal syncs state
- **THEN** title, artist and the recent-songs pills render below the stage in cream, legible at projector distance

### Requirement: Dual typography with offline fallback

The system SHALL use a dual type stack (bold condensed block for headlines + handwritten accent) evoking the La Pepa references, with custom fonts only if vendored locally and always with a system fallback.

#### Scenario: System stack evokes the style without vendor

- **WHEN** no local font is vendored
- **THEN** headlines render in a bold condensed system stack and accents in a handwritten-capable system stack, with no network request

#### Scenario: Vendored fonts keep offline-first

- **WHEN** custom fonts are adopted
- **THEN** they load from a local `vendor/` path (same pattern as SheetJS in C-05) with the system stack as fallback, and the offline smoke passes with no CDN reference in the public path

#### Scenario: No CDN on the public path

- **WHEN** the public page and its scripts are inspected
- **THEN** no stylesheet, font, or script URL points to a CDN or remote host

### Requirement: Recent-songs pills preserved as data

The system SHALL keep the counter and last-five entries from the C-08 snapshot and render them as cream pills on red without changing their content.

#### Scenario: Counter and last-five match operator snapshot

- **WHEN** any render or reveal syncs state
- **THEN** the public screen shows the counter and the last five entries matching the operator snapshot (C-08 contract unchanged)

#### Scenario: Pills legible on red

- **WHEN** the recent-songs row renders
- **THEN** each entry appears as a distinct pill with contrast sufficient for projector distance

### Requirement: Behavior contracts unchanged

The system SHALL keep all six C-08 public-screen requirements intact: two-phase reveal without spoiler, named 3000 ms delay, standalone popup lifecycle, read-only contract, buffer-aware guards, and commit-before-render with single history entry.

#### Scenario: Spinning still hides the title

- **WHEN** a draw commits and the operator wheel is spinning or the post-spin buffer is in flight
- **THEN** the public screen shows the spinning vinyl state with no committed title or artist

#### Scenario: Reveal delay still configurable

- **WHEN** the public delay constant is inspected or tuned
- **THEN** exactly one constant defines the 3000 ms public delay and the reveal fires after the new delay within 250 ms tolerance
