# Spec Delta — public-screen

## ADDED Requirements

### Requirement: Cover slot prefers song image with placeholder fallback

The system SHALL render the song's `coverUrl` image in the public-screen cover slot whenever usable, else the C-14 generative placeholder with unchanged hue and initial, in both the module `coverFor` and the inline `coverForInline` mirror.

#### Scenario: Reveal with cover shows image

- **WHEN** the revealed song carries a usable `coverUrl`
- **THEN** the cover slot shows that image with title/artist unchanged below

#### Scenario: Reveal without cover keeps placeholder

- **WHEN** the revealed song carries `coverUrl: null`
- **THEN** the cover slot shows the C-14 placeholder with the same hue and initial as before this change

#### Scenario: Broken image degrades without breaking the show

- **WHEN** a `coverUrl` image fails to load on the projector
- **THEN** the slot falls back to the placeholder with counters, title, and recent pills intact

#### Scenario: Spinning phase shows no cover image

- **WHEN** the title-free spinning buffer is in flight
- **THEN** the cover slot shows the neutral placeholder with no committed artwork, closing with the real cover only at reveal

### Requirement: History CSV gains no cover column

The system SHALL keep the history CSV at six columns (`Nº,Título,Artista,Estado,Hora,Motivo`) with no cover data, since covers are catalog attributes persisted in `mbdj.v1`, not draw evidence.

#### Scenario: Export after covers change is six-column

- **WHEN** the operator exports history after setting covers
- **THEN** the file parses with exactly the six header columns and existing quoting/BOM behavior unchanged
