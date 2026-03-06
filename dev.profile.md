# Developer Profile: Jesus Chavez (Execution-Grade Baseline)

## 1) Profile Core
- Senior full-stack engineer with strong UI/UX product mindset.
- Operates as a systems designer: workflows first, screens second.
- Demands production-level architecture, maintainability, and measurable execution quality.
- Futureproof-first mindset: designs software as reusable capability platforms, not one-off screens or isolated scripts.
- Domain focus: Odoo operations, invoicing/e-invoicing, rentals, logistics, accounting-adjacent processes.

## 2) Non-Negotiable Engineering Constraints
- Enforce SoC: orchestration, UI runtime, i18n, config, and integration logic must be separated.
- Enforce SOLID, DRY, KISS in practical terms, not aspirationally.
- Ensure best practices on AOP, OOP, Design Patterns, and Software Engineering.
- Hard cap mindset: if a file exceeds 600 lines, split by responsibility.
- Prefer config/catalog pattern over magic literals and coupled inline constants.
- Prefer directory topology over flat naming when the domain grows: `app/{domain}/{component}.vue` is better than filename-prefix taxonomies.
- Do not encode architecture through redundant prefixes in filenames or symbols when folder boundaries already provide context.
- Keep changes reversible for high-impact platform/UI modifications.
- Use objective naming; avoid branding language in technical architecture.
- No compatibility shim by default: once a replacement runtime contract is approved, remove the old contract in the same migration pass.

## 3) Architecture Expectations
- Frontend:
  - Vue 3 patterns (component contracts + composable behavior), SFC-compatible even in CDN runtime.
  - Component topology must reflect domain structure: layout, primitives, workspace, datatable, forms, dashboards, etc. should live in explicit folders.
  - Reusable UI layers (atoms/components): icon actions, chips, rail links, status primitives.
  - Future-proof component system: enriched, highly abstract UI components that absorb cross-screen common behaviors (states, actions, filters, pagination, accessibility hooks).
  - Generic UI-math layer for reusable interaction logic: ranking, scoring, normalization, thresholds, and state transitions defined by schema/config.
  - Design-oriented generalization: components should encode solution patterns (not just visuals), so the same primitives solve multiple workflows with minimal branching.
  - DOM abstraction layer with graceful fallback (sQuery-first when available, native fallback).
  - i18n externalized from logic; YAML catalog as preferred source.
  - Public runtime contracts must be stable and explicit: namespace, mount ids, component loaders, and asset placeholders are part of the architecture surface.
  - Once a new runtime contract is approved, migrate with a clean hard cut. Do not carry legacy aliases, dual namespaces, or compatibility shims unless there is an explicit rollback requirement.
  - Preview-first architecture: every major UI slice should be demonstrable in a standalone preview before Odoo publication.
- Backend/integration:
  - Domain-oriented services and bridges (clear integration boundaries).
  - Future-proof service abstractions: generic orchestration modules designed for reuse across apps, not tied to one flow.
  - Generalization-first engineering: mathematical/data-model abstractions (classification, scoring, aggregation, normalization) reusable across domains.
  - Policy-and-rule abstraction: business constraints represented as reusable policy blocks rather than per-endpoint hardcoding.
  - Back/Front contract symmetry: shared primitives (status lifecycle, money/time windows, validation constraints) modeled once and reused across layers.
  - Deterministic, idempotent orchestration where feasible.
  - Server actions/templates separated from manager/orchestrator code.
  - Scriptability and auditability over opaque manual-only flows.
  - Asset builders and bridge managers must evolve placeholders, template tokens, and runtime namespaces as explicit contract revisions, not as layered legacy baggage.

## 4) UX/UI Quality Bar
- Target is not "clean admin"; target is premium product-grade experience.
- Required pillars:
  - Hierarchy and focus (clear primary action and decision path).
  - Progressive disclosure (right detail at right step).
  - High information density with readability.
  - Accessibility-grade contrast and semantic status tokens.
  - Keyboard shortcuts for desktop + touch ergonomics for mobile.
  - Skeleton/loading/empty states with contextual guidance.
  - Smooth but purposeful transitions (no decorative-only motion).
