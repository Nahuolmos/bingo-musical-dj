# Spec Delta: public-screen

## MODIFIED Requirements

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

### Requirement: Behavior contracts unchanged

The system SHALL keep all six C-08 public-screen requirements intact as retuned by this change: dashboard-instant plus public two-phase reveal without spoiler, named 5000 ms delay, standalone popup lifecycle, read-only contract, buffer-aware guards, and commit-before-render with single history entry.

#### Scenario: Spinning still hides the title

- **WHEN** a draw commits and the post-commit buffer is in flight
- **THEN** the public screen shows the word-scrolling buffer state with no committed title or artist

#### Scenario: Reveal delay still configurable

- **WHEN** the public delay constant is inspected or tuned
- **THEN** exactly one constant defines the 5000 ms public delay and the reveal fires after the new delay within 500 ms tolerance

## ADDED Requirements

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
