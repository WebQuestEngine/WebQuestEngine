import { HotspotAction, ProjectData, SceneData, DialogTree, SceneData as SC, InventoryItemData, CharacterData } from '../../../../engine/types';
import { TemplateUtils } from '../../../utils/TemplateUtils';

import containerHtml from './ActionRulesInspector.html?raw';
import cardHtml from './ActionRuleCard.html?raw';

export class ActionRulesInspectorTemplate {
  public static render(params: {
    hIdx: number;
    actions: HotspotAction[];
    isCharacter?: boolean;
    project: ProjectData | null;
    currentScene: SceneData | null;
  }): string {
    const { hIdx, actions, isCharacter = false, project, currentScene } = params;
    const isCharStr = isCharacter ? 'true' : 'false';

    const emptyOrRulesHTML = actions.length === 0
      ? `<div style="font-size:0.75rem; color:var(--text-muted); font-style:italic; padding:8px 0;">
           No interaction rules defined yet. Click "+ Add Action Rule" to create one.
         </div>`
      : TemplateUtils.renderList<HotspotAction>(actions, (act: HotspotAction, aIdx: number) =>
          this.renderCard({ act, aIdx, hIdx, actions, isCharStr, project, currentScene })
        );

    return TemplateUtils.populate(containerHtml, {
      actionCount: actions.length,
      hIdx,
      addBtnClass: isCharacter ? 'btn-add-char-action' : 'btn-add-hs-action',
      emptyOrRulesHTML,
    });
  }

