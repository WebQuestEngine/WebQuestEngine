# WebQuestEngine — Project Assessment

*Assessed on 2026-10-02, updated on 2026-10-03 against latest commits through `69dc501` (2026-10-02).*

**Scope and method.** This assessment is based on reading the docs, configs, data model and most of the engine and editor code, plus building the project in a scratch copy (it compiles clean). The editor was not play-tested in a browser, so the maturity judgments come from code and docs.

**Overall.** It's an impressive, working prototype with a live demo, built in 11 days and almost certainly AI-generated. The architecture's intent is better than its execution, it can't yet ship a user's own game, and it has essentially no agent infrastructure compared to `clearclass` and `mapgenerator`.

---

## 1. What it is and what it addresses

WebQuestEngine is a browser-based, no-code studio plus runtime for 90s-style point-and-click adventures (Monkey Island / King's Quest). A game is one JSON file; the editor authors it and a standalone player runs it.

Use cases the code actually supports:

- **Classic adventure games:** scenes with parallax layers, walkable polygons with perspective scaling, polygon hotspots, verbs, inventory, and four HUD presets (LucasArts, Sierra, context coin, direct cursor).
- **Branching narrative / visual-novel style content:** a node-graph dialog editor with conditions, portraits and voiceover.
- **Cutscenes and cinematics:** video, screen fades and shakes, camera moves, scripted actor movement and multi-actor choreography.
- **Narrative planning:** a storyboard view of scenes and transitions, and a chapter-level story graph.
- **Event-driven game logic without code:** "when / if / then" rules and event-listener nodes on game, scene, hotspot, character and item events.
- **Static-hosted distribution:** a separate `player.html` with in-game menu, save slots and volume settings.

By extension (an inference, not something the project claims) it would fit escape-room style training, interactive tours and classroom game-design teaching.

---

## 2. Software engineering quality

### What's good

- The `engine/`, `editor/` and `player/` split is real: the engine never imports from the editor.
- The design is data-driven. `src/engine/types.ts` is the single model, play mode runs on a cloned project, and undo is snapshot-based.
- The scene classes form a sensible small hierarchy (`GraphicalElement` → `InteractableElement` → `MovableElement` → `Character`).
- Pathfinding is real: a visibility graph plus Dijkstra inside concave polygons (`src/engine/scene/WalkPath.ts`).
- Editor views were refactored into HTML templates plus controllers, with HTML escaping.
- **Runtime modularization:** `GameRuntime` was successfully decomposed into dedicated controllers (`InputHandler`, `ActionExecutor`, `CinematicsController`, `DialogController`, `DOMOverlayRenderer`, `LetterboxManager`, `SaveRestoreHandler`), leaving `GameRuntime` (down to 370 lines) as a clean lifecycle coordinator.

### What's weak

- **Global event bus as the backbone.** `EventBus.getInstance()` appears 299 times with 74 string event names and `any` payloads. Editor and runtime share one bus, and user-authored event names are emitted on it, so they can collide with internal ones like `scene:change`.
- **Singletons in disguise.** `RuntimeContext` creates per-session systems, then installs them as static instances that scene objects fetch via `getInstance()`. The docs claim "zero global singleton leakage"; the per-context `eventBus` it creates is never used.
- **God class (Partially addressed).** `src/engine/runtime/GameRuntime.ts` was refactored down from 1,635 lines to 370 lines, delegating responsibilities to submodules. However, some extracted submodules are still sizable (`InputHandler.ts` at 600 lines), and the editor still contains monolithic controllers (`NodeViewFactory.ts` at 1,247 lines, `EditorCanvas.ts` at 1,210 lines, and `DialogEditor.ts` at 1,003 lines).
- **No polymorphism where the domain needs it.** Actions, directives and dialog nodes are bags of optional fields (`DialogNode` has about 50) interpreted by if-chains. Adding an action type means editing the types, the runtime, the node view factory and the templates. Recent UX improvements added dynamic actor and animation datalists to node cards, but the underlying data structures remain untyped bags.
- **Legacy and new fields coexist:** `setFlag` and `setFlags`, `giveItem` and `giveItems`, `isRouterNode` and `nodeType`.
- **Engine isn't UI-free.** The HUD, menu and dialog overlays are DOM with inline CSS inside `engine/` (now grouped in `DOMOverlayRenderer.ts`), and editor file handling also lives there.
- **Dead code.** `PathfindingSystem` is a stub; the real implementation is in `WalkPath`.
- **No safety net.** There are zero tests, no linter, 94 uses of `any`, and project loading validates only three fields with no schema versioning.

### Net

Good module boundaries and data model, weak abstractions and extensibility. The recent `GameRuntime` refactoring resolved one of the primary engine architectural bottlenecks, but the project remains prototype-grade and will get expensive to extend without a typed event map, an action/node registry, and test coverage.

---

## 3. Tech stack

| Layer | Choice | Assessment |
|---|---|---|
| Language | TypeScript, strict | Right |
| Rendering | PixiJS 8 (the only runtime dependency) | Right for a 2D sprite runtime |
| Build | Vite 5, two entry points | Right |
| Editor UI | Vanilla DOM, hand-rolled `{{placeholder}}` templates, `innerHTML` | The questionable one |
| Persistence | Project JSON via File System Access API with fallback; saves in `localStorage` | Fine for now |
| Deploy | GitHub Actions to GitHub Pages | Right |
| Quality tooling | None (no Vitest, ESLint or schema validator) | Missing |

The runtime stack is a good call and keeps the player small. The editor is where the choice hurts: it is over 10k lines of form-heavy UI with manual re-rendering and focus-guard workarounds. The one open "needs fix" in the requirements (the scene reloading on tree selection) is the kind of bug a reactive framework such as Svelte, Solid or Lit removes.

---

## 4. Maturity and distance to public alpha

It is a late prototype / tech demo: 125 commits from one author between Aug 24 and Oct 2, 2026, about 20k lines of TypeScript, a deployed editor and a playable two-scene demo with voiceover.

Blockers for a public alpha:

1. **You can't ship your own game.** The player hardcodes the demo JSON, `build:game` is identical to `build`, and there is no export.
2. **Assets don't persist.** A picked image is cached in memory for the session, and the JSON stores a guessed relative path. In the hosted Studio your own art is gone after reload unless you clone the repo and place files by hand.
3. **No tests**, so every change risks silent regressions.
4. **No touch input**; it is mouse-only.
5. **No project format versioning or migration**, while the format is still changing.
6. **Docs drift.** The README says port 5173 but the config uses 3000; `CONTRIBUTING.md` references a nonexistent `npm test`; three product names are in use (WebQuestEngine, QuestForge 2D, point-and-click-quest-engine); the requirements matrix lists the menu, saves, settings and cinematics as "queued" though the code exists.

Items 1 and 2 are the real gate. A rough estimate is 3–6 focused weeks at the author's pace to reach an honest alpha, with most of that going to an asset and export pipeline and a basic test suite.

---

## 5. AI readiness versus clearclass and mapgenerator

It looks AI-built but is not AI-ready. The signs of AI authorship are `file:///home/...` links in `REQUIREMENTS.md`, "User Request" as a requirement source, a "remove temporary plan file" commit, and the commit cadence.

| | WebQuestEngine | clearclass | mapgenerator |
|---|---|---|---|
| Agent guide | None | `AGENTS.md` (381 lines), `CLAUDE.md` pointer | `AGENTS.md` (157 lines), `CLAUDE.md` pointer |
| Delivery procedures | None | 6 procedure docs, 14 ADRs | Delivery lanes, approval-gated verified delivery |
| Verification gate | `tsc` + build only | `ci:local`, GitHub CI | `ci:local`, `ci:bookkeeping` |
| Test files | 0 | 167 | 327 |
| Mechanical guardrails | None | ESLint, Prettier, dependency-cruiser, duplicate and secret checks | Dozens of boundary and authority check scripts |
| Planning state | `TODO.md` and a stale requirements matrix | `PLAN.md`, validated roadmap, changelog | Same |

**What helps an agent today:** strict TypeScript, a single data-model file, a clean folder split, requirement IDs and a short architecture section in `CONTRIBUTING.md`.

**What hurts:** an agent has no way to verify behaviour beyond "it compiles". The string events with `any` payloads hide broken contracts from the compiler, the remaining 1,000–1,250 line editor files (`NodeViewFactory`, `EditorCanvas`, `DialogEditor`) make change impact hard to trace, and the docs contradict the code.

`clearclass` and `mapgenerator` treat the repo as the agent's operating manual with enforced gates; this one is where a repo sits before any of that is added.

### Cheapest high-value next steps

1. Add an `AGENTS.md` with the architecture rules (and a `CLAUDE.md` pointer to it).
2. Add Vitest on the pure logic: conditions, pathfinding, dialog and story systems.
3. Introduce a typed event map to replace string event names with `any` payloads.
4. Add a single `check` script (typecheck, lint, test) and wire it into CI.

