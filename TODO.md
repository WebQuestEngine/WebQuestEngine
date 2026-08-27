# 📋 QuestForge 2D - Engine Development TODOs

This document tracks upcoming tasks, feature enhancements, and polish items for the **Point & Click Quest Engine**.

---

## 🎨 1. Fix Inventory Appearance
- [ ] **UI Preset Styling**: Refine inventory bar styling and layout across all UI presets (`LucasArts 9-verbs`, `Sierra top bar`, `Context Coin`, `Direct Cursor`).
- [ ] **Item Grid & Slots**: Improve item slot border padding, hover highlights, item selection indicators, and item count tooltips.
- [ ] **Item Drag & Combine Visuals**: Add visual feedback when dragging an item onto another inventory item or hot-bar slot.
- [ ] **Custom graphics for tools and inventory**: Add custom graphics for tools and inventory slots

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
- [ ] **Wrong tool usage**: The wrong tool is used when the user clicks on the tool, like "talk" is actually "use" in direct-cursor mode.
- [ ] **Active Verb Feedback**: Ensure verb tool buttons (Walk, Look, Interact, Talk, Pick Up) provide clear active state highlights and sync cleanly with mouse wheel cycling.
- [ ] **Cursor State Consistency**: Fix cursor context updates when switching between Editor tools, spawn pickers, polygon draw mode, and Play mode.

---

## 🏗️ 6. Decouple Engine Runtime & Editor
- [ ] **Standalone Engine Player**: Create a dedicated standalone `player.ts` entry point to publish/ship lightweight games without any editor UI overhead.
- [ ] **Multi-Game Editor Architecture**: Decouple the Editor (`src/editor/`) into a reusable authoring environment capable of loading, editing, and exporting multiple distinct game project files (`project.json`).
- [ ] **Game Export Pipeline**: Provide a clean production build script (`npm run build:game`) to bundle published games into standalone web packages.
