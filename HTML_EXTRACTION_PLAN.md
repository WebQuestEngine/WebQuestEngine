# Detailed Implementation Plan: In-Code HTML Extraction to 3-Tier Presentation Architecture

## 🎯 Objective
Refactor all in-code HTML template literals across the editor codebase into a clean, maintainable **3-Tier Presentation Architecture**:
1. **Markup Layer (`.html`)**: Pure HTML files with native Emmet abbreviations, CSS class linters, and syntax highlighting.
2. **Typed View Adapter Layer (`.template.ts`)**: Type-safe bridges that import the raw HTML via Vite (`?raw`), perform typed parameter interpolation, handle dynamic loops/lists (`.map()`), and apply HTML escaping.
3. **Controller Layer (`.ts`)**: Pure event handling, EventBus messaging, and state mutations with **0 lines of HTML strings**.

---

## 🏛️ Architecture & Component Design Pattern

```
┌────────────────────────────────────────────────────────┐
│  Component.html                                        │
│  (Pure HTML markup with {{slot}} placeholders)         │
└───────────────────────────┬────────────────────────────┘
                            │ Vite ?raw import
┌───────────────────────────▼────────────────────────────┐
│  Component.template.ts                                 │
│  (Type-checked parameter bindings, loops, sub-cards)   │
└───────────────────────────┬────────────────────────────┘
                            │ Compiled HTML string
┌───────────────────────────▼────────────────────────────┐
│  Component.ts                                          │
│  (DOM event listeners, EventBus emits, state updates)  │
└────────────────────────────────────────────────────────┘
```

---

## 📁 Complete File Mapping & Target Directory Structure

### 1. Shared Utilities & Vite Types
* **[NEW]** `src/vite-env.d.ts` (Ensure `*.html?raw` module declarations are registered for TypeScript)
* **[NEW]** `src/editor/utils/TemplateUtils.ts` (Type-safe template populator, HTML escaping, list joining)

---

### 2. Inspector Components (`src/editor/components/inspector/`)
* **Project Inspector**:
  * **[NEW]** `src/editor/components/inspector/templates/ProjectInspector.html`
  * **[NEW]** `src/editor/components/inspector/templates/ProjectInspector.template.ts`
  * **[MODIFY]** `src/editor/components/inspector/ProjectInspector.ts`
* **Scene Inspector**:
  * **[NEW]** `src/editor/components/inspector/templates/SceneInspector.html`
  * **[NEW]** `src/editor/components/inspector/templates/SceneInspector.template.ts`
  * **[MODIFY]** `src/editor/components/inspector/SceneInspector.ts`
* **Action Rules Inspector**:
  * **[NEW]** `src/editor/components/inspector/templates/ActionRulesInspector.html`
  * **[NEW]** `src/editor/components/inspector/templates/ActionRuleCard.html`
  * **[NEW]** `src/editor/components/inspector/templates/ActionRulesInspector.template.ts`
  * **[MODIFY]** `src/editor/components/inspector/ActionRulesInspector.ts`
* **Entity Inspectors** (Character, Hotspot, Layer, Item, Dialog Tab):
  * **[NEW]** `src/editor/components/inspector/templates/CharacterInspector.html`
  * **[NEW]** `src/editor/components/inspector/templates/HotspotInspector.html`
  * **[NEW]** `src/editor/components/inspector/templates/LayerInspector.html`
  * **[NEW]** `src/editor/components/inspector/templates/ItemInspector.html`
  * **[NEW]** `src/editor/components/inspector/templates/DialogTabInspector.html`
  * **[NEW]** `src/editor/components/inspector/templates/EntityInspectors.template.ts`
  * **[MODIFY]** `src/editor/components/inspector/EntityInspectors.ts`

---

### 3. Dialog & Sequence Graph Editor (`src/editor/components/dialog/`)
* **Graph Layout & Nodes**:
  * **[NEW]** `src/editor/components/dialog/templates/DialogEditorLayout.html`
  * **[NEW]** `src/editor/components/dialog/templates/BeatNodeCard.html`
  * **[NEW]** `src/editor/components/dialog/templates/RouterNodeCard.html`
  * **[NEW]** `src/editor/components/dialog/templates/EventNodeCard.html`
  * **[NEW]** `src/editor/components/dialog/templates/ActionNodeCard.html`
  * **[NEW]** `src/editor/components/dialog/templates/StageDirectiveCard.html`
  * **[NEW]** `src/editor/components/dialog/templates/ChoiceCard.html`
  * **[NEW]** `src/editor/components/dialog/templates/ConditionPicker.html`
  * **[NEW]** `src/editor/components/dialog/templates/NodeViews.template.ts`
  * **[MODIFY]** `src/editor/components/dialog/nodes/NodeViewFactory.ts`
  * **[MODIFY]** `src/editor/components/DialogEditor.ts`

---

