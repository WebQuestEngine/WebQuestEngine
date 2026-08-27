# 📋 QuestForge 2D - Engine Development TODOs

This document tracks upcoming tasks, feature enhancements, and polish items for the **Point & Click Quest Engine**.

---

## 🎨 1. Fix Appearance
- [ ] **UI Preset Styling**: Refine inventory bar styling and layout across all UI presets (`LucasArts 9-verbs`, `Sierra top bar`, `Context Coin`, `Direct Cursor`).
- [ ] **Item Grid & Slots**: Improve item slot border padding, hover highlights, item selection indicators, and item count tooltips.
- [ ] **Item Drag & Combine Visuals**: Add visual feedback when dragging an item onto another inventory item or hot-bar slot.
- [ ] **Custom graphics for tools and inventory**: Add custom graphics for tools and inventory slots
- [ ] **Dialog box custom graphics**: Add custom graphics for dialog boxes

---

## 🚀 2. Add Start Game Event
- [ ] **Initial Scene Event Trigger**: Create a `onStartGame` / `onSceneLoad` event hook to automatically execute actions when Chapter 1 / Initial Scene loads.
- [ ] **Automatic Intro Script Execution**: Support triggering initial dialogues, giving starting items, or running custom intro scripts automatically upon game launch.

---

## 🎬 3. Scene Transitions
- [ ] **Visual Scene Fading**: Implement smooth screen fade-out to black and fade-in when changing scenes (`StoryGraphSystem.changeScene`).
- [ ] **Transition Timing**: Coordinate player spawn positioning and camera positioning during the black screen phase before fading in.
- [ ] **Transition Presets**: Support customizable transition effects (`fade`, `wipe`, `instant`).

---

## 🍿 4. Cinematics & Cutscenes
- [ ] **Cinematic Mode**: Add a letterboxed cinematic mode that temporarily hides UI bars and disables player manual controls during cutscenes.
- [ ] **Scripted Camera Movement**: Support pan-to-position and smooth camera zooming during cutscenes (`camera.panTo(x, y)`).
- [ ] **Scripted Sequences**: Support sequential actor walking, animation triggers, and speech subtitles without requiring player interaction.

---

## 🛠️ 5. Fix Tool Selection
- [x] **Wrong tool usage**: Fixed verb matching in `InteractableElement.ts` & `Engine.ts`. Clicking "Talk" or "Look" on doors/objects strictly matches matching actions or displays in-character subtitles ("The door doesn't reply.") instead of incorrectly triggering "Use" or scene transition door actions.
- [x] **Active Verb Feedback**: Active verb buttons (`.verb-btn`, `.sierra-btn`, `.coin-btn`) now highlight cleanly and stay synced with mouse wheel verb cycling and verb alias equivalency (`interact` / `use`).
- [x] **Cursor State Consistency**: Fixed cursor context updates when switching between Editor tools, spawn pickers, polygon draw mode, and Play mode.

---

## 🏗️ 6. Decouple Engine Runtime & Editor
- [ ] **Standalone Engine Player**: Create a dedicated standalone `player.ts` entry point to publish/ship lightweight games without any editor UI overhead.
- [ ] **Multi-Game Editor Architecture**: Decouple the Editor (`src/editor/`) into a reusable authoring environment capable of loading, editing, and exporting multiple distinct game project files (`project.json`).
- [ ] **Game Export Pipeline**: Provide a clean production build script (`npm run build:game`) to bundle published games into standalone web packages.

---

## 🖱️ 7. Custom Cursors
- [ ] **Verb Cursors**: Support custom image cursors for each verb (`walk`, `look`, `interact`, `talk`, `pick_up`) with configurable hotspot pixel offsets `(x, y)`.
- [ ] **Inventory Item Cursors**: Display the selected inventory item PNG icon directly at the mouse cursor location when an item is selected.
- [ ] **Hotspot Dynamic Cursors**: Allow hotspots to define custom mouse cursor graphics when hovering over them.

---

## ⚡ 8. Global Events & Triggers
- [ ] **Global Event Listeners**: Add project-level event triggers (`onGameStart`, `onChapterStart`, `onFlagChange`, `onItemCollected`, `onTimerExpire`).
- [ ] **Global Event Actions**: Support executing script actions, dialogue triggers, music playback, or scene transitions from global events without requiring a hotspot click.
