# Spec Delta — import-catalog

## ADDED Requirements

### Requirement: Paste and demo imports enrich covers best-effort

The system SHALL attempt cover resolution for each song after paste/demo parse+dedupe succeeds, reporting how many covers resolved without changing the `N nueva(s), M duplicado(s)` counts contract.

#### Scenario: Online paste resolves covers

- **WHEN** unlocked paste import runs with network and API matches
- **THEN** matched songs carry `coverUrl` and the report adds the cover count alongside the frozen new/duplicates message

#### Scenario: Offline paste imports without covers

- **WHEN** paste/demo import runs offline or the API fails
- **THEN** songs import with `coverUrl: null` and a visible note that covers were skipped, with counts still reported

#### Scenario: Locked session resolves nothing

- **WHEN** paste/demo import is attempted with `locked=true`
- **THEN** the shared blocked message is shown, no songs are added, and no cover request is issued
