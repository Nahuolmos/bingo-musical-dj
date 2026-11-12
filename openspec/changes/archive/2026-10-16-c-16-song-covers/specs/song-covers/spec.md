# Spec Delta — song-covers

## Purpose

Gives each catalog song an optional cover image resolved pre-show or set manually, rendered on the public screen with a deterministic generative fallback so the show never depends on the network.

## ADDED Requirements

### Requirement: Cover resolution at import is best-effort and never blocks

The system SHALL attempt to resolve one cover URL per imported song via a keyless CORS-enabled music API, storing the URL on success and `null` on any failure, without blocking or failing the import. Resolution is a PRE-SHOW activity: per-song timeout is generous (12 s per attempt) with one retry on transient failure, maximizing automatic online completion before falling back to manual loading.

#### Scenario: Match stores cover URL

- **WHEN** the API returns a match with artwork for an imported song
- **THEN** the song carries that artwork URL as `coverUrl` and the import counts report normally

#### Scenario: Transient failure retries once, then resolves

- **WHEN** the first attempt times out, aborts, or the request rejects
- **THEN** the system retries exactly once; a match on the retry stores `coverUrl` as normal

#### Scenario: No match stores null without error and without retry

- **WHEN** the API returns a valid response with no match for a song
- **THEN** the song carries `coverUrl: null` with exactly one request issued, and renders the generative placeholder

#### Scenario: Repeated failure stores null for manual completion

- **WHEN** both the initial attempt and the retry fail (or the API request fails terminally)
- **THEN** the song carries `coverUrl: null`, the import report notes covers were skipped, the per-row manual field (remote URL or `assets/covers/` file) remains available pre-show, and no error blocks the catalog

#### Scenario: Explicit fallback order

- **WHEN** a song has no cover after import
- **THEN** the resolution order is observable as: automatic-online first, then one transient-only retry, then `null` + manual completion — never manual before automatic, never a show-time fetch

#### Scenario: Offline import keeps working coverless

- **WHEN** the import runs with no network access or both the attempt and its retry fail
- **THEN** all songs import with `coverUrl: null`, the import report notes covers were skipped, and no error blocks the catalog

#### Scenario: No fetch outside import

- **WHEN** a draw commits, the public reveal fires, or any render/broadcast runs
- **THEN** zero network requests for covers are issued

### Requirement: Manual cover override per song while unlocked

The system SHALL expose one cover field per song row in the operator list that accepts a remote URL or a local `assets/covers/` filename, previewing the image with fallback to the placeholder.

#### Scenario: Operator sets a remote URL

- **WHEN** the session is unlocked and the operator saves a valid image URL in a song's cover field
- **THEN** that song renders the remote image on the public screen and the value persists via autosave

#### Scenario: Operator sets a local file

- **WHEN** the operator saves a filename present in `assets/covers/`
- **THEN** that song renders the local file offline on the public screen

#### Scenario: Invalid value falls back visibly

- **WHEN** the saved value is empty, unparsable, or points to a missing/unloadable image
- **THEN** the song renders the generative placeholder and the field keeps the raw value for correction

#### Scenario: Cover value is escaped and sandboxed

- **WHEN** the cover value contains markup such as `<script>` or a `javascript:` scheme
- **THEN** it renders as inert text/never executes, and only `http(s)` URLs or bare filenames under `assets/covers/` are honored

### Requirement: Cover render prefers image over placeholder

The system SHALL render the cover image whenever the song carries a usable `coverUrl`, otherwise the deterministic C-14 generative placeholder (same hue and initial).

#### Scenario: Song with cover shows image

- **WHEN** the public screen renders a song with a usable `coverUrl`
- **THEN** the cover slot shows that image instead of the placeholder

#### Scenario: Song without cover keeps placeholder

- **WHEN** the song carries `coverUrl: null`
- **THEN** the cover slot shows the C-14 placeholder with unchanged hue and initial

#### Scenario: Broken remote falls back mid-show

- **WHEN** a remote cover fails to load on the public screen
- **THEN** the slot swaps to the placeholder without breaking counters, title, or history
