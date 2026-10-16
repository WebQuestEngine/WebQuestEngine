# Architecture & Module Boundaries

## Invariants
1. **Engine Independence**: Files in `src/engine/` must NEVER import anything from `src/editor/`, `src/rig-studio/`, or `src/player/`.
2. **Headless Engine Core**: Engine logic (pathfinding, dialog trees, conditions, inventory, story graphs) must execute cleanly in a Node.js/jsdom test environment without relying on DOM elements or canvas rendering.
3. **Typed Event Contracts**: Never introduce ad-hoc string literals for event names with `any` payloads. Register all events in `src/engine/events/EventTypes.ts` and use typed event emitters/buses.
4. **Lifecycle Cleanup**: Always pair event listeners with explicit unsubscription hooks to avoid retention leaks when switching scenes or reloading editor states.
