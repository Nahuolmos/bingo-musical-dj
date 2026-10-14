# Spec Delta — history-export

## MODIFIED Requirements

### Requirement: Entry shape reserves administrative unlock entries

The system SHALL write administrative unlock entries (C-11 writer): each committed unlock appends exactly one song-less history entry with monotonic `n`, `es-AR HH:MM:SS` time, a visible administrative state, and the trimmed unlock motivo, rendered in the operator history and exported as a CSV row with the motivo in the Motivo column.

#### Scenario: Unlock entry renders and exports

- **WHEN** an unlock commits with motivo R
- **THEN** it renders in the operator history with visible unlock state and R, and exports as a CSV row carrying R in the Motivo column without breaking ordering or parsing

#### Scenario: Unlock entry persists across refresh

- **WHEN** the page reloads after an unlock with motivo R
- **THEN** the restored history still holds the unlock entry with R and `locked=false`

#### Scenario: No unlock behavior in this change

- **WHEN** this change (C-11, the unlock writer) is applied
- **THEN** the reservation ends: the unlock control, motivo-plus-double-confirm flow, and lock mutation to `locked=false` introduced here become the single writer of unlock entries (superseding the C-10 no-behavior statement)
