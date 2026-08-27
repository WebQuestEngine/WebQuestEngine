# 📋 QuestForge 2D - Engine Development TODOs

This document tracks upcoming tasks, feature enhancements, and polish items for the **Point & Click Quest Engine**.

---

## 🎨 1. Fix Appearance
- [ ] **UI Preset Styling**: Refine inventory bar styling and layout across all UI presets (`LucasArts 9-verbs`, `Sierra top bar`, `Context Coin`, `Direct Cursor`).
- [ ] **Item Grid & Slots**: Improve item slot border padding, hover highlights, item selection indicators, and item count tooltips.
- [ ] **Item Drag & Combine Visuals**: Add visual feedback when dragging an item onto another inventory item or hot-bar slot.
- [ ] **Custom graphics for tools and inventory**: Add custom graphics for tools and inventory slots
- [ ] **Dialog box custom graphics**: Add custom graphics for dialog boxes
- [ ] **Mouse Wheel Inventory Selection**: Display the inventory bar at the bottom during gameplay, where scrolling the mouse wheel cycles and highlights the selected inventory item, replacing verb tool selection.

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
- [x] **Verb Cursors**: Supported custom image cursors per verb (`walk`, `look`, `interact`, `talk`, `pick_up`) configurable in Project Settings (`uiConfig.customCursors`).
- [x] **Inventory Item Cursors**: Selected inventory item PNG icons display smoothly at the mouse cursor location when holding an item.
- [x] **Hotspot Dynamic Cursors**: Hotspots can define custom mouse cursor graphics (`customCursorUrl`) when hovering over them.

---

## ⚡ 8. Global Events & Triggers
- [ ] **Global Lifecycle Events**: Add project-level event triggers (`onGameStart`, `onChapterStart`, `onChapterEnd`, `onGameEnd`/Victory, `onFlagChange`, `onItemCollected`, `onTimerExpire`).
- [ ] **Global Event Actions**: Support executing script actions, dialogue triggers, victory screens/credits, music playback, or scene transitions from global events without requiring a hotspot click.

---

## 🎵 9. Audio System
- [ ] **Background Music per Scene**: Support background music audio files per scene (`backgroundMusicUrl`) with smooth fading between scene transitions.
- [ ] **Recorded Dialogues / Voiceover Support**: Add voiceover audio file fields to dialogue nodes (`voiceAudioUrl`) with automatic subtitle duration sync.
- [ ] **Custom Action Sound Effects**: Support custom sound effect triggers on actions (`sfxUrl`) for door opening, item pickup, brewing potions, and inventory interactions.

---

## ⚙️ 10. Settings Dialog & Volume Controls
- [ ] **Audio Volume Sliders**: Add interactive volume controls for Master Volume, Music Volume, Sound Effects (SFX) Volume, and Voiceover Volume.
- [ ] **In-Game Settings Modal**: Create an accessible settings dialog accessible during gameplay and from the main menu.
- [ ] **Display & Gameplay Preferences**: Support subtitle text speed sliders, fullscreen mode toggle, and UI scaling options.

---

## 🏠 11. Main Menu / Home Page System
- [ ] **Main Menu Screen**: Add a customizable game Title / Home Page screen shown when launching published games.
- [ ] **Game Actions**: Include `Start New Game`, `Continue Game` (auto-load latest save), and multi-slot `Save / Load Game` management.
- [ ] **Settings & Custom Screens**: Include direct access to the Settings Panel, plus support for custom buttons/modal screens such as `Credits`, `Controls`, and `Quit Game`.

---

## 🏆 12. Achievements System
- [ ] **Achievement Definitions**: Support defining achievements in project data (`id`, `title`, `description`, `iconUrl`, `isSecret`, `isUnlocked`).
- [ ] **Action & Script Unlock Triggers**: Allow unlocking achievements via hotspot actions, dialogue completion, item combinations, or story flags (`unlockAchievement('first_potion')`).
- [ ] **In-Game Toast Notifications**: Display an animated toast notification banner when an achievement is unlocked during gameplay.
- [ ] **Achievements Screen / Modal**: Accessible achievements menu displaying progress, icons, unlock timestamps, and secret achievement placeholders.
