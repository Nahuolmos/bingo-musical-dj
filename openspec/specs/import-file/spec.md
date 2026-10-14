# import-file Specification

## Purpose

File-based catalog ingestion for the DJ — TXT/CSV/TSV offline, vendored `.xlsx` offline, and PDF/DOCX progressive enhancement — with visible errors and locked-session gating.

## Requirements

### Requirement: Extension routing with visible incompatible-format error
The system SHALL route the chosen file by lowercase extension and report `Formato no compatible. Usá PDF, DOCX, TXT, CSV o XLSX.` for any other extension, without mutating the catalog.

#### Scenario: Accepted extensions route to readers
- **WHEN** operator chooses files ending in `.txt`, `.csv`, `.tsv`, `.xlsx`, `.pdf`, or `.docx` (any case)
- **THEN** each routes to its reader path instead of the incompatible-format message.

#### Scenario: Unknown extension reported without mutation
- **WHEN** operator chooses `lista.png` or `lista.xlsx.exe`
- **THEN** catalog is unchanged and the incompatible-format message names the five accepted families.

### Requirement: Plain-text files import fully offline
The system SHALL read TXT/CSV/TSV bytes via `File.text()` with no network access and feed the text through the existing parse/dedupe pipeline, handling `,`/`;`/tab separators and common encodings.

#### Scenario: Semicolon and tab CSV import offline
- **WHEN** operator loads a `.csv` with `Dua Lipa;Levitating` rows or a `.tsv` with tab-separated rows while offline
- **THEN** songs import with correct artist/title pairs and the standard `N nueva(s), M duplicado(s)` report.

#### Scenario: Offline plain-text never hits the network
- **WHEN** operator imports any TXT/CSV/TSV with the network disabled
- **THEN** the import succeeds without loading any external script.

### Requirement: Vendored xlsx reads first worksheet offline
The system SHALL read `.xlsx` fully offline from the locally vendored SheetJS bundle (no CDN), converting the first worksheet rows to text lines for the existing parse/dedupe pipeline.

#### Scenario: Xlsx sheet becomes songs offline
- **WHEN** operator loads a valid `.xlsx` whose first sheet holds `Artista | Título` rows while offline
- **THEN** those rows import as songs with the standard counts report and no network request.

#### Scenario: Empty xlsx guides to CSV fallback
- **WHEN** the `.xlsx` first sheet yields zero songs (empty sheet or header-only)
- **THEN** catalog is unchanged and the message guides to export the sheet to CSV or use "Pegar texto".

### Requirement: PDF DOCX load progressively with offline fallback message
The system SHALL load pdf.js 3.11.174 (+ worker) for PDF and mammoth 1.8.0 for DOCX on demand only, and on any load/read failure report `No se pudo leer el archivo. Si es PDF/DOCX, verificá internet o copiá el texto y usá "Pegar texto".` without mutating the catalog.

#### Scenario: PDF text extracted when online
- **WHEN** operator loads a text-based `.pdf` with internet available
- **THEN** extracted page text flows through the parse/dedupe pipeline with the standard report.

#### Scenario: PDF without internet shows fallback
- **WHEN** operator loads a `.pdf` with the network disabled or cdnjs blocked
- **THEN** no songs are added and the fallback message points to "Pegar texto".

#### Scenario: DOCX without internet shows fallback
- **WHEN** operator loads a `.docx` with the network disabled or cdnjs blocked
- **THEN** no songs are added and the fallback message points to "Pegar texto".

### Requirement: Empty or unreadable files are reported, never silent
The system SHALL report `No se detectaron canciones. Revisá el formato del archivo o pegá el texto manualmente.` when any file yields zero songs, and reset the file input so the same file can be retried.

#### Scenario: Blank file reported
- **WHEN** operator loads an empty `.txt` or a file with only blank lines
- **THEN** catalog is unchanged, the nothing-detected message is shown, and re-choosing the file fires the handler again.

### Requirement: Locked session blocks file import with shared message
The system SHALL reject every file import while `Session.locked=true`, showing `Lista bloqueada. Usá el Desbloqueo administrativo (C-11) para modificar el listado.` with no mutation and the file input reset.

#### Scenario: File blocked when locked
- **WHEN** session is locked and operator chooses any accepted file type
- **THEN** no songs are added, the blocked message is shown verbatim, and no external library is loaded.

#### Scenario: File allowed when unlocked
- **WHEN** session has `locked=false`
- **THEN** file imports proceed per the requirements above.
