# public-screen Specification

## Purpose

Delayed two-phase public reveal for the live show, so the projector never spoils the result and the DJ gets a manual VirtualDJ cue buffer after the operator spin.

## Requirements

### Requirement: Two-phase reveal without spoiler

The system SHALL show the committed title at once on the dashboard at commit time, keep a title-free word-scrolling buffer phase on the public screen, and reveal the committed title publicly only after the public delay elapses.

#### Scenario: Dashboard shows the title immediately

- **WHEN** a draw commits
- **THEN** the dashboard shows the committed title and artist at once with the copy action available

#### Scenario: Public shows no title during operator spin

- **WHEN** a draw commits and the dashboard already shows the result
- **THEN** the public screen still shows no committed title and shows the word-scrolling buffer instead

#### Scenario: Public shows no title during the post-spin buffer

- **WHEN** the public delay has not yet elapsed after a commit
- **THEN** the public screen still shows no committed title and shows the word-scrolling buffer instead

#### Scenario: Public reveals after the delay

- **WHEN** the public delay elapses after a commit
- **THEN** the public screen reveals the committed title and artist, matching the operator result

### Requirement: Named public delay separate from spin base

The system SHALL define the public reveal delay as a single named constant of 5000 ms.

#### Scenario: Delay constant is named and testable

- **WHEN** the delay value is inspected
- **THEN** exactly one constant defines the 5000 ms public delay

#### Scenario: Reveal timing tracks the constant

- **WHEN** the public delay constant is tuned
- **THEN** the reveal fires after the new delay without changing the prior commit

#### Scenario: Reveal tolerance in live sync

- **WHEN** a draw completes end to end
- **THEN** the public reveal lands within 500 ms of the configured delay after the commit

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

- **WHEN** the post-commit buffer is in flight
- **THEN** the public screen shows the scrolling remaining-songs buffer instead of the committed title, falling back to a neutral title-free waiting text when motion is reduced or no song remains

#### Scenario: Rendered strings are escaped

- **WHEN** a title or artist contains markup
- **THEN** the public screen renders it as inert text with no script execution, including inside scrolling entries

### Requirement: Buffer-aware input guards and cancellation

The system SHALL disable draw and confirmation during the public buffer, and clearing or resetting SHALL cancel the pending public reveal.

#### Scenario: Draw and confirm disabled through the buffer

- **WHEN** the post-commit public buffer is in flight
- **THEN** draw and played/void confirmation have no effect until the public reveal completes

#### Scenario: Clear cancels both pending reveals

- **WHEN** the operator clears the list mid-buffer
- **THEN** the pending public reveal (the only remaining reveal window) never fires afterward

#### Scenario: Reset cancels both pending reveals

- **WHEN** the operator resets the session mid-buffer
- **THEN** the pending public reveal (the only remaining reveal window) never fires afterward

#### Scenario: No overlapping reveals

- **WHEN** draws, clears, or resets interleave with a pending buffer
- **THEN** at most one public reveal fires per commit and no stale title ever renders

### Requirement: Commit-before-render preserved with single history entry

The system SHALL keep the synchronous commit intact and produce exactly one history entry per draw regardless of the delayed reveal.

#### Scenario: Result committed before any phase message

- **WHEN** a draw is triggered
- **THEN** song status, current pointer, and history entry exist before the first spinning-phase message or animation frame

#### Scenario: Delayed reveal adds no history entry

- **WHEN** the public reveal fires after the delay
- **THEN** history still holds exactly one entry for that draw with no duplicate

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

The system SHALL keep all six C-08 public-screen requirements intact as retuned by this change: dashboard-instant plus public two-phase reveal without spoiler, named 5000 ms delay, standalone popup lifecycle, read-only contract, buffer-aware guards, and commit-before-render with single history entry.

#### Scenario: Spinning still hides the title

- **WHEN** a draw commits and the post-commit buffer is in flight
- **THEN** the public screen shows the word-scrolling buffer state with no committed title or artist

#### Scenario: Reveal delay still configurable

- **WHEN** the public delay constant is inspected or tuned
- **THEN** exactly one constant defines the 5000 ms public delay and the reveal fires after the new delay within 500 ms tolerance

### Requirement: Word-scrolling buffer without spoiler

The system SHALL scroll the names of remaining songs vertically on the public screen during the buffer, fed by the remaining-titles payload of the commit message, and SHALL close the scroll with the real title reveal when the delay elapses.

#### Scenario: Scroll shows only remaining songs

- **WHEN** the buffer scroll renders
- **THEN** every scrolled entry is a song still available at commit time and none matches the committed title, artist, or id

#### Scenario: Drawn song excluded even with colliding titles

- **WHEN** another remaining song shares the committed title text
- **THEN** the scroll still excludes the drawn song id and reveals nothing identifying the draw before the reveal

#### Scenario: Scroll closes with the real reveal

- **WHEN** the public delay elapses
- **THEN** the scroll stops and the committed title and artist render in place of the scroll

#### Scenario: Scroll payload travels offline

- **WHEN** the commit message syncs over BroadcastChannel or the file:// storage mirror
- **THEN** the remaining-titles payload arrives with the same message, with zero network requests

#### Scenario: Empty remaining pool degrades gracefully

- **WHEN** no song remains available at commit time
- **THEN** the public screen shows a neutral waiting state with no title until the reveal, instead of an empty or broken scroll

#### Scenario: Scroll respects reduced motion

- **WHEN** the viewer prefers reduced motion
- **THEN** the buffer shows a static neutral waiting state with no title until the reveal, instead of animating
