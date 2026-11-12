# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Build features or fix bugs test-first, mentions "red-green-refactor", or wants integration tests | tdd | C:\Users\Lenovo\.agents\skills\tdd\SKILL.md |
| Building new UI or reshaping an existing one, aesthetic direction / typography | frontend-design | C:\Users\Lenovo\.agents\skills\frontend-design\SKILL.md |
| Review a branch, a PR, work-in-progress changes, or "review since X" | code-review | C:\Users\Lenovo\.agents\skills\code-review\SKILL.md |
| Design / redesign / polish / critique / audit frontend interface (landing, dashboard, app shell, components, empty states) | impeccable | C:\Users\Lenovo\.agents\skills\impeccable\SKILL.md |
| Writing Playwright tests, fixing flaky tests, debugging failures, POM, CI/CD, mocking, a11y | playwright-best-practices | C:\Users\Lenovo\.agents\skills\playwright-best-practices\SKILL.md |
| Implementing E2E tests, debugging flaky tests, or establishing testing standards (Playwright/Cypress) | e2e-testing-patterns | C:\Users\Lenovo\.agents\skills\e2e-testing-patterns\SKILL.md |
| Writing JavaScript/TypeScript tests, setting up test infrastructure, TDD/BDD (Jest, Vitest, Testing Library) | javascript-testing-patterns | C:\Users\Lenovo\.agents\skills\javascript-testing-patterns\SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### tdd
- Red before green: write the failing test first, then only enough code to pass it; no speculative features.
- One slice at a time: one seam, one test, one minimal implementation per cycle (vertical tracer bullets, never horizontal "all tests first").
- Test at pre-agreed seams only: confirm public interface/seams with user before writing tests; never test internals/private methods.
- Never mock internal collaborators or assert via side channels (DB queries); test observable behavior through the public interface.
- Expected values must come from an independent source of truth (literal, worked example, spec) — never recompute them the way the code does.
- Refactoring belongs to the review stage (code-review skill), not the red-green loop.
- Project seams for Music Bingo DJ: sorteo sin repetición, lista vacía, una sola canción, importación, recuperación de estado.

### frontend-design
- Ground every design in the brief subject: bingo musical en vivo, proyector a distancia + panel DJ separado; confirm subject/audience/job before designing.
- Plan first, build after: compact token system (4-6 named hex colors, 1-2 typefaces with roles, layout concept + ASCII wireframe, principles); revise anything that reads as generic default.
- Never ship AI-default looks unless the brief asks: cream #F4F1EA + terracotta #D97757 serif, near-black + acid-green, broadsheet hairlines, SaaS-card kit, ALL-CAPS eyebrows, `A · B · C` meta strings, `WORD — fragment` labels, `→` on links.
- Typography: 1-2 families max, clear scale, <80 chars line length; never accent a single headline word, all-caps labels, or decorative labels above content.
- Motion: one orchestrated moment max; no scattered fade-slide-up per section; motion that answers user action (open/expand/confirm) is welcome.
- Public screen priority: hero = ruleta/título legible a distancia; structural devices (borders, numbers) only if content is truly sequential.
- Copy: active voice, sentence case, CTA = what happens ("Save changes"); errors explain what + how to fix, never apologize; empty states invite action.

### code-review
- Always pin the fixed point first: `git rev-parse <fixed-point>`, diff via `git diff <fixed-point>...HEAD` (three-dot) + `git log <fixed-point>..HEAD --oneline`; fail on bad ref/empty diff.
- Run two parallel axes, never merge: Standards (repo conventions + smell baseline) vs Spec (originating issue/spec); report under separate `## Standards` / `## Spec` headings.
- Standards sources: repo docs (CODING_STANDARDS.md, CONTRIBUTING.md, AGENTS.md) override the Fowler smell baseline; skip anything tooling enforces.
- Smell baseline (judgement calls only): Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man, Refused Bequest.
- Spec source order: issue refs in commits → user-passed path → docs/specs/.scratch matching branch → ask user; if none, skip Spec axis explicitly.
- Music Bingo DJ spec checks: no repetir sorteada, resultado antes de animación, DJ/pública separados, anulación con motivo en historial, sin errores de importación ocultos.
- End with one line per axis: finding count + worst issue; never pick a single winner across axes; each report <400 words.

### impeccable
- The brief wins: honor pinned aesthetics/eras/fonts/palettes even against saturated-pattern warnings; refinement preserves identity, redesign replaces world (never split the difference).
- Pick mode from the surface, not the product: Persuade (decide/act), Operate (complete task — DJ panel), Read (understand — help/changelog), Experience (artifact leads).
- Run `impeccable context --target <path>` once per session (or `.cmd` on Windows sh-less shell); on failure announce it and read PRODUCT.md/DESIGN.md directly; never repair drift as side effect (report CONTEXT_STALE, act only on `auto`).
- Read the request's playbook reference before editing (new-work for new surfaces, operate.md for Operate/Read, craft-floor.md immediately before any UI edit); no-arg requests show routing menu, never auto-run.
- Verify in bounded passes: build fully → one batched screenshot round (desktop + mobile) → fix all in one batch → max one confirm round, then stop; open-ended self-QA is banned.
- Loaded symbols (militarism/supremacy/hate emblems) stay out of decoration; factual documenting content stays as-is.
- Quality floor without announcing: responsive, keyboard focus visible, reduced-motion respected, accessible contrast, harmonious palette; cut decoration that doesn't serve the brief.

