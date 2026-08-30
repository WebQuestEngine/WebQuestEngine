import { HotspotAction, ProjectData, SceneData } from '../../../engine/types';
import { EventBus } from '../../../engine/core/EventBus';
import { resolvePickedAssetPath } from '../../utils/AssetPathUtils';
import { VisualSpawnPickerModal } from '../VisualSpawnPickerModal';

export class ActionRulesInspector {
  public static getHTML(params: {
    hIdx: number;
    actions: HotspotAction[];
    isCharacter?: boolean;
    project: ProjectData | null;
    currentScene: SceneData | null;
  }): string {
    const { hIdx, actions, isCharacter = false, project, currentScene } = params;

    return `
      <div class="sidebar-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div class="sidebar-section-title" style="margin-bottom:0;">Interaction Rules (${actions.length})</div>
          <button class="btn btn-primary ${isCharacter ? 'btn-add-char-action' : 'btn-add-hs-action'}" data-hidx="${hIdx}" style="font-size:0.7rem; padding:4px 8px;">+ Add Action Rule</button>
        </div>
        ${actions.length === 0 ? `
          <div style="font-size:0.75rem; color:var(--text-muted); font-style:italic; padding:8px 0;">
            No interaction rules defined yet. Click "+ Add Action Rule" to create one.
          </div>
        ` : actions.map((act, aIdx) => `
          <div class="action-flow-card" style="padding:10px;">
            <!-- WHEN Section -->
            <div class="flow-group">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span class="flow-group-title">⚡ WHEN USER PERFORMS</span>
                <div style="display:flex; align-items:center; gap:4px;">
                  <button class="btn btn-move-action-up" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" ${aIdx === 0 ? 'disabled style="opacity:0.3;"' : ''} style="padding:2px 6px; font-size:0.65rem;" title="Move Rule Up (Higher Priority)">⬆️</button>
                  <button class="btn btn-move-action-down" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" ${aIdx === actions.length - 1 ? 'disabled style="opacity:0.3;"' : ''} style="padding:2px 6px; font-size:0.65rem;" title="Move Rule Down (Lower Priority)">⬇️</button>
                  <button class="btn btn-del-action" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" style="padding:2px 6px; font-size:0.65rem; color:#ef4444;" title="Delete Action Rule">✕ Delete</button>
                </div>
              </div>
              <select class="form-select act-verb" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" style="font-size:0.75rem; font-weight:700; color:var(--accent-gold);">
                <option value="look" ${act.verb === 'look' ? 'selected' : ''}>👁️ Look At</option>
                <option value="interact" ${act.verb === 'interact' ? 'selected' : ''}>🖐️ Interact / Touch</option>
                <option value="talk" ${act.verb === 'talk' ? 'selected' : ''}>💬 Talk To</option>
                <option value="use" ${act.verb === 'use' ? 'selected' : ''}>🔑 Use Item With</option>
                <option value="pick_up" ${act.verb === 'pick_up' ? 'selected' : ''}>🎒 Pick Up</option>
              </select>
              ${act.verb === 'use' ? `
                <div style="margin-top:6px;">
                  <label style="font-size:0.65rem; color:var(--text-muted);">Required Item ID</label>
                  <input type="text" class="form-input act-req-item" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.requireItemId || ''}" placeholder="e.g. item_key" style="font-size:0.75rem;" />
                </div>
              ` : ''}
            </div>

            <!-- CONDITION Section: Flag Name FIRST + "is" + Toggle Button -->
            <div class="flow-group">
              <span class="flow-group-title">🔀 IF CONDITION (LEAVE EMPTY FOR ALWAYS)</span>
              <div style="display:flex; align-items:center; gap:6px;">
                <input type="text" class="form-input act-flag-input" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.requiredFlag || act.notFlag || ''}" placeholder="Flag Name (e.g. labUnlocked)" style="flex:1; font-size:0.75rem;" />
                <span class="act-is-label" style="font-size:0.75rem; font-weight:700; color:${(act.requiredFlag || act.notFlag) ? 'var(--text-main)' : 'var(--text-muted)'}; opacity:${(act.requiredFlag || act.notFlag) ? '1' : '0.4'};">is</span>
                <button class="btn act-cond-toggle ${act.notFlag ? 'mode-false' : 'mode-true'}" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" ${(act.requiredFlag || act.notFlag) ? '' : 'disabled'} style="font-size:0.7rem; padding:4px 8px; opacity:${(act.requiredFlag || act.notFlag) ? '1' : '0.4'}; pointer-events:${(act.requiredFlag || act.notFlag) ? 'auto' : 'none'};" title="Click to toggle between IF TRUE and IF FALSE">
                  ${act.notFlag ? '❌ FALSE' : '✅ TRUE'}
                </button>
              </div>
            </div>