### 4. Studio Modals & Editor Shell (`src/editor/components/`)
* **Project Hub Modal**:
  * **[NEW]** `src/editor/components/templates/ProjectHubModal.html`
  * **[NEW]** `src/editor/components/templates/ProjectHubModal.template.ts`
  * **[MODIFY]** `src/editor/components/ProjectHubModal.ts`
* **Visual Sprite Studio Modal**:
  * **[NEW]** `src/editor/components/templates/VisualSpritePickerModal.html`
  * **[NEW]** `src/editor/components/templates/VisualSpritePickerModal.template.ts`
  * **[MODIFY]** `src/editor/components/VisualSpritePickerModal.ts`
* **Toolbar & Hierarchy Tree**:
  * **[NEW]** `src/editor/components/templates/Toolbar.html`
  * **[NEW]** `src/editor/components/templates/Toolbar.template.ts`
  * **[MODIFY]** `src/editor/components/Toolbar.ts`
  * **[NEW]** `src/editor/components/templates/ProjectTreeView.html`
  * **[NEW]** `src/editor/components/templates/ProjectTreeView.template.ts`
  * **[MODIFY]** `src/editor/components/ProjectTreeView.ts`

---

## 🛠️ Core Template Engine Specification (`TemplateUtils.ts`)

```ts
export class TemplateUtils {
  /**
   * Replaces {{placeholder}} tokens in raw HTML strings with type-safe parameters.
   */
  public static populate<T extends Record<string, any>>(template: string, data: T): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = data[key];
      return val !== undefined && val !== null ? String(val) : '';
    });
  }

  /**
   * Sanitizes user strings to prevent XSS and broken HTML attribute values.
   */
  public static escapeHtml(str: string | undefined | null): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Renders and concatenates an array of items using a template function.
   */
  public static renderList<T>(items: T[] | undefined | null, renderFn: (item: T, index: number) => string): string {
    return (items || []).map((item, index) => renderFn(item, index)).join('');
  }
}
```

---

## 📋 Phased Execution Roadmap

### **Phase 1: Shared Infrastructure & Vite Types**
- [x] Ensure `src/vite-env.d.ts` includes `declare module '*.html?raw' { const content: string; export default content; }`.
- [x] Create `src/editor/utils/TemplateUtils.ts` with `populate()`, `escapeHtml()`, and `renderList()`.
- [x] Verify test compile with `npm run build`.

### **Phase 2: Inspector Sub-Components & Entity Templates**
- [x] Extract `ProjectInspector.html` & `ProjectInspector.template.ts`.
- [x] Extract `SceneInspector.html` & `SceneInspector.template.ts`.
- [x] Extract `ActionRulesInspector.html`, `ActionRuleCard.html` & `ActionRulesInspector.template.ts`.
- [x] Extract `CharacterInspector.html`, `HotspotInspector.html`, `LayerInspector.html`, `ItemInspector.html`, `DialogTabInspector.html` & `EntityInspectors.template.ts`.
- [x] Update all inspector controllers to delegate HTML generation to `.template.ts` adapters.
- [x] Verify with `npm run build`.

### **Phase 3: Dialog & Sequence Graph Studio**
- [ ] Extract `DialogEditorLayout.html` (toolbar overlay, viewport, zoom controls).
- [ ] Extract individual node cards (`BeatNodeCard.html`, `RouterNodeCard.html`, `EventNodeCard.html`, `ActionNodeCard.html`).
- [ ] Extract `StageDirectiveCard.html`, `ChoiceCard.html`, and `ConditionPicker.html`.
- [ ] Create `NodeViews.template.ts` adapter.
- [ ] Update `NodeViewFactory.ts` and `DialogEditor.ts` controllers.
- [ ] Verify with `npm run build`.

### **Phase 4: Studio Modals & Navigation Shell**
- [ ] Extract `VisualSpritePickerModal.html` & `VisualSpritePickerModal.template.ts`.
- [ ] Extract `ProjectHubModal.html` & `ProjectHubModal.template.ts`.
- [ ] Extract `Toolbar.html` & `Toolbar.template.ts`.
- [ ] Extract `ProjectTreeView.html` & `ProjectTreeView.template.ts`.
- [ ] Verify with `npm run build`.

### **Phase 5: Verification & Full Regression Testing**
- [ ] Run `npm run build` to ensure 0 TypeScript or bundling errors.
- [ ] Verify Tree View hierarchy expanding, collapsing, and scrolling.
- [ ] Verify Inspector tabs (Project, Scene, Hotspot, Character, Layer, Item, Dialog) and Action Rule tables.
- [ ] Verify Sprite Studio frame slicing & playback.
- [ ] Verify Sequence Graph pan/zoom, node creation, drag-to-connect wiring, and stage directives.

---

## 🔒 Safety & Non-Breaking Guarantees
- **No API Changes**: Component controller methods (`getHTML()`, `attachEvents()`, `setProject()`) retain exact method signatures.
- **Identical DOM Selectors**: All IDs and CSS classes remain exactly unchanged so all event bindings continue to work seamlessly.
- **Zero Runtime Dependencies**: Completely powered by standard browser features and Vite's native `?raw` loader.