### playwright-best-practices
- Prefer role/accessible locators: `getByRole`, `getByLabel`, `getByPlaceholderText`; never CSS-class chains or `nth-child` selectors.
- Never explicit waits/sleeps: use web-first assertions (`expect(locator).toBeVisible()`) and auto-retry; fix flakiness via locators/waits, not timeouts.
- Isolate every test: independent tests, fresh fixtures in `beforeEach`, truncate/clean test data; no cross-test state leaks or parallel-worker coupling.
- Structure: POM or fixtures per `architecture/pom-vs-fixtures.md`; test steps via `test.step()`; tag with `@smoke/@fast/@critical` and filter with `--grep`.
- DJ/pública sync: multi-context tests for BroadcastChannel (two pages/contexts in one test), clock-mocking for ruleta timers, offline/service-worker tests for evento offline-first.
- Validation loop mandatory: `npx playwright test --reporter=list` → trace on fail (`show-trace`) → fix → re-run; critical tests `--repeat-each=5`; fail on console errors where configured.
- Local run is `file://` in Chrome/Edge portable; keep CI config (projects-dependencies, sharding, reporting) separate from local smoke.

### e2e-testing-patterns
- Pyramid: few E2E (critical paths only: sortear, importar, anular, sincronía DJ-pública), more integration, many unit; never test unit logic/edge cases with E2E.
- Test user behavior (click, type, see), never implementation details; assert user-visible outcomes (título en pública, historial con motivo).
- Selectors: `data-testid`/`data-cy` or roles only; never CSS classes or DOM structure (bad: `.btn.btn-primary`, `div > form > div:nth-child(2)`).
- Independence + determinism: each test isolated, own data create/destroy, proper waits not fixed timeouts; mock external APIs (CDN pdf.js/mammoth) for speed.
- Page Objects: encapsulate DJ panel / pública page logic; meaningful assertions; parallel execution.
- Debug order: `--headed` → `--debug`/`page.pause()` → trace/screenshot/video → `test.step` reporting.
- Pitfalls to avoid: flaky waits, slow suites, over-testing, coupled tests, no cleanup, testing internals.

### javascript-testing-patterns
- AAA + one behavior per test: Arrange/Act/Assert, descriptive names (`should ...`), `beforeEach` fresh instance, `afterEach` restore spies.
- Stack: Vitest (vite-native, `globals:true`, v8 coverage) or Jest (`ts-jest`, `testEnvironment:node`, 80% thresholds); Testing Library with semantic queries (`getByRole`) over `data-testid`.
- Mock boundaries only: `vi.mock` modules, `vi.fn()` repos, `vi.spyOn` logger; `vi.clearAllMocks()` in `beforeEach`; inject deps (e.g. `IUserRepository`) for testability.
- Cover happy + edge + error: pure functions, classes, async fetch (mock global fetch ok/error), validation errors (lista vacía, 1 canción, duplicados, campos vacíos).
- Factories over literals: `@faker-js/faker` `createUserFixture(overrides?)`; coverage `text/json/html`, exclude `*.d.ts/dist`; timers/promises/snapshots per `references/advanced-testing-patterns.md`.
- Browser APIs in Music Bingo DJ: mock `WebCrypto` (sorteo), `localStorage` (recuperación estado), `BroadcastChannel` (DJ-pública) in unit/integration; real two-page sync only in E2E.
- Never declare a test passed without running it; keep tests fast (mock slow ops), isolated, type-safe TypeScript.

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| AGENTS.md | C:\Users\Lenovo\Desktop\Proyectos\music-bingo-dj-opencode\music-bingo-dj-opencode\AGENTS.md | Index — references files below |
| README.md | C:\Users\Lenovo\Desktop\Proyectos\music-bingo-dj-opencode\music-bingo-dj-opencode\README.md | Referenced by AGENTS.md — read before acting |
| docs/PRODUCT_BRIEF.md | C:\Users\Lenovo\Desktop\Proyectos\music-bingo-dj-opencode\music-bingo-dj-opencode\docs\PRODUCT_BRIEF.md | Referenced by AGENTS.md |
| docs/ACCEPTANCE_CRITERIA.md | C:\Users\Lenovo\Desktop\Proyectos\music-bingo-dj-opencode\music-bingo-dj-opencode\docs\ACCEPTANCE_CRITERIA.md | Referenced by AGENTS.md |
| docs/DECISIONS.md | C:\Users\Lenovo\Desktop\Proyectos\music-bingo-dj-opencode\music-bingo-dj-opencode\docs\DECISIONS.md | Referenced by AGENTS.md |
| docs/WORKFLOW.md | C:\Users\Lenovo\Desktop\Proyectos\music-bingo-dj-opencode\music-bingo-dj-opencode\docs\WORKFLOW.md | Referenced by AGENTS.md — OPSX flow |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.

Product hard rules (from AGENTS.md, mirrored for delegators): no repetir sorteada; resultado antes de animación; DJ/pública separados; VirtualDJ manual (no afirmar integración); anuladas/ausentes/correcciones en historial con motivo; no ocultar errores de importación; offline-first con contingencia explícita si hay internet.
