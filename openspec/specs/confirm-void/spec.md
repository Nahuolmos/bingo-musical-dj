# confirm-void Specification

## Purpose

Confirms each committed draw as played or voids it with a mandatory persisted reason, so every draw ends in an auditable terminal state and no voided song can return to the pool.

## Requirements

### Requirement: Played confirmation closes the draw

The system SHALL confirm the current `drawn` song as `played` via in-place history update, clear `current`, and only allow this when a spin and the C-08 public buffer are both finished.

#### Scenario: Mark played after reveal

- **WHEN** the operator confirms with `current` in `drawn` and no spin or buffer pending
- **THEN** the song and its last history entry become `played` and `current` clears

#### Scenario: Played blocked mid-spin or mid-buffer

- **WHEN** confirmation is attempted while spinning or while the public buffer is pending
- **THEN** it has no effect and song, history, and `current` are unchanged

#### Scenario: Played with no current draw is a no-op

- **WHEN** there is no `current` or it is not in `drawn`
- **THEN** no song or history entry changes

### Requirement: Void requires a mandatory non-empty reason

The system SHALL require a non-empty trimmed reason collected via `prompt()` plus an explicit `confirm()` before voiding; cancelling or submitting an empty reason aborts with no state change.

#### Scenario: Void without reason is blocked

- **WHEN** the operator submits an empty or whitespace-only reason
- **THEN** the void is rejected and song, history, and `current` stay `drawn`

#### Scenario: Cancelled prompt or confirm aborts

- **WHEN** the operator cancels the reason prompt or declines the confirmation
- **THEN** nothing changes and the song remains `drawn` pending

#### Scenario: Valid reason voids the draw

- **WHEN** the operator provides a non-empty reason and confirms
- **THEN** the song and its last history entry become `void` carrying the trimmed reason, and `current` clears

### Requirement: Void reason persists and stays visible

The system SHALL store the trimmed reason on the voided history entry, survive page refresh through the session autosave, and render it in the operator list and history.

#### Scenario: Reason persists across refresh

- **WHEN** the page reloads after a void with reason R
- **THEN** the restored history entry still carries R with `void` status

#### Scenario: Reason visible in list and history

- **WHEN** a song is voided with reason R
- **THEN** the operator list shows it as `Anulada — R` and the history shows the void state with R

#### Scenario: Reason rendered inert

- **WHEN** the reason contains markup such as `<script>`
- **THEN** it renders as escaped text with no executable element

### Requirement: Void is terminal with no re-entry

The system SHALL exclude `void` songs from the eligible pool permanently in v1 and surface the organizer notice, with no path back to `available` without an explicit approved rule.

#### Scenario: Voided song never returns to the pool

- **WHEN** a song is voided
- **THEN** it never appears in the available pool for later draws

#### Scenario: Organizer notice on void

- **WHEN** a void commits
- **THEN** the operator sees that the song is excluded and must inform the organizer

### Requirement: Confirm controls gate on current, spin, and buffer

The system SHALL enable played/void confirmation only with `current` in `drawn` and with neither spin nor public buffer pending, keeping the draw control under the same spin-plus-buffer lock.

#### Scenario: Buttons disabled without a pending draw

- **WHEN** there is no `current` in `drawn`
- **THEN** both confirm controls stay disabled

#### Scenario: Buttons disabled through spin and buffer

- **WHEN** a spin is in flight or the public buffer is pending
- **THEN** draw and both confirm controls stay disabled until the public reveal completes

### Requirement: Copy title and artist for manual VirtualDJ cue

The system SHALL offer a copy action that places `title — artist` (title only when artist is empty) on the clipboard with a legacy prompt fallback, without mutating draw state.

#### Scenario: Copy leaves draw state untouched

- **WHEN** the operator copies the current draw
- **THEN** clipboard holds the formatted string and song, history, and `current` are unchanged

#### Scenario: Copy with no current draw is a no-op

- **WHEN** there is no `current`
- **THEN** the copy action does nothing
