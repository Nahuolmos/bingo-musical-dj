# Spec Delta — import-file

## ADDED Requirements

### Requirement: File imports enrich covers best-effort

The system SHALL attempt cover resolution for each song after any file reader (TXT/CSV/TSV/XLSX/PDF/DOCX) parse+dedupe succeeds, with the same non-blocking offline behavior as catalog paste imports.

#### Scenario: Online file import resolves covers

- **WHEN** an unlocked file import parses songs with network and API matches
- **THEN** matched songs carry `coverUrl` and the standard counts report is extended with the cover count

#### Scenario: Offline file import keeps songs coverless

- **WHEN** a file import runs offline or the API fails
- **THEN** songs import with `coverUrl: null` plus the visible covers-skipped note, never failing the catalog load

#### Scenario: Locked file import loads no library and resolves nothing

- **WHEN** a file is chosen with `locked=true`
- **THEN** the blocked message is shown verbatim, the input resets, and neither the file reader nor any cover request runs
