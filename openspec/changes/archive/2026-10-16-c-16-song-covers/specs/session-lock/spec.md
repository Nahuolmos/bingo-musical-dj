# Spec Delta — session-lock

## ADDED Requirements

### Requirement: Cover field is locked-gated like list edits

The system SHALL refuse cover view-aside, cover set, and cover clear while `Session.locked=true`, disabling the per-row cover control in the operator UI and refusing in the seam with the shared blocked message, with no prompt, no fetch, and no state mutation.

#### Scenario: Cover set refused while locked

- **WHEN** a cover value is submitted with `locked=true`
- **THEN** it returns blocked with `Lista bloqueada. Usá el Desbloqueo administrativo (C-11) para modificar el listado.` and the song is unchanged

#### Scenario: Cover control disabled while locked

- **WHEN** the operator list renders with `locked=true`
- **THEN** every per-row cover control is disabled while the read-only filter stays enabled

#### Scenario: Cover set allowed when unlocked

- **WHEN** a cover value is submitted with `locked=false`
- **THEN** the normal cover-set path executes and persists via autosave
