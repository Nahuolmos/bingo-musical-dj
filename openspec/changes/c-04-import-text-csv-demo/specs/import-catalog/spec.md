# Spec Delta

## Purpose

Offline catalog loading for the DJ — pasted text, CSV/TSV rows, and a 12-song demo seed — with normalized dedupe, visible counts, and locked-session gating, all working without internet.

## ADDED Requirements

### Requirement: Line normalization splits artist and title
The system SHALL normalize each pasted line by trimming, stripping leading numbering, and splitting artist/title on the first dash-like separator, yielding title-only with empty artist when no separator exists.

#### Scenario: Artist-title split
- **WHEN** operator pastes `Shakira - Hips Don't Lie`
- **THEN** catalog holds title `Hips Don't Lie` with artist `Shakira` and status `available`.

#### Scenario: Numbering stripped and title-only kept
- **WHEN** operator pastes `01. Soda Stereo - De Musica Ligera` and a bare `Gasolina`
- **THEN** first entry strips `01.` keeping artist/title, second entry keeps title `Gasolina` with empty artist.

#### Scenario: Empty lines ignored
- **WHEN** input contains blank or whitespace-only lines
- **THEN** they produce no song entries and do not affect counts.

### Requirement: Text CSV TSV parsing with separators and header skip
The system SHALL accept `,`/`;`/tab separators and `Artista - Titulo` lines, treat first cell as artist and remainder as title for multi-cell rows (except URL-led rows), and skip a first header row matching title/song words with a separator.

#### Scenario: Comma semicolon tab rows
- **WHEN** operator pastes `Dua Lipa;Levitating`, `Rafaga<TAB>Mentirosa`, and `Queen,Don't Stop Me Now`
- **THEN** each yields the correct artist/title pair as `available` songs.

#### Scenario: Header row skipped
- **WHEN** pasted text starts with `Titulo,Artista` followed by one data row
- **THEN** only the data row is imported and the header never becomes a song.

#### Scenario: URL-led row falls back to line parsing
- **WHEN** a CSV row starts with `http` in the first cell
- **THEN** the row is parsed as a plain line instead of artist/title cells.

### Requirement: Normalized dedupe with visible counts
The system SHALL dedupe by normalized `title|artist` key (lowercase, diacritics stripped, collapsed spaces) both intra-import and against the existing list, and report `N nueva(s), M duplicado(s) omitido(s)` with nothing dropped silently.

#### Scenario: Duplicates counted visibly
- **WHEN** importing a batch containing repeats and songs already in the list
- **THEN** only new songs are added and the message states new and duplicate counts.

#### Scenario: Diacritics and case treated equal
- **WHEN** list has `Música Ligera | Soda Stereo` and import brings `musica ligera | soda stereo`
- **THEN** the second is counted as duplicate and not added.

### Requirement: Empty input is reported, never silent
The system SHALL report `No se detectaron canciones. Revisá el formato del archivo o pegá el texto manualmente.` when an import batch yields zero songs, without mutating the catalog.

#### Scenario: Empty paste reported
- **WHEN** operator imports empty text or only blank lines
- **THEN** catalog is unchanged and the empty-input message is shown.

### Requirement: Twelve-song demo seeds without duplication
The system SHALL seed exactly the 12 canonical demo songs through the same dedupe path, so repeat presses add only missing songs and never duplicate.

#### Scenario: Demo inserts twelve then idempotent
- **WHEN** operator presses demo on an empty list and again
- **THEN** first press adds 12 songs and second press adds 0 with duplicates reported.

### Requirement: List review before show
The system SHALL show the full catalog with title/artist, per-song status, total/available/drawn counters, text filter over title+artist, and `Artista no especificado` label for empty artist.

#### Scenario: Review list with filter and counters
- **WHEN** catalog holds songs with mixed states and operator types a filter query
- **THEN** visible rows filter by title+artist, counters stay accurate, and artist-less rows show the unspecified label.

### Requirement: Locked session rejects direct import
The system SHALL reject direct paste/demo import while `Session.locked=true`, surfacing a blocked message that points to the C-11 administrative unlock instead of mutating the list.

#### Scenario: Import blocked when locked
- **WHEN** session is locked and operator attempts paste or demo import
- **THEN** no songs are added and a blocked message naming the administrative unlock is shown.

#### Scenario: Import allowed when unlocked
- **WHEN** session has `locked=false`
- **THEN** paste and demo imports proceed per the requirements above.
