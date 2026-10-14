# Spec Delta

## Purpose

Auditable draw history plus an Excel-compatible CSV export that operators use as show evidence across the two-day event, including void reasons and reserved space for administrative unlock entries.

## ADDED Requirements

### Requirement: Every draw produces one ordered history entry

The system SHALL append exactly one history entry per committed draw with monotonic `n` and `es-AR HH:MM:SS` time, and update its status in place on confirm.

#### Scenario: Sequential draws number monotonically with valid time

- **WHEN** three draws commit in order
- **THEN** their `n` values are 1, 2, 3 and each `time` matches `^\d{2}:\d{2}:\d{2}$`

#### Scenario: Confirm updates the entry in place

- **WHEN** the current `drawn` song is confirmed as `played` or `void`
- **THEN** the last entry for that song id changes status with `n`/`time`/snapshot preserved and no new entry is added

### Requirement: History shows visible draw state with motivo

The system SHALL render each entry with state `Sorteada`/`Reproducida`/`Anulada` and append the C-09 motivo for voided entries, escaped so markup stays inert.

#### Scenario: Voided entry shows motivo

- **WHEN** a song is voided with reason R
- **THEN** the operator history shows the void state together with R

#### Scenario: Markup motivo renders inert

- **WHEN** the motivo contains markup such as `<script>`
- **THEN** it renders as escaped text with no executable element

### Requirement: Excel-compatible CSV export with motivo column

The system SHALL export `music-bingo-historial.csv` with columns `Nº,Título,Artista,Estado,Hora,Motivo`, RFC-4180 double-quote escaping, CRLF line endings, and a leading BOM so Excel opens it correctly.

#### Scenario: CSV opens in Excel with BOM and header

- **WHEN** the operator exports with any history content
- **THEN** the file starts with BOM `\ufeff`, the first line is the six-column header, and every field is double-quoted

#### Scenario: RFC quoting survives commas, quotes, and newlines

- **WHEN** a title, artist, or motivo contains a comma, double quote, or line break
- **THEN** the CSV field wraps in quotes with inner quotes doubled and parses back to the original value

#### Scenario: Motivo present in CSV

- **WHEN** a void with reason R is exported
- **THEN** the row for that entry carries R in the Motivo column

### Requirement: CSV cells sanitized against formula injection

The system SHALL neutralize cells whose first character is `=`, `+`, `-`, or `@` so spreadsheet apps never interpret them as formulas.

#### Scenario: Formula-like cell sanitized

- **WHEN** a title, artist, or motivo starts with `=cmd` (or `+`, `-`, `@`)
- **THEN** the exported cell is prefixed so Excel treats it as text and the original characters remain recoverable

### Requirement: Empty history exports header-only CSV

The system SHALL produce a valid CSV containing only the header row when history is empty, and surface a visible notice instead of failing silently.

#### Scenario: Empty export is header-only and valid

- **WHEN** the operator exports with zero entries
- **THEN** the file contains exactly the header line with BOM and parses as zero data rows

### Requirement: Delayed reveal never duplicates rows

The system SHALL keep history single-writer: the C-08 delayed public reveal adds no entry, so one committed draw always equals one history row and one CSV row.

#### Scenario: Reveal adds no entry

- **WHEN** the public reveal fires after the delay for a committed draw
- **THEN** history still holds exactly one entry for that draw

### Requirement: Entry shape reserves administrative unlock entries

The system SHALL accept history entries not tied to a song draw (C-11 administrative unlocks with motivo and visible state) in both the panel history and the CSV, without implementing unlock in this change.

#### Scenario: Unlock entry renders and exports

- **WHEN** a future unlock entry (monotonic `n`, timestamp, visible state, motivo) exists in history
- **THEN** it renders in the operator history and exports as a CSV row without breaking ordering or parsing

#### Scenario: No unlock behavior in this change

- **WHEN** this change is applied
- **THEN** no unlock control, guard change, or lock mutation is introduced

### Requirement: Export-first reset warning and fast controls

The system SHALL warn "Exportá el historial primero" on reset without forcing export, keep export/reset as large single actions completing under 2 s, and recommend the day-1 export in the pre-show checklist.

#### Scenario: Reset warns without forcing

- **WHEN** the operator resets with non-empty history
- **THEN** the confirmation mentions exporting first yet still allows proceeding after confirm

#### Scenario: Day-1 export in checklist

- **WHEN** the pre-show checklist is read
- **THEN** it recommends exporting at the end of day 1 for the two-day event
