---
name: engine-runtime
description: >-
  Expert domain guidance and procedures for developing, debugging, and modifying
  the core Point & Click quest engine runtime (src/engine/), including typed event buses,
  NavMesh pathfinding, dialog tree routers, condition evaluation, story progression,
  and character visualizer interfaces.
---

# Engine Runtime Agent & Domain Guide

Use this skill when developing or debugging core game engine runtime systems in `src/engine/`.

---

## 1. Domain Structure

```
src/engine/
├── events/          # Scoped EventBus and EventTypes.ts (strongly typed contracts)
├── dialog/          # DialogSystem, DialogRouter, SpeechNode, RouterNode
├── scene/           # WalkPath, NavMesh, polygon collision, depth sorting
├── systems/         # InventorySystem, StoryGraphSystem, ConditionEvaluator
├── visualization/   # ICharacterVisualizer interfaces and runtime adaptors
└── state/           # GameState, flag evaluations, and session persistence
```

---

## 2. Core Invariants & Rules

1. **Strictly Decoupled**:
   - `src/engine/` must NEVER import from `src/editor/`, `src/rig-studio/`, or `src/player/`.
2. **Headless Execution**:
   - All systems must execute purely in Node/jsdom without canvas or DOM dependencies.
3. **Typed Event Bus**:
   - All events must be defined in `src/engine/events/EventTypes.ts`.
   - Never use string literals or `any` payloads.
4. **Referential Integrity**:
   - Condition evaluations (`hasItem:itemId`, flags) must gracefully handle missing entities without throwing uncaught exceptions.

---

## 3. Verification Workflow

When making changes to core engine runtime:
1. Run engine unit tests:
   ```bash
   npx vitest run tests/unit/scene tests/unit/systems tests/unit/utils
   ```
2. Run end-to-end game playthrough simulations:
   ```bash
   npx vitest run tests/verification/
   ```
3. Full verification & build:
   ```bash
   npm test
   npm run build
   ```
