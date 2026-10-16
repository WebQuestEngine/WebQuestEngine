# Point & Click Quest Engine (WebQuestEngine) Agent Guidelines

Welcome, AI Agent. This repository is **Point & Click Quest Engine** (also referred to as **WebQuestEngine** / **QuestForge 2D**), an in-browser 2D point-and-click adventure game engine, editor, and character rigging suite built with TypeScript, HTML Canvas / Pixi.js, and Vite.

---

## 1. High-Level Architecture & Boundaries

The codebase is split into four primary domains under `src/`:

```
src/
├── engine/        # Pure game runtime, state machines, math, and logic (LEAF)
├── editor/        # WYSIWYG authoring tools, inspectors, and graph editor
├── player/        # Standalone game runtime launcher and bundle
└── rig-studio/    # Standalone 2D character rigging, slicing, and animation suite
```

### 🛡️ Strict Unidirectional Boundary Invariants
1. **Engine is a Pure Leaf Dependency**:
   - `src/engine/` MUST NEVER import from `src/editor/` or `src/rig-studio/`.
   - Core engine logic (pathfinding, dialog trees, condition evaluation, story progression) must remain headless and testable without a DOM or WebGL canvas.
2. **Editor & Player Consume Engine**:
   - Both `src/editor/` and `src/player/` depend on `src/engine/`.
   - The editor should wrap engine entities with visual authoring controllers without contaminating the underlying data structures with editor-only state.
3. **Rig Studio Decoupling**:
   - `src/rig-studio/` is a self-contained studio application.
   - When integrating character rigs into the engine or editor, communicate via typed data contracts (`SkeletalRigData`, `BoneHierarchy`, `PoseData`) or the `RigStudioBridge`, rather than tight coupling to studio DOM components.

---

## 2. Core Architecture Rules & Patterns

### Scoped, Typed Event Bus
- Never use untyped event strings with `any` payloads.
- All engine events are registered in strongly-typed maps (see `src/engine/events/EventTypes.ts`).
- Event listeners must be scoped to session/component lifecycles. Always provide unsubscription hooks (`off` or cleanup callbacks) to prevent memory leaks during scene transitions or editor reloads.

### Data Serialization & Zero Manual Editing
- Games are authored through a visual workflow. All scenes, actors, hotspots, dialog graphs, and item definitions serialize to and deserialize from JSON.
- Never write code that requires a user to hand-edit raw manifest files or JSON documents. All migrations, schema updates, or default states must be handled gracefully in software.

### Coordinate & Origin Conventions
- **Rigging Origin**: (0, 0) is situated at character ground-center (between feet) with Y pointing upward or downward depending on local bone transform matrices.
- **Scene World Coords**: (0, 0) is top-left of the room background.
- **Layer Stacking**: Standard bone layer orders (e.g. `torso`, `head`, `arm_left`, `arm_right`) must adhere to defined depth hierarchies (see `AnatomicalRig.ts`).

---

## 3. Development, Build & Verification Workflow

### Command Cheatsheet
| Task | Command | Purpose |
| :--- | :--- | :--- |
| **Typecheck & Build** | `npm run build` | Compiles TypeScript (`tsc`) and bundles all entry points via Vite |
| **Run Unit & Logic Tests** | `npm test` | Runs all 27+ Vitest test suites (166+ tests) |
| **Development Server** | `npm run dev` | Starts Vite dev server for main editor (`index.html`) |
| **Rig Studio Dev** | `npm run dev:rig-studio` | Starts Vite directly targeting `rig-studio.html` |
| **Player Runtime Dev** | `npm run dev:player` | Starts Vite targeting `player.html` |

### ⛔ Testing Constraints & Safety Rules
- **Do NOT run automated UX tests or browser subagents**: Automated browser exploration, UI recording, or Playwright end-to-end sessions waste significant time and credits.
- **Rely on Vitest for Verification**: Always run `npm test` when modifying core logic (pathfinding, dialog trees, conditions, rigging math, polygon geometry).
- **Verify TypeScript Compilation**: Always run `npm run build` to confirm zero type errors across the entire codebase before concluding tasks.