- Tutorial/enablement quality:
  - Human narrative, pedagogical sequencing, role-specific flow.
  - Explain what is relevant now and what is available but out-of-scope.
  - Validation must follow real click paths and behavior side effects.

## 5) Interaction and Validation Standards
- Avoid URL-only checks as primary verification.
- Validate through realistic user behavior:
  - click -> state change -> data effect -> persistence.
  - form edits, save paths, status transitions, and cross-module outcomes.
- Refactors are not complete until both architecture and behavior are revalidated.
- Contract refactors require dual verification:
  - static verification (imports, exports, symbols, loaders),
  - runtime verification (preview + interaction audit).
- Prefer evidence artifacts:
  - screenshots/probes/logged checks with explicit expected outcomes.
- Regression checks after refactors are mandatory for core workflows.
- Extraction work from reference systems must be audited iteratively until feature parity is actually demonstrated, not assumed.

## 6) Current Technical Preferences
- sQuery usage should be leveraged where it improves consistency and ergonomics.
- Repeated markup patterns must be abstracted (helpers/components), not duplicated strings.
- Strings in behavior logic are a smell; move to i18n/config layers.
- Build modular CSS/JS assets to avoid monolith runtime files.
- Namespace debt should be retired decisively: cleaner stable contracts first, then hard removal of the old contract in the same approved migration.
- Rich shell/workspace surfaces should evolve beyond tables: dashboards, detail views, activity feeds, command surfaces, context menus, and execution panels are first-class product surfaces.

## 7) Collaboration and Delivery Contract
- Prefers concise, high-density, execution-oriented communication.
- Expects incremental delivery with visible checkpoints.
- Prefers surgical commits over large mixed commits.
- Requires explicit clarity on:
  - what is complete,
  - what remains pending,
  - what carries risk.
- Repo/instance isolation is strict and mandatory.

## 8) Anti-Patterns
- Monolithic files hiding multiple concerns.
- Inline mega templates in orchestrators.
- UI polish without workflow coherence.
- Hardcoded tips/labels/messages in runtime logic.
- Weak validations that skip actual interactions.
- Fragmented navigation that breaks operational context.
- Flat component forests where naming prefixes compensate for missing information architecture.
- Carrying obsolete namespace layers, aliases, or compatibility shims after the replacement contract is already approved.
- Claiming feature extraction from a reference system without audit evidence of actual parity.

## 9) Reference-Level Design Direction
- Benchmark style for invoicing UX: modern SaaS dashboards (e.g., Linear/Stripe-grade interaction discipline, Tailwind-era patterns).
- Success criterion:
  - enterprise reliability + premium visual system + fast operator throughput.

## 10) Definition of Done Snapshot
- Architecture decomposed and maintainable.
- No oversized files beyond accepted threshold.
- i18n/config decoupled and auditable.
- UX coherent across desktop/mobile and role contexts.
- Core flows validated with interaction-level evidence.
- Rollback path available for platform-impacting changes.

