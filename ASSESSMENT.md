# WebQuestEngine — Project Assessment

*Assessed on 2026-10-02, updated on 2026-10-03 against latest commits through `dc8f2a6` and subsequent editor refactorings.*

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
- **Editor modularization:** `NodeViewFactory.ts` was refactored down from 1,248 lines to 44 lines by extracting dedicated binders under `binders/` (`CommonNodeBinder`, `SpeechNodeBinder`, `RouterNodeBinder`, `DirectiveNodeBinder`, `ActionNodeBinder`, `EventListenerNodeBinder`). `EditorCanvas.ts` was decomposed by extracting `CanvasGizmoRenderer.ts`, `PolygonEditorController.ts`, and `CanvasInteractionUtils.ts`.

### What's weak

- **~~Global event bus as the backbone~~ (Addressed):** Refactored to generic `EventBus<TMap>` with `EngineEventMap` and `EditorEventMap` in `src/engine/core/EventTypes.ts`. Payload shapes (`scene:change`, `dialog:node`, `inventory:give`, `flag:set`, etc.) are strictly checked at compile time while keeping dynamic game entities (item IDs, character IDs, flags, custom directives) as strings.
- **~~Singletons in disguise~~ (Addressed):** `RuntimeContext` now injects its scoped `EventBus<EngineEventMap>` into `AudioSystem`, `DialogSystem`, `InventorySystem`, `StoryGraphSystem`, `SaveSystem`, `UISystem`, and `InGameMenuModal`. Play-mode sessions clear all listeners and window handlers on `destroy()`, eliminating zombie listener leaks across editor play sessions. Editor events (`editor:*`, `history:*`, `camera:*`) route to the editor bus.
- **God class (Partially addressed).** `src/engine/runtime/GameRuntime.ts` (370 lines), `NodeViewFactory.ts` (44 lines), and `EditorCanvas.ts` have been decomposed into dedicated submodules. However, `DialogEditor.ts` (1,003 lines) and some extracted modules (`InputHandler.ts` at 600 lines) remain sizable.
- **No polymorphism where the domain needs it.** Actions, directives and dialog nodes are bags of optional fields (`DialogNode` has about 50) interpreted by if-chains. Adding an action type means editing the types, the runtime, the node view factory and the templates. Recent UX improvements added dynamic actor and animation datalists to node cards, but the underlying data structures remain untyped bags.
- **Legacy and new fields coexist:** `setFlag` and `setFlags`, `giveItem` and `giveItems`, `isRouterNode` and `nodeType`.
- **Engine isn't UI-free.** The HUD, menu and dialog overlays are DOM with inline CSS inside `engine/` (now grouped in `DOMOverlayRenderer.ts`), and editor file handling also lives there.
- **~~Dead code~~ (Addressed):** `PathfindingSystem` stub and its unused references in `RuntimeContext` have been completely purged; pathfinding is cleanly encapsulated in `WalkPath.ts`.
- **Safety net (Addressed for core logic):** Vitest + JSDOM testing harness is now integrated with 11 test suites and 61 passing tests covering geometric pathfinding/Dijkstra, condition evaluation, inventory combination, story progression, save/restore snapshots, dialog graph branching, action execution, event bus session isolation, and demo project referential integrity. (Still no linter and no schema versioning).

### Net

Good module boundaries and data model. The recent `GameRuntime`, `NodeViewFactory`, `EditorCanvas`, and `EventBus` refactorings, test suite implementation, and dead code cleanup resolved the major structural engineering risks. Dynamic entities remain flexible as strings while all event payloads and channels are strictly typed. Extensibility is now primarily constrained by the bag-of-optional-fields data model.

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
| Quality tooling | Vitest + JSDOM (11 suites, 57 tests) | Good foundation (ESLint & browser E2E still to come) |

The runtime stack is a good call and keeps the player small. The editor is where the choice hurts: it is over 10k lines of form-heavy UI with manual re-rendering and focus-guard workarounds. The one open "needs fix" in the requirements (the scene reloading on tree selection) is the kind of bug a reactive framework such as Svelte, Solid or Lit removes.

---

## 4. Maturity and distance to public alpha

It is a late prototype / tech demo: 125 commits from one author between Aug 24 and Oct 2, 2026, about 20k lines of TypeScript, a deployed editor and a playable two-scene demo with voiceover.

Blockers for a public alpha:

1. **You can't ship your own game.** The player hardcodes the demo JSON, `build:game` is identical to `build`, and there is no export.
2. **Assets don't persist.** A picked image is cached in memory for the session, and the JSON stores a guessed relative path. In the hosted Studio your own art is gone after reload unless you clone the repo and place files by hand.
3. **~~No tests~~ (Addressed):** 11 test suites with 57 tests now guard core algorithms, subsystems, save persistence, and project integrity.
4. **No touch input**; it is mouse-only.
5. **No project format versioning or migration**, while the format is still changing.
6. **Docs drift.** `CONTRIBUTING.md` references `npm test` (now implemented and passing); three product names are in use (WebQuestEngine, QuestForge 2D, point-and-click-quest-engine); the requirements matrix lists the menu, saves, settings and cinematics as "queued" though the code exists.

Items 1 and 2 are the real gate. A rough estimate is 3–6 focused weeks at the author's pace to reach an honest alpha, with most of that going to an asset and export pipeline and expanding test coverage to editor workflows.

---

## 5. AI readiness versus clearclass and mapgenerator

It looks AI-built but is not AI-ready. The signs of AI authorship are `file:///home/...` links in `REQUIREMENTS.md`, "User Request" as a requirement source, a "remove temporary plan file" commit, and the commit cadence.

| | WebQuestEngine | clearclass | mapgenerator |
|---|---|---|---|
| Agent guide | None | `AGENTS.md` (381 lines), `CLAUDE.md` pointer | `AGENTS.md` (157 lines), `CLAUDE.md` pointer |
| Delivery procedures | None | 6 procedure docs, 14 ADRs | Delivery lanes, approval-gated verified delivery |
| Verification gate | `tsc` + `npm test` + build | `ci:local`, GitHub CI | `ci:local`, `ci:bookkeeping` |
| Test files | 11 (57 tests) | 167 | 327 |
| Mechanical guardrails | None | ESLint, Prettier, dependency-cruiser, duplicate and secret checks | Dozens of boundary and authority check scripts |
| Planning state | `TODO.md` and a stale requirements matrix | `PLAN.md`, validated roadmap, changelog | Same |

**What helps an agent today:** strict TypeScript, a single data-model file, a clean folder split, requirement IDs, a short architecture section in `CONTRIBUTING.md`, and an automated test suite verifying core game logic and referential integrity.

**What hurts:** an agent has no compile-time typing for the 74 event names on the global bus, the remaining monolithic editor controller (`DialogEditor` at 1,003 lines) makes change impact hard to trace, and the docs contradict the code.

`clearclass` and `mapgenerator` treat the repo as the agent's operating manual with enforced gates; this one is where a repo sits before any of that is added.

### Cheapest high-value next steps

1. Add an `AGENTS.md` with the architecture rules (and a `CLAUDE.md` pointer to it).
2. ~~Add Vitest on the pure logic: conditions, pathfinding, dialog and story systems.~~ (Done: 11 suites, 61 tests passing).
3. ~~Introduce a typed event map to replace string event names with `any` payloads.~~ (Done: `EventTypes.ts` + scoped `EventBus<TMap>` with session lifecycle isolation).
4. Add a single `check` script (typecheck, lint, test) and wire it into CI.