  private static renderCard(p: {
    act: HotspotAction;
    aIdx: number;
    hIdx: number;
    actions: HotspotAction[];
    isCharStr: string;
    project: ProjectData | null;
    currentScene: SceneData | null;
  }): string {
    const { act, aIdx, hIdx, actions, isCharStr, project, currentScene } = p;
    const isChar = isCharStr === 'true';

    // WHEN — verb selection
    const sel = (v: string) => act.verb === v ? 'selected' : '';
    const requireItemHTML = act.verb === 'use'
      ? `<div style="margin-top:6px;">
           <label style="font-size:0.65rem; color:var(--text-muted);">Required Item ID</label>
           <input type="text" class="form-input act-req-item" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" value="${TemplateUtils.escapeHtml(act.requireItemId || '')}" placeholder="e.g. item_key" style="font-size:0.75rem;" />
         </div>`
      : '';

    // IF CONDITION
    const hasFlag = !!(act.requiredFlag || act.notFlag);
    const condFlagValue = TemplateUtils.escapeHtml(act.requiredFlag || act.notFlag || '');
    const condToggleClass = act.notFlag ? 'mode-false' : 'mode-true';
    const condToggleLabel = act.notFlag ? '❌ FALSE' : '✅ TRUE';

    // Action type selector options
    const actionTypeOptionsHTML = [
      { value: 'dialog',       label: '💬 Start Dialogue Tree',      selected: act.actionType === 'dialog' || (!act.actionType && !!act.dialogId) },
      { value: 'animation',    label: '🎬 Play Character Animation', selected: act.actionType === 'animation' || (!act.actionType && !!act.playAnimation && !act.dialogId) },
      { value: 'speech',       label: '🗣️ Say Speech / Subtitle',    selected: act.actionType === 'speech' || (!act.actionType && !act.dialogId && !act.playAnimation && !act.targetSceneId && !act.giveItemId && !act.setFlag && !act.eventName) },
      { value: 'scene_change', label: '🚪 Change Scene (Teleport)',  selected: act.actionType === 'scene_change' || (!act.actionType && !!act.targetSceneId) },
      { value: 'give_item',    label: '🎁 Give Inventory Item',      selected: act.actionType === 'give_item' || (!act.actionType && !!act.giveItemId) },
      { value: 'set_flag',     label: '🚩 Set / Clear Story Flag',   selected: act.actionType === 'set_flag' || (!act.actionType && (!!act.setFlag || !!act.clearFlag)) },
      { value: 'custom_event', label: '⚡ Broadcast Custom Event',   selected: act.actionType === 'custom_event' || (!act.actionType && !!act.eventName) },
      { value: 'mixed',        label: '⚙️ Multi-Action (All Outcomes)', selected: act.actionType === 'mixed' },
    ].map(o => `<option value="${o.value}" ${o.selected ? 'selected' : ''}>${o.label}</option>`).join('');

    // THEN — conditional sub-blocks
    const showDialog   = act.actionType === 'dialog' || (!act.actionType && !!act.dialogId) || act.actionType === 'mixed';
    const showAnim     = act.actionType === 'animation' || (!act.actionType && !!act.playAnimation && !act.dialogId) || act.actionType === 'mixed';
    const showSpeech   = act.actionType === 'speech' || (!act.actionType && !act.dialogId && !act.playAnimation && !act.targetSceneId && !act.giveItemId && !act.setFlag && !act.eventName) || act.actionType === 'mixed';
    const showScene    = act.actionType === 'scene_change' || (!act.actionType && !!act.targetSceneId) || act.actionType === 'mixed';
    const showGiveItem = act.actionType === 'give_item' || (!act.actionType && !!act.giveItemId) || act.actionType === 'mixed';
    const showFlag     = act.actionType === 'set_flag' || (!act.actionType && (!!act.setFlag || !!act.clearFlag)) || act.actionType === 'mixed';
    const showEvent    = act.actionType === 'custom_event' || (!act.actionType && !!act.eventName) || act.actionType === 'mixed';

    const dialogBlockHTML = showDialog ? `
      <div class="act-type-block" style="background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
        <label style="font-size:0.65rem; color:#a78bfa; font-weight:700;">💬 Dialogue Tree</label>
        <div style="display:flex; gap:6px; margin-top:4px;">
          <select class="form-select act-dialog-id" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" style="font-size:0.75rem; flex:1;">
            <option value="">-- Select Dialogue Tree --</option>
            ${TemplateUtils.renderList<{id: string; title: string}>(project?.dialogs || [], (d: {id: string; title: string}) =>
              `<option value="${d.id}" ${act.dialogId === d.id ? 'selected' : ''}>${TemplateUtils.escapeHtml(d.title)} (${d.id})</option>`
            )}
          </select>
          ${act.dialogId ? `<button class="btn btn-gold btn-open-dialog-editor" data-dlgid="${act.dialogId}" style="font-size:0.68rem; padding:4px 8px;" title="Open Dialogue Tree in Editor">✏️ Edit</button>` : ''}
        </div>
      </div>` : '';

    const animationBlockHTML = showAnim ? `
      <div class="act-type-block" style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
        <label style="font-size:0.65rem; color:#f59e0b; font-weight:700;">🎬 Play Animation</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:4px;">
          <div>
            <label style="font-size:0.6rem; color:var(--text-muted);">Animation Name</label>
            <input type="text" class="form-input act-play-anim" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" value="${TemplateUtils.escapeHtml(act.playAnimation || '')}" placeholder="e.g. gesture, cast, pick_up" style="font-size:0.75rem;" />
          </div>
          <div>
            <label style="font-size:0.6rem; color:var(--text-muted);">Target Character</label>
            <select class="form-select act-anim-target" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" style="font-size:0.75rem;">
              <option value="player" ${act.animationTarget === 'player' || !act.animationTarget ? 'selected' : ''}>Player Character</option>
              <option value="self" ${act.animationTarget === 'self' ? 'selected' : ''}>Self (Target Element)</option>
              ${TemplateUtils.renderList<{id: string; name: string}>(currentScene?.characters || [], (c: {id: string; name: string}) =>
                `<option value="${c.id}" ${act.animationTarget === c.id ? 'selected' : ''}>${TemplateUtils.escapeHtml(c.name)} (${c.id})</option>`
              )}
            </select>
          </div>
        </div>
      </div>` : '';

    const speechBlockHTML = showSpeech ? `
      <div class="act-type-block" style="margin-bottom:8px;">
        <label style="font-size:0.65rem; color:var(--text-muted);">🗣️ Speech / Subtitle Line</label>
        <input type="text" class="form-input act-text" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" value="${TemplateUtils.escapeHtml(act.text || '')}" placeholder="Spoken line or narrator description..." style="font-size:0.75rem;" />
      </div>` : '';

    const sceneChangeBlockHTML = showScene ? `
      <div class="act-type-block" style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
        <label style="font-size:0.65rem; color:#38bdf8; font-weight:700;">🚪 Destination Scene</label>
        <select class="form-select act-target-scene" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" style="font-size:0.75rem; margin-top:4px;">
          <option value="">-- Select Destination Scene --</option>
          ${TemplateUtils.renderList<{id: string; name: string}>(project?.scenes || [], (sc: {id: string; name: string}) =>
            `<option value="${sc.id}" ${act.targetSceneId === sc.id ? 'selected' : ''}>${TemplateUtils.escapeHtml(sc.name)} (${sc.id})</option>`
          )}
        </select>
        ${act.targetSceneId ? `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:6px;">
            <div>
              <label style="font-size:0.6rem; color:#38bdf8;">📍 Spawn X</label>
              <input type="number" class="form-input act-target-spawn-x" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" value="${act.targetSpawnPoint?.x ?? 300}" style="font-size:0.75rem;" />
            </div>
            <div>
              <label style="font-size:0.6rem; color:#38bdf8;">📍 Spawn Y</label>
              <input type="number" class="form-input act-target-spawn-y" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" value="${act.targetSpawnPoint?.y ?? 750}" style="font-size:0.75rem;" />
            </div>
          </div>
          <div style="display:flex; gap:6px; margin-top:6px;">
            <button class="btn btn-gold btn-pick-spawn-canvas" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" style="flex:1; font-size:0.68rem; padding:3px 6px;">
              🎯 Pick on Canvas
            </button>
          </div>` : ''}
      </div>` : '';

    const giveItemBlockHTML = showGiveItem ? `
      <div class="act-type-block" style="background:rgba(52,211,153,0.08); border:1px solid rgba(52,211,153,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
        <label style="font-size:0.65rem; color:#34d399; font-weight:700;">🎁 Give Quest Item</label>
        <select class="form-select act-give-item" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" style="font-size:0.75rem; margin-top:4px;">
          <option value="">-- Select Item --</option>
          ${TemplateUtils.renderList<{id: string; name: string}>(project?.items || [], (it: {id: string; name: string}) =>
            `<option value="${it.id}" ${act.giveItemId === it.id ? 'selected' : ''}>${TemplateUtils.escapeHtml(it.name)} (${it.id})</option>`
          )}
        </select>
      </div>` : '';

    const setFlagBlockHTML = showFlag ? `
      <div class="act-type-block" style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
        <label style="font-size:0.65rem; color:#10b981; font-weight:700;">🚩 Story Flag</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:4px;">
          <div>
            <label style="font-size:0.6rem; color:var(--text-muted);">Set Flag = TRUE</label>
            <input type="text" class="form-input act-set-flag" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" value="${TemplateUtils.escapeHtml(act.setFlag || '')}" placeholder="e.g. hasKey" style="font-size:0.75rem;" />
          </div>
          <div>
            <label style="font-size:0.6rem; color:var(--text-muted);">Clear Flag = FALSE</label>
            <input type="text" class="form-input act-clear-flag" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" value="${TemplateUtils.escapeHtml(act.clearFlag || '')}" placeholder="e.g. doorLocked" style="font-size:0.75rem;" />
          </div>
        </div>
      </div>` : '';

    const customEventBlockHTML = showEvent ? `
      <div class="act-type-block" style="background:rgba(236,72,153,0.08); border:1px solid rgba(236,72,153,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
        <label style="font-size:0.65rem; color:#ec4899; font-weight:700;">⚡ Custom Broadcast Event</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:4px;">
          <div>
            <label style="font-size:0.6rem; color:var(--text-muted);">Event Name</label>
            <input type="text" class="form-input act-event-name" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" value="${TemplateUtils.escapeHtml(act.eventName || '')}" placeholder="e.g. event_gate_open" style="font-size:0.75rem;" />
          </div>
          <div>
            <label style="font-size:0.6rem; color:var(--text-muted);">Payload / Argument</label>
            <input type="text" class="form-input act-event-payload" data-hidx="${hIdx}" data-aidx="${aIdx}" data-ischar="${isCharStr}" value="${TemplateUtils.escapeHtml(act.eventPayload || '')}" placeholder="Optional data..." style="font-size:0.75rem;" />
          </div>
        </div>
      </div>` : '';

    return TemplateUtils.populate(cardHtml, {
      hIdx,
      aIdx,
      isCharStr,
      isFirst:  aIdx === 0 ? 'disabled style="opacity:0.3;"' : '',
      isLast:   aIdx === actions.length - 1 ? 'disabled style="opacity:0.3;"' : '',
      verbSelectedLook:     sel('look'),
      verbSelectedInteract: sel('interact'),
      verbSelectedTalk:     sel('talk'),
      verbSelectedUse:      sel('use'),
      verbSelectedPickUp:   sel('pick_up'),
      requireItemHTML,
      condFlagValue,
      condIsLabel_style: `color:${hasFlag ? 'var(--text-main)' : 'var(--text-muted)'}; opacity:${hasFlag ? '1' : '0.4'};`,
      condToggleClass,
      condToggleDisabled:      hasFlag ? '' : 'disabled',
      condToggleOpacity:       hasFlag ? '1' : '0.4',
      condTogglePointerEvents: hasFlag ? 'auto' : 'none',
      condToggleLabel,
      actionTypeOptionsHTML,
      dialogBlockHTML,
      animationBlockHTML,
      speechBlockHTML,
      sceneChangeBlockHTML,
      giveItemBlockHTML,
      setFlagBlockHTML,
      customEventBlockHTML,
      sfxUrl: TemplateUtils.escapeHtml(act.sfxUrl || ''),
    });
  }
}
