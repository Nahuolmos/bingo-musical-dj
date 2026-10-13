# Spec Delta

## Purpose

Consolidates the portable domain model (songs, history, session) that every later draw, import, persistence and lock change consumes, freezing entities, transitions and helpers in one testable contract.

## ADDED Requirements

### Requirement: Song entity shape
The system SHALL represent each catalog item as `Song {id, title, artist, status, addedAt}` where `status` is one of `available | drawn | played | void`.

#### Scenario: Song carries all fields
- **WHEN** a song is created via the core factory
- **THEN** it exposes a string `id`, non-empty `title`, string `artist` (`''` means unspecified), a valid `status`, and an ISO `addedAt` timestamp

#### Scenario: Default status is available
- **WHEN** a new song enters the session
- **THEN** its `status` is `available`

### Requirement: HistoryEntry entity with motivo field
The system SHALL record each draw commitment as `HistoryEntry {n, id, title, artist, status, time, motivo}` where `motivo` defaults to `''` and holds the void reason once C-09 requires it.

#### Scenario: Entry snapshots song at draw time
- **WHEN** a draw is committed
- **THEN** the entry stores the song's `id`, plus frozen copies of `title`/`artist` that do not change if the catalog is edited later

#### Scenario: Motivo field exists but is empty by default
- **WHEN** a draw entry is created in this change
- **THEN** `motivo` is present as `''` (C-09 will enforce non-empty on void)

### Requirement: Session shape with locked and schemaVersion
The system SHALL represent a game as `Session {songs, history, current, spinning, locked, startedAt, schemaVersion}` with `locked=false`, `schemaVersion=1`, and `startedAt` as ISO timestamp on creation.

#### Scenario: Fresh session starts unlocked with schema version
- **WHEN** a session is created
- **THEN** `locked` is `false`, `schemaVersion` is `1`, `songs`/`history` are empty, and `current` is `null`

#### Scenario: Lock and version survive as plain data
- **WHEN** the session object is serialized and restored (C-06)
- **THEN** `locked` and `schemaVersion` round-trip as plain JSON booleans/numbers with no functions or class instances

### Requirement: Song transitions are terminal
The system SHALL allow only `available → drawn → played | void` for `Song.status`; terminal states never return to `available` in v1.

#### Scenario: Valid forward transitions succeed
- **WHEN** an `available` song is drawn and then confirmed as `played` or `void`
- **THEN** each step updates the status accordingly

#### Scenario: Invalid transitions are rejected
- **WHEN** a caller attempts `available → played`, `played → available`, `void → available`, or any backward step
- **THEN** the transition is rejected and the status is unchanged

### Requirement: HistoryEntry updates in place via findLast
The system SHALL update a history entry in place from `drawn` to `played | void` by locating the last entry matching the current song id.

#### Scenario: Confirm updates the matching entry
- **WHEN** the current `drawn` song is confirmed as `played` or `void`
- **THEN** the last history entry with that song id changes to the same terminal status, with `title`/`artist`/`n`/`time` preserved

#### Scenario: History update without current draw is a no-op
- **WHEN** there is no current `drawn` song
- **THEN** no history entry changes

### Requirement: Session derived views
The system SHALL expose derived views `total` (songs count), `remaining` (available count), and `drawn` (non-available count).

#### Scenario: Views reflect mixed statuses
- **WHEN** a session holds 2 `available`, 1 `drawn`, 1 `played`, 1 `void` songs
- **THEN** `total` is 5, `remaining` is 2, and `drawn` is 3

### Requirement: History numbering is unique and monotonic
The system SHALL assign each history entry `n = history.length + 1` at commit time so `n` is unique and strictly increasing.

#### Scenario: Sequential draws number monotonically
- **WHEN** three draws are committed in order
- **THEN** their `n` values are 1, 2, 3 with no gaps or duplicates

### Requirement: Output escaping neutralizes markup
The system SHALL route every song title/artist rendered in the operator list, history, and public screen through `esc()` so markup is inert.

#### Scenario: Script tag is neutralized
- **WHEN** a song titled `<script>alert(1)</script>` is rendered
- **THEN** the output contains `&lt;script&gt;` and no executable script element

### Requirement: makeId format
The system SHALL generate song ids as `'s' + base36(timestamp) + rand` that are unique per call.

#### Scenario: Consecutive ids differ and match shape
- **WHEN** two ids are generated in sequence
- **THEN** both match `^s[0-9a-z]+$` and are not equal

### Requirement: History timestamp format
The system SHALL format history `time` as `es-AR HH:MM:SS` (2-digit hour, minute, second).

#### Scenario: Timestamp matches locale pattern
- **WHEN** a history entry is created
- **THEN** `time` matches `^\d{2}:\d{2}:\d{2}$`
