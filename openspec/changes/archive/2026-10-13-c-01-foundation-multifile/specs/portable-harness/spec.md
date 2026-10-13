# Spec Delta — portable-harness

## Purpose

Defines the no-build portable test harness that proves the multi-file split loads and behaves identically in browser and Node.

## ADDED Requirements

### Requirement: No-build Node test runner

The system SHALL provide `tests/*.test.js` runnable with Node's built-in runner (`node --test`) and zero build step, importing the split `js/*.js` files rather than the monolith.

#### Scenario: Node runner passes offline

- **WHEN** a developer runs the Node test command with no network and no `npm install`
- **THEN** all `tests/*.test.js` execute and report pass/fail without fetching remote dependencies

### Requirement: Browser mirror opens by double-click

The system SHALL provide a `tests.html` mirror that runs the same checks by double-click via `file://` in Chrome/Edge, so verification works on the event machine without Node.

#### Scenario: Double-click test mirror

- **WHEN** the operator double-clicks `tests.html` with no server
- **THEN** the page runs the harness checks and shows per-module pass/fail with no console errors

### Requirement: Per-module load verification

The harness SHALL verify every `js/*.js` module loads standalone in both Node and the browser mirror, failing explicitly on the first unloadable module.

#### Scenario: Missing module fails loudly

- **WHEN** any `js/*.js` file is absent or throws at load
- **THEN** the harness reports that module as failed by name instead of passing silently

### Requirement: No-regression gate for operator and public screens

The harness SHALL include no-visual-regression checks proving operator and public screens render identically to the monolith reference after the split.

#### Scenario: Regression blocks promotion

- **WHEN** any operator or public no-regression check fails
- **THEN** the change is not promotable and the monolith remains the reference until the check passes
