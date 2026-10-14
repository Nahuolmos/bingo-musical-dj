# public-screen Specification

## Purpose

Delayed two-phase public reveal for the live show, so the projector never spoils the result and the DJ gets a manual VirtualDJ cue buffer after the operator spin.

## Requirements

### Requirement: Two-phase reveal without spoiler

The system SHALL show a title-free spinning phase on both screens at commit time and reveal the committed title only after the public delay elapses.

#### Scenario: Public shows no title during operator spin

- **WHEN** a draw commits and the operator wheel is spinning
- **THEN** the public screen shows the spinning state with no title or artist of the committed song

#### Scenario: Public shows no title during the post-spin buffer

- **WHEN** the operator spin has ended but the public delay has not yet elapsed
- **THEN** the public screen still shows no committed title and shows the intermediate cabin-search message

#### Scenario: Public reveals after the delay

- **WHEN** the public delay elapses after the operator spin ends
- **THEN** the public screen reveals the committed title and artist, matching the operator result

### Requirement: Named public delay separate from spin base

The system SHALL define the public reveal delay as a single named constant of 3000 ms, independent of the 2750 ms spin base.

#### Scenario: Delay constant is named and testable

- **WHEN** the delay value is inspected
- **THEN** exactly one constant defines the 3000 ms public delay, separate from the spin constant

#### Scenario: Reveal timing tracks the constant

- **WHEN** the public delay constant is tuned
- **THEN** the reveal fires after the new delay without changing the prior commit or the spin duration

#### Scenario: Reveal tolerance in live sync

- **WHEN** a draw completes end to end
- **THEN** the public reveal lands within 250 ms of the configured delay after the operator spin ends

### Requirement: Standalone public popup lifecycle

The system SHALL open the public screen as a standalone page with refocus, fast re-sync, and clear failure paths.

#### Scenario: Open moves to projector and re-syncs fast

- **WHEN** the operator opens the public screen
- **THEN** it opens the standalone page in the named popup and re-syncs state within about 250 ms

#### Scenario: Reopen refocuses the existing window

- **WHEN** the operator opens the public screen while it is already open
- **THEN** the existing window is refocused and no second window is created

#### Scenario: Blocked popup warns the operator

- **WHEN** the browser blocks the popup
- **THEN** the operator sees an alert explaining how to allow popups for the local file

#### Scenario: Missing broadcast support requires a current browser

- **WHEN** `BroadcastChannel` is unavailable
- **THEN** the system requires an updated Chrome or Edge instead of syncing silently wrong

### Requirement: Read-only projector contract

The system SHALL keep the public screen strictly read-only, legible at projector distance, and consistent with the operator state.

#### Scenario: No private controls on the public screen

- **WHEN** the public screen is inspected during any phase
- **THEN** it exposes no draw, confirm, void, import, clear, reset, or export controls

#### Scenario: Counter and last-five stay consistent

- **WHEN** any render or reveal syncs state
- **THEN** the public screen shows the counter and the last five entries matching the operator snapshot

#### Scenario: Intermediate cabin message during buffer

- **WHEN** the spin or the post-spin buffer is in flight
- **THEN** the public screen shows the cabin-search message instead of the committed title

#### Scenario: Rendered strings are escaped

- **WHEN** a title or artist contains markup
- **THEN** the public screen renders it as inert text with no script execution

### Requirement: Buffer-aware input guards and cancellation

The system SHALL disable draw and confirmation during the spin and the public buffer, and clearing or resetting SHALL cancel both pending reveals.

#### Scenario: Draw and confirm disabled through the buffer

- **WHEN** the spin or the post-spin public buffer is in flight
- **THEN** draw and played/void confirmation have no effect until the public reveal completes

#### Scenario: Clear cancels both pending reveals

- **WHEN** the operator clears the list mid-spin or mid-buffer
- **THEN** neither the operator reveal nor the public reveal fires afterward

#### Scenario: Reset cancels both pending reveals

- **WHEN** the operator resets the session mid-spin or mid-buffer
- **THEN** neither the operator reveal nor the public reveal fires afterward

### Requirement: Commit-before-render preserved with single history entry

The system SHALL keep the synchronous commit intact and produce exactly one history entry per draw regardless of the delayed reveal.

#### Scenario: Result committed before any phase message

- **WHEN** a draw is triggered
- **THEN** song status, current pointer, and history entry exist before the first spinning-phase message or animation frame

#### Scenario: Delayed reveal adds no history entry

- **WHEN** the public reveal fires after the delay
- **THEN** history still holds exactly one entry for that draw with no duplicate