            <!-- THEN Section: Event-Driven Action -->
            <div class="flow-group">
              <span class="flow-group-title">🎬 THEN FIRE ACTION / EVENT</span>
              
              <!-- Action Event Type Selector -->
              <div style="margin-bottom:8px;">
                <label style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">Action Event Type</label>
                <select class="form-select act-type-select" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" style="font-size:0.75rem; font-weight:700; color:#38bdf8;">
                  <option value="dialog" ${(act.actionType === 'dialog' || (!act.actionType && !!act.dialogId)) ? 'selected' : ''}>💬 Start Dialogue Tree</option>
                  <option value="animation" ${(act.actionType === 'animation' || (!act.actionType && !!act.playAnimation && !act.dialogId)) ? 'selected' : ''}>🎬 Play Character Animation</option>
                  <option value="speech" ${(act.actionType === 'speech' || (!act.actionType && !act.dialogId && !act.playAnimation && !act.targetSceneId && !act.giveItemId && !act.setFlag && !act.eventName)) ? 'selected' : ''}>🗣️ Say Speech / Subtitle</option>
                  <option value="scene_change" ${(act.actionType === 'scene_change' || (!act.actionType && !!act.targetSceneId)) ? 'selected' : ''}>🚪 Change Scene (Teleport)</option>
                  <option value="give_item" ${(act.actionType === 'give_item' || (!act.actionType && !!act.giveItemId)) ? 'selected' : ''}>🎁 Give Inventory Item</option>
                  <option value="set_flag" ${(act.actionType === 'set_flag' || (!act.actionType && (!!act.setFlag || !!act.clearFlag))) ? 'selected' : ''}>🚩 Set / Clear Story Flag</option>
                  <option value="custom_event" ${(act.actionType === 'custom_event' || (!act.actionType && !!act.eventName)) ? 'selected' : ''}>⚡ Broadcast Custom Event</option>
                  <option value="mixed" ${act.actionType === 'mixed' ? 'selected' : ''}>⚙️ Multi-Action (All Outcomes)</option>
                </select>
              </div>

              <!-- 1. Dialogue Tree Block -->
              ${(act.actionType === 'dialog' || (!act.actionType && !!act.dialogId) || act.actionType === 'mixed') ? `
                <div class="act-type-block" style="background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
                  <label style="font-size:0.65rem; color:#a78bfa; font-weight:700;">💬 Dialogue Tree</label>
                  <div style="display:flex; gap:6px; margin-top:4px;">
                    <select class="form-select act-dialog-id" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" style="font-size:0.75rem; flex:1;">
                      <option value="">-- Select Dialogue Tree --</option>
                      ${(project?.dialogs || []).map(d => `
                        <option value="${d.id}" ${act.dialogId === d.id ? 'selected' : ''}>${d.title} (${d.id})</option>
                      `).join('')}
                    </select>
                    ${act.dialogId ? `
                      <button class="btn btn-gold btn-open-dialog-editor" data-dlgid="${act.dialogId}" style="font-size:0.68rem; padding:4px 8px;" title="Open Dialogue Tree in Editor">
                        ✏️ Edit
                      </button>
                    ` : ''}
                  </div>
                </div>
              ` : ''}