## 11) Technical Patterns (Extracted from Codebase)
- **Stable Runtime Object Pattern:** Use IIFEs with `Object.freeze` for explicit runtime modules mounted under a single root object (e.g., `window.odooApp.dom`) to maintain strict encapsulation without fragmented globals.
- **AOP-style Hydration:** Use `MutationObserver` as a cross-cutting concern to trigger UI bootstrapping/hydration dynamically upon DOM changes (Odoo compatibility).
- **Graceful DOM Abstraction:** Implement a "Bridge" pattern for DOM operations (`sQuery` -> `Native` fallback) to ensure runtime stability across different Odoo environments.
- **Atomic Markup Factory:** Centralize HTML string concatenation in dedicated modules (`MARKUP`) to enforce DRY and prevent XSS through centralized escaping.
- **Reactive State Management:** Use `Vue.reactive` for UI-bound states (KPIs, checklists) even in CDN-distributed SFC environments.
- **Config-Driven Navigation:** All UI entry points (Rail/Sidebar) must be generated from `CONFIG.navigation.railApps` to maintain Open/Closed principle.
- **Enriched Generic Components:** Build component families (data table, cards, chips, rail, command palette) as reusable systems, parameterized by schema/config instead of screen-specific markup.
- **Cross-Layer Generalization:** Align frontend components and backend services around common domain primitives (status lifecycle, monetary aggregation, time windows, action policies).
- **Folder-Driven Component Semantics:** Prefer path semantics (`components/app/layout/Shell.vue`) over prefix-heavy file names (`AppShell.vue`).
- **Stable Contract Hard-Cut Pattern:** When renaming runtime globals/placeholders/namespaces, replace the contract cleanly in one approved pass and audit only the new contract.
- **No Legacy-Grade Migration Rule:** Do not preserve alias layers, dual globals, or bridge shims after contract approval; keep one canonical contract live.
- **Preview-Gated Publication:** No UI slice should reach Odoo before it is mounted and exercised in a standalone preview with representative demo data.
- **Reference-System Extraction Audit:** When extracting from systems like Buyniverse, track explicit feature parity and keep iterating until the audit passes.

## 12) Operating Standards Snapshot
- **Design target:** Award-level visual quality with enterprise usability (Hybrid Linear/Stripe).
- **Engineering target:** Maintainable architecture under continuous iteration (SoC, <600 lines/file).
- **Product target:** Operational clarity, role-fit, and adoption speed.
- **Delivery target:** Reversible, testable, documented, and sync-ready.

## 13) Futureproof Profile Addendum
- Build enriched components that encapsulate recurring behaviors (filters, sorting, pagination, actions, validation, and disclosure) as reusable systems.
- Prefer schema/config-driven assembly over handcrafted page logic.
- Apply mathematical thinking to architecture decisions: composable models, measurable constraints, and reusable transformation pipelines.
- Treat UI and backend as a unified solution design space: generic patterns first, domain specialization second.
- Design runtime contracts as durable public APIs: namespace, placeholder tokens, mount points, config objects, and loader behavior should evolve under versioned discipline.
- Prefer feature-surface extraction over isolated widget copying: move whole solution capabilities (detail view, dashboarding, contextual action systems, activity systems), not just visual fragments.

## 14) Refactor Patterns Proven In This Repo
- **Facade-Stable Refactor Pattern:** Keep the public manager/service/orchestrator class in its original module and preserve its import path while moving real behavior into focused mixins or helper modules.
- **Runtime/Persistence/Schema/Code Split:** For Odoo-heavy modules, separate orchestration runtime, CRUD/upsert logic, schema introspection, and embedded server-action code into distinct modules.
- **Catalog-Driven Orchestration:** Long setup workflows should be represented as explicit step specs or phase catalogs, not repeated inline `if not skip_x` blocks.
- **Contract-Preserving Decomposition:** Deep refactors should not change entrypoint names, exported symbols, or orchestrator call surfaces unless the contract migration is explicitly approved.
- **Living Dependency Map:** When mixin counts grow, maintain a dependency map document that records composition roots, cross-mixin calls, and safe next-refactor order.
- **Incremental Patch Discipline On Windows:** In constrained Windows tool runners, prefer small reversible patches that preserve a compiling intermediate state rather than a single giant patch.
- **Directory Semantics Over Prefix Creep:** Once a domain reaches multiple responsibilities, move behavior into domain folders/modules and avoid encoding architecture in repeated symbol prefixes.
- **Result-Payload Formalization:** Runtime managers and orchestrators should build result payloads through dedicated helpers so status, warnings, and errors remain explicit and auditable.
