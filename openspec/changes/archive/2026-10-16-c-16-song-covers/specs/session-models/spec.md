# Spec Delta — session-models

## MODIFIED Requirements

### Requirement: Song entity shape
The system SHALL represent each catalog item as `Song {id, title, artist, status, addedAt, coverUrl}` where `status` is one of `available | drawn | played | void` and `coverUrl` is a string URL/filename or `null` when no cover is set.

#### Scenario: Song carries all fields
- **WHEN** a song is created via the core factory
- **THEN** it exposes a string `id`, non-empty `title`, string `artist` (`''` means unspecified), a valid `status`, an ISO `addedAt` timestamp, and `coverUrl: null` by default

#### Scenario: Default status is available
- **WHEN** a new song enters the session
- **THEN** its `status` is `available`

### Requirement: Session shape with locked and schemaVersion
The system SHALL represent a game as `Session {songs, history, current, spinning, locked, startedAt, schemaVersion}` with `locked=false`, `schemaVersion=2`, and `startedAt` as ISO timestamp on creation.

#### Scenario: Fresh session starts unlocked with schema version
- **WHEN** a session is created
- **THEN** `locked` is `false`, `schemaVersion` is `2`, `songs`/`history` are empty, and `current` is `null`

#### Scenario: Lock and version survive as plain data
- **WHEN** the session object is serialized and restored (C-06)
- **THEN** `locked` and `schemaVersion` round-trip as plain JSON booleans/numbers with no functions or class instances

## ADDED Requirements

### Requirement: Legacy songs without cover migrate to null

The system SHALL treat a song object missing `coverUrl` (pre-C-16 snapshot) as `coverUrl: null` on load, persisting the normalized value on the next autosave.

#### Scenario: Old snapshot hydrates coverless

- **WHEN** a `schemaVersion: 1` snapshot loads with songs lacking `coverUrl`
- **THEN** every song exposes `coverUrl: null` and renders the placeholder until a cover is set