              <!-- 2. Animation Action Block -->
              ${(act.actionType === 'animation' || (!act.actionType && !!act.playAnimation && !act.dialogId) || act.actionType === 'mixed') ? `
                <div class="act-type-block" style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
                  <label style="font-size:0.65rem; color:#f59e0b; font-weight:700;">🎬 Play Animation</label>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:4px;">
                    <div>
                      <label style="font-size:0.6rem; color:var(--text-muted);">Animation Name</label>
                      <input type="text" class="form-input act-play-anim" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.playAnimation || ''}" placeholder="e.g. gesture, cast, pick_up" style="font-size:0.75rem;" />
                    </div>
                    <div>
                      <label style="font-size:0.6rem; color:var(--text-muted);">Target Character</label>
                      <select class="form-select act-anim-target" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" style="font-size:0.75rem;">
                        <option value="player" ${act.animationTarget === 'player' || !act.animationTarget ? 'selected' : ''}>Player Character</option>
                        <option value="self" ${act.animationTarget === 'self' ? 'selected' : ''}>Self (Target Element)</option>
                        ${(currentScene?.characters || []).map(c => `
                          <option value="${c.id}" ${act.animationTarget === c.id ? 'selected' : ''}>${c.name} (${c.id})</option>
                        `).join('')}
                      </select>
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- 3. Speech / Subtitle Line -->
              ${(act.actionType === 'speech' || (!act.actionType && !act.dialogId && !act.playAnimation && !act.targetSceneId && !act.giveItemId && !act.setFlag && !act.eventName) || act.actionType === 'mixed') ? `
                <div class="act-type-block" style="margin-bottom:8px;">
                  <label style="font-size:0.65rem; color:var(--text-muted);">🗣️ Speech / Subtitle Line</label>
                  <input type="text" class="form-input act-text" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.text || ''}" placeholder="Spoken line or narrator description..." style="font-size:0.75rem;" />
                </div>
              ` : ''}

              <!-- 4. Scene Transition Block -->
              ${(act.actionType === 'scene_change' || (!act.actionType && !!act.targetSceneId) || act.actionType === 'mixed') ? `
                <div class="act-type-block" style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
                  <label style="font-size:0.65rem; color:#38bdf8; font-weight:700;">🚪 Destination Scene</label>
                  <select class="form-select act-target-scene" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" style="font-size:0.75rem; margin-top:4px;">
                    <option value="">-- Select Destination Scene --</option>
                    ${(project?.scenes || []).map(sc => `
                      <option value="${sc.id}" ${act.targetSceneId === sc.id ? 'selected' : ''}>${sc.name} (${sc.id})</option>
                    `).join('')}
                  </select>
                  ${act.targetSceneId ? `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:6px;">
                      <div>
                        <label style="font-size:0.6rem; color:#38bdf8;">📍 Spawn X</label>
                        <input type="number" class="form-input act-target-spawn-x" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.targetSpawnPoint?.x ?? 300}" style="font-size:0.75rem;" />
                      </div>
                      <div>
                        <label style="font-size:0.6rem; color:#38bdf8;">📍 Spawn Y</label>
                        <input type="number" class="form-input act-target-spawn-y" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.targetSpawnPoint?.y ?? 750}" style="font-size:0.75rem;" />
                      </div>
                    </div>
                    <div style="display:flex; gap:6px; margin-top:6px;">
                      <button class="btn btn-gold btn-pick-spawn-canvas" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" style="flex:1; font-size:0.68rem; padding:3px 6px;">
                        🎯 Pick on Canvas
                      </button>
                    </div>
                  ` : ''}
                </div>
              ` : ''}

              <!-- 5. Give Item Block -->
              ${(act.actionType === 'give_item' || (!act.actionType && !!act.giveItemId) || act.actionType === 'mixed') ? `
                <div class="act-type-block" style="background:rgba(52,211,153,0.08); border:1px solid rgba(52,211,153,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
                  <label style="font-size:0.65rem; color:#34d399; font-weight:700;">🎁 Give Quest Item</label>
                  <select class="form-select act-give-item" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" style="font-size:0.75rem; margin-top:4px;">
                    <option value="">-- Select Item --</option>
                    ${(project?.items || []).map(it => `
                      <option value="${it.id}" ${act.giveItemId === it.id ? 'selected' : ''}>${it.name} (${it.id})</option>
                    `).join('')}
                  </select>
                </div>
              ` : ''}

              <!-- 6. Story Flag Block -->
              ${(act.actionType === 'set_flag' || (!act.actionType && (!!act.setFlag || !!act.clearFlag)) || act.actionType === 'mixed') ? `
                <div class="act-type-block" style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
                  <label style="font-size:0.65rem; color:#10b981; font-weight:700;">🚩 Story Flag</label>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:4px;">
                    <div>
                      <label style="font-size:0.6rem; color:var(--text-muted);">Set Flag = TRUE</label>
                      <input type="text" class="form-input act-set-flag" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.setFlag || ''}" placeholder="e.g. hasKey" style="font-size:0.75rem;" />
                    </div>
                    <div>
                      <label style="font-size:0.6rem; color:var(--text-muted);">Clear Flag = FALSE</label>
                      <input type="text" class="form-input act-clear-flag" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.clearFlag || ''}" placeholder="e.g. doorLocked" style="font-size:0.75rem;" />
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- 7. Custom Broadcast Event Block -->
              ${(act.actionType === 'custom_event' || (!act.actionType && !!act.eventName) || act.actionType === 'mixed') ? `
                <div class="act-type-block" style="background:rgba(236,72,153,0.08); border:1px solid rgba(236,72,153,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
                  <label style="font-size:0.65rem; color:#ec4899; font-weight:700;">⚡ Custom Broadcast Event</label>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:4px;">
                    <div>
                      <label style="font-size:0.6rem; color:var(--text-muted);">Event Name</label>
                      <input type="text" class="form-input act-event-name" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.eventName || ''}" placeholder="e.g. event_gate_open" style="font-size:0.75rem;" />
                    </div>
                    <div>
                      <label style="font-size:0.6rem; color:var(--text-muted);">Payload / Argument</label>
                      <input type="text" class="form-input act-event-payload" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.eventPayload || ''}" placeholder="Optional data..." style="font-size:0.75rem;" />
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- Optional Audio SFX Trigger -->
              <div style="margin-top:6px; border-top:1px dashed rgba(255,255,255,0.08); padding-top:6px;">
                <label style="font-size:0.65rem; color:var(--text-muted);">🔊 Audio SFX (Optional)</label>
                <div style="display:flex; gap:6px; align-items:center;">
                  <input type="text" class="form-input act-sfx-url" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" value="${act.sfxUrl || ''}" placeholder="e.g. assets/audio/door_open.mp3" style="flex:1; font-size:0.75rem;" />
                  <label class="btn btn-primary" style="padding:4px 8px; cursor:pointer;" title="Choose SFX Audio File">
                    📁
                    <input type="file" class="act-sfx-file" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharacter ? 'true' : 'false'}" accept="audio/*" style="display:none;" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  public static attachEvents(
    container: HTMLElement,
    params: {
      project: ProjectData | null;
      currentScene: SceneData | null;
      onUpdate: () => void;
      onReRender: () => void;
    }
  ): void {
    const { project, currentScene, onUpdate, onReRender } = params;

    const getActions = (hIdx: number, isChar: boolean) => {
      return isChar ? currentScene?.characters[hIdx]?.actions : currentScene?.hotspots[hIdx]?.actions;
    };

    // Add Action Rule
    container.querySelectorAll('.btn-add-hs-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene?.hotspots[hIdx]) {
          if (!currentScene.hotspots[hIdx].actions) currentScene.hotspots[hIdx].actions = [];
          currentScene.hotspots[hIdx].actions.push({ verb: 'interact', text: 'New interaction text.' });
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-add-char-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cIdx = parseInt((e.target as HTMLElement).dataset.hidx!);
        if (currentScene?.characters[cIdx]) {
          if (!currentScene.characters[cIdx].actions) currentScene.characters[cIdx].actions = [];
          currentScene.characters[cIdx].actions!.push({ verb: 'talk', text: 'New speech response.' });
          onReRender();
          onUpdate();
        }
      });
    });

    // Action Verb Changing
    container.querySelectorAll('.act-verb').forEach(select => {
      select.addEventListener('change', (e) => {
        const targetEl = e.target as HTMLSelectElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].verb = targetEl.value as any;
          onReRender();
          onUpdate();
        }
      });
    });

    // Speech Text
    container.querySelectorAll('.act-text').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].text = targetEl.value;
          onUpdate();
        }
      });
    });

    // Condition Flag Toggle
    container.querySelectorAll('.act-cond-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetEl = e.currentTarget as HTMLButtonElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          const act = actions[aIdx];
          const flagVal = act.requiredFlag || act.notFlag;
          if (act.notFlag) {
            act.requiredFlag = flagVal;
            act.notFlag = undefined;
          } else {
            act.notFlag = flagVal;
            act.requiredFlag = undefined;
          }
          onReRender();
          onUpdate();
        }
      });
    });

    // Condition Flag Input
    container.querySelectorAll('.act-flag-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const formGroup = targetEl.closest('.flow-group');
        const isLabel = formGroup?.querySelector('.act-is-label') as HTMLElement;
        const toggleBtn = formGroup?.querySelector('.act-cond-toggle') as HTMLButtonElement;

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          const val = targetEl.value.trim();
          const hasVal = val.length > 0;
          const isFalseMode = actions[aIdx].notFlag !== undefined;

          if (!hasVal) {
            actions[aIdx].requiredFlag = undefined;
            actions[aIdx].notFlag = undefined;
          } else if (isFalseMode) {
            actions[aIdx].notFlag = val;
            actions[aIdx].requiredFlag = undefined;
          } else {
            actions[aIdx].requiredFlag = val;
            actions[aIdx].notFlag = undefined;
          }

          if (isLabel) {
            isLabel.style.color = hasVal ? 'var(--text-main)' : 'var(--text-muted)';
            isLabel.style.opacity = hasVal ? '1' : '0.4';
          }
          if (toggleBtn) {
            toggleBtn.disabled = !hasVal;
            toggleBtn.style.opacity = hasVal ? '1' : '0.4';
            toggleBtn.style.pointerEvents = hasVal ? 'auto' : 'none';
          }

          onUpdate();
        }
      });
    });

    // Action Type Selector
    container.querySelectorAll('.act-type-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const targetEl = e.target as HTMLSelectElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].actionType = targetEl.value as any;
          onReRender();
          onUpdate();
        }
      });
    });

    // Event Name & Payload
    container.querySelectorAll('.act-event-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].eventName = targetEl.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.act-event-payload').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].eventPayload = targetEl.value || undefined;
          onUpdate();
        }
      });
    });

    // Animation target & name
    container.querySelectorAll('.act-anim-target').forEach(select => {
      select.addEventListener('change', (e) => {
        const targetEl = e.target as HTMLSelectElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].animationTarget = targetEl.value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.act-play-anim').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].playAnimation = targetEl.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    // Give Item
    container.querySelectorAll('.act-give-item').forEach(input => {
      input.addEventListener('change', (e) => {
        const targetEl = e.target as HTMLSelectElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].giveItemId = targetEl.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    // Required Item ID
    container.querySelectorAll('.act-req-item').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].requireItemId = targetEl.value;
          onUpdate();
        }
      });
    });

    // Target Scene
    container.querySelectorAll('.act-target-scene').forEach(input => {
      input.addEventListener('change', (e) => {
        const targetEl = e.target as HTMLSelectElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].targetSceneId = targetEl.value.trim() || undefined;
          onReRender();
          onUpdate();
        }
      });
    });

    // Target Spawn X & Y
    container.querySelectorAll('.act-target-spawn-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          if (!actions[aIdx].targetSpawnPoint) actions[aIdx].targetSpawnPoint = { x: 300, y: 750 };
          actions[aIdx].targetSpawnPoint!.x = parseFloat(targetEl.value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.act-target-spawn-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          if (!actions[aIdx].targetSpawnPoint) actions[aIdx].targetSpawnPoint = { x: 300, y: 750 };
          actions[aIdx].targetSpawnPoint!.y = parseFloat(targetEl.value) || 0;
          onUpdate();
        }
      });
    });

    // Pick Spawn on Canvas
    container.querySelectorAll('.btn-pick-spawn-canvas').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetEl = e.currentTarget as HTMLElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx] && project) {
          const targetSceneId = actions[aIdx].targetSceneId;
          const targetScene = (targetSceneId && project.scenes.find(s => s.id === targetSceneId)) || currentScene || project.scenes[0];

          if (targetScene) {
            const initialSpawn = actions[aIdx].targetSpawnPoint || { x: 300, y: 750 };
            new VisualSpawnPickerModal(
              project,
              targetScene,
              initialSpawn,
              (result) => {
                if (!actions[aIdx].targetSpawnPoint) actions[aIdx].targetSpawnPoint = { x: result.x, y: result.y };
                actions[aIdx].targetSpawnPoint!.x = result.x;
                actions[aIdx].targetSpawnPoint!.y = result.y;

                const targetPlayer = targetScene.characters?.find(c => c.id === 'player');
                if (targetPlayer && result.scale !== undefined) {
                  targetPlayer.scale = result.scale;
                }

                onReRender();
                EventBus.getInstance().emit('editor:project_updated');
                EventBus.getInstance().emit('ui:notify', `📍 Target Spawn Point set to (${result.x}, ${result.y}) in '${targetScene.name}'!`);
              },
              () => {
                EventBus.getInstance().emit('ui:notify', '❌ Spawn point selection cancelled.');
              }
            );
          }
        }
      });
    });

    // Set Flag & Clear Flag
    container.querySelectorAll('.act-set-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].setFlag = targetEl.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.act-clear-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].clearFlag = targetEl.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    // Dialog ID Selector & Jump to Dialog Editor
    container.querySelectorAll('.act-dialog-id').forEach(input => {
      input.addEventListener('change', (e) => {
        const targetEl = e.target as HTMLSelectElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].dialogId = targetEl.value.trim() || undefined;
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-open-dialog-editor').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const dlgId = (e.currentTarget as HTMLElement).dataset.dlgid;
        if (dlgId) {
          EventBus.getInstance().emit('editor:open_dialog', dlgId);
        }
      });
    });

    // SFX File & URL
    container.querySelectorAll('.act-sfx-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions[aIdx].sfxUrl = targetEl.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.act-sfx-file').forEach(fileInput => {
      fileInput.addEventListener('change', (e) => {
        const targetEl = e.target as HTMLInputElement;
        const file = targetEl.files?.[0];
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        if (file) {
          const relPath = resolvePickedAssetPath(file, 'audio', currentScene, project);
          const actions = getActions(hIdx, isChar);
          if (actions && actions[aIdx]) {
            actions[aIdx].sfxUrl = relPath;
            const urlInput = container.querySelector(`.act-sfx-url[data-hidx="${hIdx}"][data-aidx="${aIdx}"][data-ischar="${isChar}"]`) as HTMLInputElement;
            if (urlInput) urlInput.value = relPath;
            onUpdate();
          }
        }
      });
    });

    // Reorder Actions: Move Up / Down
    container.querySelectorAll('.btn-move-action-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetEl = e.currentTarget as HTMLElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && aIdx > 0) {
          const temp = actions[aIdx];
          actions[aIdx] = actions[aIdx - 1];
          actions[aIdx - 1] = temp;
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-move-action-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetEl = e.currentTarget as HTMLElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && aIdx < actions.length - 1) {
          const temp = actions[aIdx];
          actions[aIdx] = actions[aIdx + 1];
          actions[aIdx + 1] = temp;
          onReRender();
          onUpdate();
        }
      });
    });

    // Delete Action Rule
    container.querySelectorAll('.btn-del-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetEl = e.target as HTMLElement;
        const hIdx = parseInt(targetEl.dataset.hidx!);
        const aIdx = parseInt(targetEl.dataset.aidx!);
        const isChar = targetEl.dataset.ischar === 'true';

        const actions = getActions(hIdx, isChar);
        if (actions && actions[aIdx]) {
          actions.splice(aIdx, 1);
          onReRender();
          onUpdate();
        }
      });
    });
  }
}
