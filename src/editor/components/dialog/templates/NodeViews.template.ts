import { DialogTree, DialogNode, ProjectData, DirectiveActionType, SceneData } from '../../../../engine/types';
import { TemplateUtils } from '../../../utils/TemplateUtils';
import { DialogEditorUtils } from '../DialogEditorUtils';

import dialogEditorLayoutHtml from './DialogEditorLayout.html?raw';
import dialogTreeListItemHtml from './DialogTreeListItem.html?raw';
import conditionPickerHtml from './ConditionPicker.html?raw';
import stageDirectiveCardHtml from './StageDirectiveCard.html?raw';
import choiceCardHtml from './ChoiceCard.html?raw';
import routerBranchCardHtml from './RouterBranchCard.html?raw';
import beatNodeCardHtml from './BeatNodeCard.html?raw';
import routerNodeCardHtml from './RouterNodeCard.html?raw';
import eventNodeCardHtml from './EventNodeCard.html?raw';
import actionNodeCardHtml from './ActionNodeCard.html?raw';

export class DialogEditorTemplate {
  public static renderLayout(): string {
    return dialogEditorLayoutHtml;
  }

  public static renderTreeList(params: {
    dialogs: DialogTree[];
    selectedTreeId: string | null;
    project: ProjectData | null;
    sceneFilter?: string;
  }): string {
    const { dialogs, selectedTreeId, project, sceneFilter } = params;
    const filter = sceneFilter || 'all';

    const filtered = dialogs.filter(dlg => {
      if (filter === 'all') return true;
      const sId = DialogEditorUtils.getSequenceSceneId(project, dlg);
      return sId === filter;
    });

    if (filtered.length === 0) {
      return '<div style="font-size:0.75rem; color:var(--text-muted); padding:10px; font-style:italic;">No sequences found for this scene filter.</div>';
    }

    return filtered.map((dlg: DialogTree) => {
      const isSel = dlg.id === selectedTreeId;
      const nodeCount = Object.keys(dlg.nodes || {}).length;
      const sId = DialogEditorUtils.getSequenceSceneId(project, dlg);
      const sceneObj = project?.scenes?.find(s => s.id === sId);
      const sceneBadge = sId === 'global' ? '🌐 Global' : `🏰 ${sceneObj?.name || sId}`;

      return `
        <div class="tree-item ${isSel ? 'active' : ''}" data-treeid="${dlg.id}" style="padding:6px 10px; border-radius:6px; background:${isSel ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isSel ? 'var(--accent-gold)' : 'transparent'}; cursor:pointer; display:flex; flex-direction:column; gap:2px; transition:all 0.15s ease;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:${isSel ? '700' : '600'}; color:${isSel ? 'var(--accent-gold)' : 'var(--text-main)'}; font-size:0.78rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              🎬 ${TemplateUtils.escapeHtml(dlg.title || dlg.id)}
            </span>
            <span style="font-size:0.6rem; color:var(--text-muted);">${nodeCount} node${nodeCount !== 1 ? 's' : ''}</span>
          </div>
          <div style="font-size:0.62rem; color:${sId === 'global' ? '#94a3b8' : '#38bdf8'};">${TemplateUtils.escapeHtml(sceneBadge)}</div>
        </div>
      `;
    }).join('');
  }

  public static renderStoryboardCanvas(params: {
    project: ProjectData | null;
    activeSceneId?: string;
  }): string {
    const { project, activeSceneId } = params;
    if (!project || !project.scenes) return '';

    const scenes = project.scenes;
    let html = '';

    scenes.forEach((sc, idx) => {
      const isCurrentScene = sc.id === activeSceneId;
      const x = sc.storyPosition?.x ?? (80 + (idx % 3) * 390);
      const y = sc.storyPosition?.y ?? (80 + Math.floor(idx / 3) * 360);

      const seqs = DialogEditorUtils.getSequencesForScene(project, sc.id);
      const transitions = DialogEditorUtils.getSceneTransitions(project).filter(t => t.fromSceneId === sc.id);

      html += `
        <div class="storyboard-scene-card" data-sceneid="${sc.id}" style="position:absolute; left:${x}px; top:${y}px; width:340px; background:rgba(15,23,42,0.96); border:2px solid ${isCurrentScene ? 'var(--accent-gold)' : '#38bdf8'}; border-radius:10px; padding:12px; box-shadow:0 10px 30px rgba(0,0,0,0.6); pointer-events:auto; cursor:default; z-index:10;">
          <div class="storyboard-card-header" data-sceneid="${sc.id}" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px; cursor:move;">
            <div style="font-weight:700; font-size:0.95rem; color:${isCurrentScene ? 'var(--accent-gold)' : '#38bdf8'}; display:flex; align-items:center; gap:6px;">
              <span>🏰 ${TemplateUtils.escapeHtml(sc.name)}</span>
              ${isCurrentScene ? '<span style="font-size:0.6rem; background:var(--accent-gold); color:#000; padding:1px 4px; border-radius:4px; font-weight:800;">ACTIVE</span>' : ''}
            </div>
            <span style="font-size:0.65rem; color:var(--text-muted);">${sc.id}</span>
          </div>

          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px; display:flex; gap:12px;">
            <span>👥 ${sc.characters?.length || 0} Actors</span>
            <span>📦 ${sc.hotspots?.length || 0} Hotspots</span>
            <span>🎬 ${seqs.length} Sequences</span>
          </div>

          <!-- Associated Sequences -->
          <div style="background:rgba(0,0,0,0.3); border-radius:6px; padding:6px 8px; margin-bottom:8px;">
            <div style="font-size:0.65rem; color:#94a3b8; font-weight:700; margin-bottom:4px;">🎬 Sequences & Dialogues:</div>
            ${seqs.length > 0 ? seqs.map(s => `
              <div class="btn-jump-to-sequence" data-treeid="${s.id}" data-sceneid="${sc.id}" style="font-size:0.7rem; color:#38bdf8; cursor:pointer; padding:2px 0; display:flex; justify-content:space-between;" title="Open sequence in editor">
                <span>▶ ${TemplateUtils.escapeHtml(s.title || s.id)}</span>
                <span style="font-size:0.6rem; color:var(--text-muted);">${Object.keys(s.nodes || {}).length} nodes</span>
              </div>
            `).join('') : '<div style="font-size:0.65rem; color:var(--text-muted); font-style:italic;">No sequences tied to this scene yet.</div>'}
          </div>

          <!-- Outgoing Exits -->
          ${transitions.length > 0 ? `
            <div style="background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.25); border-radius:6px; padding:6px 8px; margin-bottom:8px;">
              <div style="font-size:0.65rem; color:#10b981; font-weight:700; margin-bottom:2px;">🚪 Outgoing Scene Transitions:</div>
              ${transitions.map(ex => {
                const targetScene = project.scenes.find(s => s.id === ex.toSceneId);
                return `<div style="font-size:0.7rem; color:#e2e8f0;">➔ <b>${TemplateUtils.escapeHtml(targetScene?.name || ex.toSceneId)}</b> (${TemplateUtils.escapeHtml(ex.label)})</div>`;
              }).join('')}
            </div>
          ` : ''}

          <!-- Action Buttons -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px;">
            <button class="btn btn-primary btn-open-scene-graphs" data-sceneid="${sc.id}" style="font-size:0.75rem; padding:6px 8px; background:linear-gradient(135deg, #1e293b, #0f172a); border-color:#38bdf8; color:#38bdf8; font-weight:700;" title="Double-click node to open">🎬 Open Graphs</button>
            <button class="btn btn-jump-main-scene" data-sceneid="${sc.id}" style="font-size:0.75rem; padding:6px 8px; background:rgba(255,255,255,0.06); border-color:var(--panel-border); color:#f8fafc;" title="Switch active scene in main editor">🏰 Edit Scene</button>
          </div>
        </div>
      `;
    });

    return html;
  }

  public static renderStoryboardSidebar(params: {
    project: ProjectData | null;
    activeSceneId?: string;
  }): string {
    const { project, activeSceneId } = params;
    if (!project || !project.scenes) return '';

    return project.scenes.map(sc => {
      const isCur = sc.id === activeSceneId;
      const seqCount = DialogEditorUtils.getSequencesForScene(project, sc.id).length;
      return `
        <div class="storyboard-sidebar-item" data-sceneid="${sc.id}" style="padding:8px 10px; border-radius:6px; background:${isCur ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isCur ? 'var(--accent-gold)' : 'transparent'}; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:background 0.15s ease;">
          <div>
            <div style="font-weight:700; font-size:0.78rem; color:${isCur ? 'var(--accent-gold)' : '#f8fafc'};">🏰 ${TemplateUtils.escapeHtml(sc.name)}</div>
            <div style="font-size:0.62rem; color:var(--text-muted);">${sc.id}</div>
          </div>
          <span style="font-size:0.65rem; background:rgba(56,189,248,0.15); color:#38bdf8; padding:2px 6px; border-radius:4px; font-weight:700;">${seqCount} seqs</span>
        </div>
      `;
    }).join('');
  }

  public static renderEmptySequencePrompt(): string {
    return '<div style="padding:20px; color:var(--text-muted); pointer-events:auto;">Select a cinematic sequence to edit.</div>';
  }
}

export class NodeViewsTemplate {
  public static renderConditionPicker(opts: {
    nodeId: string;
    choiceIdx?: number;
    requiredFlag?: string;
    notFlag?: string;
    allowFallback?: boolean;
  }): string {
    const { nodeId, choiceIdx, requiredFlag, notFlag, allowFallback } = opts;
    const isChoice = choiceIdx !== undefined && choiceIdx >= 0;

    let currentFlag = '';
    let currentOp: 'always' | 'true' | 'false' | 'fallback' = allowFallback ? 'fallback' : 'always';

    if (notFlag !== undefined) {
      currentFlag = notFlag;
      currentOp = 'false';
    } else if (requiredFlag !== undefined) {
      currentFlag = requiredFlag;
      currentOp = 'true';
    }

    const isAlwaysOrFallback = currentOp === 'always' || currentOp === 'fallback';
    const cidxAttr = isChoice ? `data-cidx="${choiceIdx}"` : '';
    const opClass = isChoice ? 'cond-choice-op' : 'cond-node-op';
    const nameClass = isChoice ? 'cond-choice-name' : 'cond-node-name';

    let opColor = '#94a3b8';
    if (currentOp === 'false') opColor = '#ef4444';
    else if (currentOp === 'true') opColor = '#22c55e';
    else if (currentOp === 'fallback') opColor = '#f59e0b';

    let optionsHtml = '';
    if (allowFallback) {
      optionsHtml = `
        <option value="true" ${currentOp === 'true' ? 'selected' : ''}>✅ TRUE</option>
        <option value="false" ${currentOp === 'false' ? 'selected' : ''}>❌ FALSE</option>
        <option value="fallback" ${currentOp === 'fallback' ? 'selected' : ''}>⚡ Else (Fallback)</option>
      `;
    } else {
      optionsHtml = `
        <option value="always" ${currentOp === 'always' ? 'selected' : ''}>⚡ Always</option>
        <option value="true" ${currentOp === 'true' ? 'selected' : ''}>✅ TRUE</option>
        <option value="false" ${currentOp === 'false' ? 'selected' : ''}>❌ FALSE</option>
      `;
    }

    return TemplateUtils.populate(conditionPickerHtml, {
      nameClass,
      nodeId,
      cidxAttr,
      currentFlag: TemplateUtils.escapeHtml(currentFlag),
      opacityStyle: isAlwaysOrFallback ? 'opacity:0.35;' : '',
      disabledAttr: isAlwaysOrFallback ? 'disabled' : '',
      opClass,
      opColor,
      optionsHtml,
    });
  }

  public static renderNodeCard(params: {
    node: DialogNode;
    tree: DialogTree;
    project: ProjectData | null;
  }): string {
    const { node, tree, project } = params;
    const rawType = node.nodeType || (node.isRouterNode ? 'router' : 'beat');
    const nodeType: 'beat' | 'router' | 'event_listener' | 'action' = rawType;

    switch (nodeType) {
      case 'router':
        return this.renderRouterNodeCard({ node, tree, project });
      case 'event_listener':
        return this.renderEventNodeCard({ node, tree, project });
      case 'action':
        return this.renderActionNodeCard({ node, tree, project });
      case 'beat':
      default:
        return this.renderBeatNodeCard({ node, tree, project });
    }
  }

  private static renderBeatNodeCard(params: {
    node: DialogNode;
    tree: DialogTree;
    project: ProjectData | null;
  }): string {
    const { node, tree, project } = params;
    const isStartNode = node.id === tree.startNodeId;
    const directives = node.directives || [];
    const choiceCount = node.choices?.length || 0;
    const hasMultipleOutgoing = choiceCount > 1;
    const isInteractive = node.isChoiceInteractive !== false;

    const startBadgeHtml = isStartNode
      ? '<span style="background:var(--accent-gold); color:#000; font-size:0.6rem; font-weight:800; padding:1px 5px; border-radius:4px;">START</span>'
      : '';

    const startBtnHtml = !isStartNode
      ? `<button class="btn btn-make-start" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;" title="Set as Start Node">🚩 Start</button>`
      : '';

    const directivesListHtml = directives.length === 0
      ? '<div style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">No background character or camera choreography. Click "+ Add Directive".</div>'
      : `<div style="display:flex; flex-direction:column; gap:6px;">${TemplateUtils.renderList(directives, (dir, dIdx) =>
          this.renderStageDirectiveCard({ node, dir, dIdx, project })
        )}</div>`;

    const conditionPickerHtml = this.renderConditionPicker({
      nodeId: node.id,
      requiredFlag: node.requiredFlag,
      notFlag: node.notFlag,
    });

    const interactivityCheckboxHtml = hasMultipleOutgoing
      ? `<div style="background:rgba(251, 191, 36, 0.1); border:1px solid rgba(251, 191, 36, 0.3); border-radius:6px; padding:6px; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
          <input type="checkbox" class="node-interactive-chk" data-nodeid="${node.id}" ${isInteractive ? 'checked' : ''} id="chk_inter_${node.id}" />
          <label for="chk_inter_${node.id}" style="font-size:0.7rem; color:var(--accent-gold); font-weight:700; cursor:pointer;">
            ☑️ Interactive Player Selection Box
          </label>
        </div>`
      : '';

    const choicesOrNextHtml = (node.choices && node.choices.length > 0)
      ? `<div style="display:flex; flex-direction:column; gap:6px;">${TemplateUtils.renderList(node.choices, (c, cIdx) =>
          this.renderChoiceCard({ node, choice: c, cIdx })
        )}</div>`
      : `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:6px; border:1px solid rgba(56,189,248,0.2); position:relative;">
          <span style="font-size:0.7rem; color:#38bdf8; font-weight:700;">▶ Next Beat:</span>
          <span style="font-size:0.72rem; color:${node.nextNodeId ? '#38bdf8' : 'var(--text-muted)'}; font-weight:700;">
            ${node.nextNodeId ? `➔ ${node.nextNodeId}` : '(End Sequence)'}
          </span>
          <div class="node-port node-port-out" data-nodeid="${node.id}" style="position:absolute; right:-15px; top:50%; transform:translateY(-50%); width:18px; height:18px; border-radius:50%; background:#38bdf8; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(56,189,248,0.9); z-index:10;" title="▶ Next Beat: Drag arrow to connect to target node Input Port"></div>
        </div>`;

    const actorsList = DialogEditorUtils.getAllProjectActors(project);
    const currentSpeaker = (node.speaker || '').trim();

    const matchedActor = actorsList.find(a =>
      (node.actorId && a.id === node.actorId) ||
      (currentSpeaker && (
        a.displayName.toLowerCase() === currentSpeaker.toLowerCase() ||
        a.id.toLowerCase() === currentSpeaker.toLowerCase() ||
        a.name.toLowerCase() === currentSpeaker.toLowerCase()
      ))
    );

    const isNarrator = currentSpeaker.toLowerCase() === 'narrator' || (!currentSpeaker && !node.actorId);
    const isCustom = !isNarrator && !matchedActor && currentSpeaker.length > 0;

    const speakerActorsOptionsHtml = actorsList.map(a => {
      const isSel = (!isNarrator && matchedActor?.id === a.id);
      return `<option value="${a.id}" data-name="${TemplateUtils.escapeHtml(a.displayName)}" ${isSel ? 'selected' : ''}>${TemplateUtils.escapeHtml(a.name)}</option>`;
    }).join('');

    const speakerNarratorSelected = isNarrator ? 'selected' : '';
    const speakerCustomSelected = isCustom ? 'selected' : '';
    const customSpeakerStyle = isCustom ? 'display:block;' : 'display:none;';

    const currentActor = matchedActor || (isNarrator ? null : actorsList[0]);
    const anims = currentActor?.animations || ['talk', 'idle', 'gesture', 'listen', 'look_around'];
    const speakerAnimOptionsHtml = anims.map(an => `<option value="${TemplateUtils.escapeHtml(an)}"></option>`).join('');

    return TemplateUtils.populate(beatNodeCardHtml, {
      nodeId: node.id,
      posX: node.position?.x ?? 50,
      posY: node.position?.y ?? 50,
      cardBorder: isStartNode ? 'var(--accent-gold)' : 'var(--panel-border)',
      headerColor: isStartNode ? 'var(--accent-gold)' : '#38bdf8',
      startBadgeHtml,
      startBtnHtml,
      speaker: TemplateUtils.escapeHtml(node.speaker || ''),
      speakerAnimation: TemplateUtils.escapeHtml(node.speakerAnimation || ''),
      speakerActorsOptionsHtml,
      speakerNarratorSelected,
      speakerCustomSelected,
      customSpeakerStyle,
      speakerAnimOptionsHtml,
      text: TemplateUtils.escapeHtml(node.text || ''),
      voiceAudioUrl: TemplateUtils.escapeHtml(node.voiceAudioUrl || ''),
      directivesCount: directives.length,
      directivesListHtml,
      conditionPickerHtml,
      interactivityCheckboxHtml,
      choiceCount,
      choicesOrNextHtml,
    });
  }

  private static renderRouterNodeCard(params: {
    node: DialogNode;
    tree: DialogTree;
    project: ProjectData | null;
  }): string {
    const { node, tree } = params;
    const isStartNode = node.id === tree.startNodeId;
    const choiceCount = node.choices?.length || 0;

    const startBadgeHtml = isStartNode
      ? '<span style="background:var(--accent-gold); color:#000; font-size:0.6rem; font-weight:800; padding:1px 5px; border-radius:4px;">START</span>'
      : '';

    const startBtnHtml = !isStartNode
      ? `<button class="btn btn-make-start" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;" title="Set as Start Node">🚩 Start</button>`
      : '';

    const branchRulesListHtml = (node.choices && node.choices.length > 0)
      ? `<div style="display:flex; flex-direction:column; gap:6px;">${TemplateUtils.renderList(node.choices, (c, cIdx) =>
          this.renderRouterBranchCard({ node, choice: c, cIdx })
        )}</div>`
      : '';

    return TemplateUtils.populate(routerNodeCardHtml, {
      nodeId: node.id,
      posX: node.position?.x ?? 50,
      posY: node.position?.y ?? 50,
      cardBorder: isStartNode ? 'var(--accent-gold)' : '#c084fc',
      headerColor: isStartNode ? 'var(--accent-gold)' : '#c084fc',
      startBadgeHtml,
      startBtnHtml,
      choiceCount,
      branchRulesListHtml,
    });
  }

  private static renderEventNodeCard(params: {
    node: DialogNode;
    tree: DialogTree;
    project: ProjectData | null;
  }): string {
    const { node, tree, project } = params;
    const isStartNode = node.id === tree.startNodeId;

    const startBadgeHtml = isStartNode
      ? '<span style="background:var(--accent-gold); color:#000; font-size:0.6rem; font-weight:800; padding:1px 5px; border-radius:4px;">START</span>'
      : '';

    const startBtnHtml = !isStartNode
      ? `<button class="btn btn-make-start" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;" title="Set as Start Node">🚩 Start</button>`
      : '';

    const scenesList = DialogEditorUtils.getAllScenes(project);
    const hotspotsList = DialogEditorUtils.getAllHotspots(project);
    const charactersList = DialogEditorUtils.getAllCharacters(project);
    const itemsList = DialogEditorUtils.getAllItems(project);

    let targetDropdownHtml = '';
    if (node.eventScope === 'scene' || !node.eventScope) {
      targetDropdownHtml = `
        <div style="margin-bottom:6px;">
          <label style="font-size:0.65rem; color:var(--text-muted);">🌄 Target Scene</label>
          <select class="form-input node-event-target" data-nodeid="${node.id}" style="width:100%; font-size:0.75rem;">
            ${TemplateUtils.renderList(scenesList, sc =>
              `<option value="${sc.id}" ${(node.eventTargetId === sc.id || (!node.eventTargetId && sc === scenesList[0])) ? 'selected' : ''}>🏰 ${TemplateUtils.escapeHtml(sc.name)} (${sc.id})</option>`
            )}
          </select>
        </div>
      `;
    } else if (node.eventScope === 'hotspot') {
      targetDropdownHtml = `
        <div style="margin-bottom:6px;">
          <label style="font-size:0.65rem; color:var(--text-muted);">📦 Target Hotspot / Object</label>
          <select class="form-input node-event-target" data-nodeid="${node.id}" style="width:100%; font-size:0.75rem;">
            ${TemplateUtils.renderList(hotspotsList, hs =>
              `<option value="${hs.id}" ${node.eventTargetId === hs.id ? 'selected' : ''}>📦 ${TemplateUtils.escapeHtml(hs.sceneName)} ➔ ${TemplateUtils.escapeHtml(hs.name)} (${hs.id})</option>`
            )}
          </select>
        </div>
      `;
    } else if (node.eventScope === 'character') {
      targetDropdownHtml = `
        <div style="margin-bottom:6px;">
          <label style="font-size:0.65rem; color:var(--text-muted);">🎭 Target Character / NPC</label>
          <select class="form-input node-event-target" data-nodeid="${node.id}" style="width:100%; font-size:0.75rem;">
            ${TemplateUtils.renderList(charactersList, ch =>
              `<option value="${ch.id}" ${node.eventTargetId === ch.id ? 'selected' : ''}>🎭 ${TemplateUtils.escapeHtml(ch.sceneName)} ➔ ${TemplateUtils.escapeHtml(ch.name)} (${ch.id})</option>`
            )}
          </select>
        </div>
      `;
    } else if (node.eventScope === 'item') {
      targetDropdownHtml = `
        <div style="margin-bottom:6px;">
          <label style="font-size:0.65rem; color:var(--text-muted);">🎒 Target Item</label>
          <select class="form-input node-event-target" data-nodeid="${node.id}" style="width:100%; font-size:0.75rem;">
            ${TemplateUtils.renderList(itemsList, it =>
              `<option value="${it.id}" ${node.eventTargetId === it.id ? 'selected' : ''}>🎁 ${TemplateUtils.escapeHtml(it.name)} (${it.id})</option>`
            )}
          </select>
        </div>
      `;
    }

    const eventList = DialogEditorUtils.getEventsForScope(node.eventScope || 'scene');
    const eventOptionsHtml = TemplateUtils.renderList(eventList, ev =>
      `<option value="${ev.id}" ${(node.eventName === ev.id || (!node.eventName && ev.id === 'enter')) ? 'selected' : ''}>${ev.label}</option>`
    );

    return TemplateUtils.populate(eventNodeCardHtml, {
      nodeId: node.id,
      posX: node.position?.x ?? 50,
      posY: node.position?.y ?? 50,
      cardBorder: isStartNode ? 'var(--accent-gold)' : '#f59e0b',
      headerColor: isStartNode ? 'var(--accent-gold)' : '#f59e0b',
      startBadgeHtml,
      startBtnHtml,
      scopeGameSelected: node.eventScope === 'game' ? 'selected' : '',
      scopeSceneSelected: (node.eventScope === 'scene' || !node.eventScope) ? 'selected' : '',
      scopeHotspotSelected: node.eventScope === 'hotspot' ? 'selected' : '',
      scopeCharacterSelected: node.eventScope === 'character' ? 'selected' : '',
      scopeItemSelected: node.eventScope === 'item' ? 'selected' : '',
      targetDropdownHtml,
      eventOptionsHtml,
      flowColor: node.nextNodeId ? '#38bdf8' : 'var(--text-muted)',
      flowLabel: node.nextNodeId ? `➔ ${node.nextNodeId}` : '(Drag Port to Target)',
    });
  }

  private static renderActionNodeCard(params: {
    node: DialogNode;
    tree: DialogTree;
    project: ProjectData | null;
  }): string {
    const { node, tree, project } = params;
    const isStartNode = node.id === tree.startNodeId;

    const startBadgeHtml = isStartNode
      ? '<span style="background:var(--accent-gold); color:#000; font-size:0.6rem; font-weight:800; padding:1px 5px; border-radius:4px;">START</span>'
      : '';

    const startBtnHtml = !isStartNode
      ? `<button class="btn btn-make-start" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;" title="Set as Start Node">🚩 Start</button>`
      : '';

    const actorsList = DialogEditorUtils.getAllProjectActors(project);
    const scenesList = DialogEditorUtils.getAllScenes(project);
    const itemsList = DialogEditorUtils.getAllItems(project);

    let actionCategoryBodyHtml = '';
    const cat = node.actionCategory || 'screen_effect';

    if (cat === 'screen_effect') {
      actionCategoryBodyHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Effect Type</label>
            <select class="form-input node-screen-fx-type" data-nodeid="${node.id}" style="font-size:0.7rem;">
              <option value="fade_in" ${(node.screenEffectType === 'fade_in' || !node.screenEffectType) ? 'selected' : ''}>Fade In (Reveal)</option>
              <option value="fade_out" ${node.screenEffectType === 'fade_out' ? 'selected' : ''}>Fade Out (To Black)</option>
              <option value="flash" ${node.screenEffectType === 'flash' ? 'selected' : ''}>Flash White</option>
              <option value="shake" ${node.screenEffectType === 'shake' ? 'selected' : ''}>Screen Shake</option>
              <option value="tint" ${node.screenEffectType === 'tint' ? 'selected' : ''}>Color Tint</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Duration (sec)</label>
            <input type="number" step="0.1" class="form-input node-screen-fx-duration" data-nodeid="${node.id}" value="${node.screenEffectDuration ?? 1.0}" style="font-size:0.7rem;" />
          </div>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:0.65rem; color:var(--text-muted);">Fade / Tint Color:</label>
          <input type="color" class="node-screen-fx-color" data-nodeid="${node.id}" value="${node.screenEffectColor || '#000000'}" style="width:36px; height:24px; border:none; cursor:pointer;" />
        </div>
      `;
    } else if (cat === 'video') {
      actionCategoryBodyHtml = `
        <div style="margin-bottom:6px;">
          <label style="font-size:0.65rem; color:var(--text-muted);">🎥 Video File (MP4/WebM)</label>
          <div style="display:flex; gap:4px; align-items:center;">
            <input type="text" class="form-input node-video-url" data-nodeid="${node.id}" value="${TemplateUtils.escapeHtml(node.videoUrl || '')}" placeholder="e.g. assets/videos/intro.mp4" style="flex:1; font-size:0.7rem;" />
            <label class="btn btn-primary" style="padding:2px 6px; cursor:pointer;" title="Choose Video File">
              📁
              <input type="file" class="node-video-file" data-nodeid="${node.id}" accept="video/*" style="display:none;" />
            </label>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="checkbox" class="node-video-skippable" data-nodeid="${node.id}" ${node.videoSkippable !== false ? 'checked' : ''} id="vid_skip_${node.id}" />
          <label for="vid_skip_${node.id}" style="font-size:0.68rem; color:var(--text-muted); cursor:pointer;">Show Skip Button (Allow Player to Skip)</label>
        </div>
      `;
    } else if (cat === 'camera') {
      actionCategoryBodyHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Camera Action</label>
            <select class="form-input node-camera-action" data-nodeid="${node.id}" style="font-size:0.7rem;">
              <option value="pan" ${node.cameraAction === 'pan' ? 'selected' : ''}>Pan to Target (X, Y)</option>
              <option value="zoom" ${node.cameraAction === 'zoom' ? 'selected' : ''}>Zoom In / Out</option>
              <option value="follow" ${node.cameraAction === 'follow' ? 'selected' : ''}>Follow Actor</option>
              <option value="shake" ${node.cameraAction === 'shake' ? 'selected' : ''}>Screen Shake</option>
              <option value="reset" ${node.cameraAction === 'reset' ? 'selected' : ''}>Reset Camera (1.0)</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.65rem; color:var(--text-muted);">Zoom Scale</label>
            <input type="number" step="0.1" class="form-input node-camera-zoom" data-nodeid="${node.id}" value="${node.cameraZoom ?? 1.5}" style="font-size:0.7rem;" />
          </div>
        </div>
        ${node.cameraAction === 'pan' ? `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <input type="number" class="form-input node-camera-x" data-nodeid="${node.id}" value="${node.targetPosition?.x ?? 500}" placeholder="Target X" style="font-size:0.7rem;" />
            <input type="number" class="form-input node-camera-y" data-nodeid="${node.id}" value="${node.targetPosition?.y ?? 500}" placeholder="Target Y" style="font-size:0.7rem;" />
          </div>
        ` : ''}
        ${node.cameraAction === 'follow' ? `
          <select class="form-input node-camera-actor" data-nodeid="${node.id}" style="width:100%; font-size:0.7rem;">
            ${TemplateUtils.renderList(actorsList, a => `<option value="${a.id}" ${node.targetActorId === a.id ? 'selected' : ''}>${TemplateUtils.escapeHtml(a.name)}</option>`)}
          </select>
        ` : ''}
      `;
    } else if (cat === 'audio') {
      actionCategoryBodyHtml = `
        <div style="margin-bottom:6px;">
          <label style="font-size:0.65rem; color:var(--text-muted);">Audio Action</label>
          <select class="form-input node-audio-action" data-nodeid="${node.id}" style="width:100%; font-size:0.7rem;">
            <option value="play_bgm" ${node.audioAction === 'play_bgm' ? 'selected' : ''}>🎵 Play Background Music</option>
            <option value="stop_bgm" ${node.audioAction === 'stop_bgm' ? 'selected' : ''}>⏹️ Stop Background Music</option>
            <option value="play_sfx" ${node.audioAction === 'play_sfx' ? 'selected' : ''}>🔊 Play Sound FX (SFX)</option>
          </select>
        </div>
        <div style="margin-bottom:6px; display:flex; gap:4px; align-items:center;">
          <input type="text" class="form-input node-audio-url" data-nodeid="${node.id}" value="${TemplateUtils.escapeHtml(node.audioUrl || '')}" placeholder="e.g. assets/audio/magic.mp3" style="flex:1; font-size:0.7rem;" />
          <label class="btn btn-primary" style="padding:2px 6px; cursor:pointer;" title="Choose Audio File">
            📁
            <input type="file" class="node-audio-file" data-nodeid="${node.id}" accept="audio/*" style="display:none;" />
          </label>
        </div>
      `;
    } else if (cat === 'delay') {
      actionCategoryBodyHtml = `
        <div>
          <label style="font-size:0.65rem; color:var(--text-muted);">Wait Duration (seconds)</label>
          <input type="number" step="0.1" class="form-input node-delay-seconds" data-nodeid="${node.id}" value="${node.waitDurationSeconds ?? 1.0}" style="width:100%; font-size:0.75rem;" />
        </div>
      `;
    } else if (cat === 'scene_change') {
      actionCategoryBodyHtml = `
        <div style="margin-bottom:6px;">
          <label style="font-size:0.65rem; color:var(--text-muted);">Target Scene</label>
          <select class="form-input node-scene-target" data-nodeid="${node.id}" style="width:100%; font-size:0.7rem;">
            ${TemplateUtils.renderList(scenesList, sc => `<option value="${sc.id}" ${node.targetSceneId === sc.id ? 'selected' : ''}>🏰 ${TemplateUtils.escapeHtml(sc.name)} (${sc.id})</option>`)}
          </select>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <input type="number" class="form-input node-scene-spawn-x" data-nodeid="${node.id}" value="${node.targetSpawnPoint?.x ?? 300}" placeholder="Spawn X" style="font-size:0.7rem;" />
          <input type="number" class="form-input node-scene-spawn-y" data-nodeid="${node.id}" value="${node.targetSpawnPoint?.y ?? 750}" placeholder="Spawn Y" style="font-size:0.7rem;" />
        </div>
      `;
    } else if (cat === 'mutation') {
      actionCategoryBodyHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
          <div>
            <label style="font-size:0.65rem; color:#22c55e;">🚩 Set Flag</label>
            <input type="text" class="form-input node-set-flag" data-nodeid="${node.id}" value="${TemplateUtils.escapeHtml(node.setFlag || '')}" placeholder="flag_name" style="font-size:0.7rem;" />
          </div>
          <div>
            <label style="font-size:0.65rem; color:#ef4444;">❌ Clear Flag</label>
            <input type="text" class="form-input node-clear-flag" data-nodeid="${node.id}" value="${TemplateUtils.escapeHtml(node.clearFlag || '')}" placeholder="flag_name" style="font-size:0.7rem;" />
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <div>
            <label style="font-size:0.65rem; color:#fbbf24;">🎁 Give Item</label>
            <select class="form-input node-give-item" data-nodeid="${node.id}" style="font-size:0.7rem;">
              <option value="">-- None --</option>
              ${TemplateUtils.renderList(itemsList, it => `<option value="${it.id}" ${node.giveItem === it.id ? 'selected' : ''}>${TemplateUtils.escapeHtml(it.name)}</option>`)}
            </select>
          </div>
          <div>
            <label style="font-size:0.65rem; color:#ef4444;">🎒 Take Item</label>
            <select class="form-input node-take-item" data-nodeid="${node.id}" style="font-size:0.7rem;">
              <option value="">-- None --</option>
              ${TemplateUtils.renderList(itemsList, it => `<option value="${it.id}" ${(node.takeItems && node.takeItems[0] === it.id) ? 'selected' : ''}>${TemplateUtils.escapeHtml(it.name)}</option>`)}
            </select>
          </div>
        </div>
      `;
    } else if (cat === 'character') {
      actionCategoryBodyHtml = `
        <div style="margin-bottom:6px;">
          <label style="font-size:0.65rem; color:var(--text-muted);">Actor</label>
          <select class="form-input node-char-actor" data-nodeid="${node.id}" style="width:100%; font-size:0.7rem;">
            ${TemplateUtils.renderList(actorsList, a => `<option value="${a.id}" ${(node.actorId === a.id || node.targetActorId === a.id) ? 'selected' : ''}>${TemplateUtils.escapeHtml(a.name)}</option>`)}
          </select>
        </div>
        <div style="margin-bottom:6px;">
          <label style="font-size:0.65rem; color:var(--text-muted);">Character Action</label>
          <select class="form-input node-char-action-type" data-nodeid="${node.id}" style="width:100%; font-size:0.7rem;">
            <option value="walk_to" ${(node.characterAction || 'walk_to') === 'walk_to' ? 'selected' : ''}>🚶 Walk To Position</option>
            <option value="teleport" ${node.characterAction === 'teleport' ? 'selected' : ''}>⚡ Teleport / Place At</option>
            <option value="look_at" ${node.characterAction === 'look_at' ? 'selected' : ''}>👀 Face / Look At</option>
            <option value="animation" ${node.characterAction === 'animation' ? 'selected' : ''}>🎬 Play Animation</option>
          </select>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr auto; gap:6px; align-items:center; margin-bottom:6px;">
          <input type="number" class="form-input node-char-x" data-nodeid="${node.id}" value="${node.targetPosition?.x ?? 500}" placeholder="X" style="font-size:0.7rem;" />
          <input type="number" class="form-input node-char-y" data-nodeid="${node.id}" value="${node.targetPosition?.y ?? 750}" placeholder="Y" style="font-size:0.7rem;" />
          <button class="btn btn-primary btn-pick-node-pos" data-nodeid="${node.id}" style="font-size:0.65rem; padding:3px 6px; white-space:nowrap;" title="Click on viewport to pick coordinates">🎯 Pick on Viewport</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; font-size:0.65rem; color:var(--text-muted);">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" class="node-char-ignore-walkpath" data-nodeid="${node.id}" ${node.ignoreWalkPath !== false ? 'checked' : ''} />
            <span>Direct walk (allow walking outside walkpath / entering viewport)</span>
          </label>
        </div>
      `;
    }

    return TemplateUtils.populate(actionNodeCardHtml, {
      nodeId: node.id,
      posX: node.position?.x ?? 50,
      posY: node.position?.y ?? 50,
      cardBorder: isStartNode ? 'var(--accent-gold)' : '#10b981',
      headerColor: isStartNode ? 'var(--accent-gold)' : '#10b981',
      startBadgeHtml,
      startBtnHtml,
      catCharacterSelected: (cat === 'character') ? 'selected' : '',
      catScreenSelected: (cat === 'screen_effect') ? 'selected' : '',
      catVideoSelected: (cat === 'video') ? 'selected' : '',
      catCameraSelected: (cat === 'camera') ? 'selected' : '',
      catAudioSelected: (cat === 'audio') ? 'selected' : '',
      catDelaySelected: (cat === 'delay') ? 'selected' : '',
      catSceneSelected: (cat === 'scene_change') ? 'selected' : '',
      catMutationSelected: (cat === 'mutation') ? 'selected' : '',
      actionCategoryBodyHtml,
      flowColor: node.nextNodeId ? '#38bdf8' : 'var(--text-muted)',
      flowLabel: node.nextNodeId ? `➔ ${node.nextNodeId}` : '(End Sequence)',
    });
  }

  private static renderStageDirectiveCard(params: {
    node: DialogNode;
    dir: any;
    dIdx: number;
    project: ProjectData | null;
  }): string {
    const { node, dir, dIdx, project } = params;
    const actorsList = DialogEditorUtils.getAllProjectActors(project);
    const actorAnims = DialogEditorUtils.getActorAnimations(project, dir.actorId || 'player');
    const allChoreoGroups = [...(project?.choreographyGroups || [])];
    const itemsList = DialogEditorUtils.getAllItems(project);

    let directiveBodyHtml = '';
    if (dir.type === 'animation') {
      directiveBodyHtml = `
        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:4px;">
          <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
            ${TemplateUtils.renderList(actorsList, a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${TemplateUtils.escapeHtml(a.name)}</option>`)}
          </select>
          <select class="form-input dir-anim-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem; color:#f59e0b; font-weight:600;">
            ${TemplateUtils.renderList(actorAnims, an => `<option value="${an}" ${dir.animationName === an ? 'selected' : ''}>${TemplateUtils.escapeHtml(an)}</option>`)}
          </select>
        </div>
        <div style="margin-top:3px; display:flex; align-items:center; gap:4px;">
          <input type="checkbox" class="dir-loop-chk" data-nodeid="${node.id}" data-didx="${dIdx}" ${dir.loopAnimation ? 'checked' : ''} id="loop_${node.id}_${dIdx}" />
          <label for="loop_${node.id}_${dIdx}" style="font-size:0.65rem; color:var(--text-muted); cursor:pointer;">Loop Animation</label>
        </div>
      `;
    } else if (dir.type === 'choreography_group') {
      directiveBodyHtml = `
        <select class="form-input dir-choreo-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="width:100%; font-size:0.7rem;">
          <option value="">-- Select Choreography Group --</option>
          ${TemplateUtils.renderList(allChoreoGroups, cg => `<option value="${cg.id}" ${dir.choreographyGroupId === cg.id ? 'selected' : ''}>👥 ${TemplateUtils.escapeHtml(cg.name)}</option>`)}
        </select>
      `;
    } else if (dir.type === 'give_item' || dir.type === 'take_item') {
      directiveBodyHtml = `
        <select class="form-input dir-item-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="width:100%; font-size:0.7rem;">
          <option value="">-- Select Item --</option>
          ${TemplateUtils.renderList(itemsList, it => `<option value="${it.id}" ${dir.itemId === it.id ? 'selected' : ''}>🎁 ${TemplateUtils.escapeHtml(it.name)} (${it.id})</option>`)}
        </select>
      `;
    } else if (dir.type === 'emote') {
      directiveBodyHtml = `
        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:4px;">
          <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
            ${TemplateUtils.renderList(actorsList, a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${TemplateUtils.escapeHtml(a.name)}</option>`)}
          </select>
          <input type="text" class="form-input dir-emote-text" data-nodeid="${node.id}" data-didx="${dIdx}" value="${TemplateUtils.escapeHtml(dir.emoteText || '')}" placeholder="e.g. ❗ 'Look!'" style="font-size:0.7rem;" />
        </div>
      `;
    } else if (dir.type === 'look_at') {
      directiveBodyHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
          <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
            ${TemplateUtils.renderList(actorsList, a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${TemplateUtils.escapeHtml(a.name)}</option>`)}
          </select>
          <select class="form-input dir-target-actor" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
            <option value="">-- Face Target --</option>
            ${TemplateUtils.renderList(actorsList, a => `<option value="${a.id}" ${dir.targetActorId === a.id ? 'selected' : ''}>${TemplateUtils.escapeHtml(a.name)}</option>`)}
          </select>
        </div>
      `;
    } else if (dir.type === 'walk_to') {
      directiveBodyHtml = `
        <div style="display:grid; grid-template-columns:1.2fr 0.9fr 0.9fr auto; gap:4px; align-items:center;">
          <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
            ${TemplateUtils.renderList(actorsList, a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${TemplateUtils.escapeHtml(a.name)}</option>`)}
          </select>
          <input type="number" class="form-input dir-walk-x" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.targetPosition?.x ?? 500}" placeholder="X" style="font-size:0.7rem;" />
          <input type="number" class="form-input dir-walk-y" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.targetPosition?.y ?? 700}" placeholder="Y" style="font-size:0.7rem;" />
          <button class="btn btn-primary btn-pick-dir-pos" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.6rem; padding:2px 5px; white-space:nowrap;" title="Click on viewport to pick coordinates">🎯 Pick</button>
        </div>
        <div style="display:flex; align-items:center; gap:4px; margin-top:4px; font-size:0.6rem; color:var(--text-muted);">
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
            <input type="checkbox" class="dir-walk-ignore-walkpath" data-nodeid="${node.id}" data-didx="${dIdx}" ${dir.ignoreWalkPath ? 'checked' : ''} />
            <span>Direct walk (ignore walkpath / enter viewport)</span>
          </label>
        </div>
      `;
    } else if (dir.type === 'sfx') {
      directiveBodyHtml = `
        <div style="display:flex; gap:4px; align-items:center;">
          <input type="text" class="form-input dir-sfx-url" data-nodeid="${node.id}" data-didx="${dIdx}" value="${TemplateUtils.escapeHtml(dir.sfxUrl || '')}" placeholder="e.g. assets/audio/magic_cast.mp3" style="flex:1; font-size:0.7rem;" />
          <label class="btn btn-primary" style="padding:2px 6px; cursor:pointer;" title="Choose SFX File">
            📁
            <input type="file" class="dir-sfx-file" data-nodeid="${node.id}" data-didx="${dIdx}" accept="audio/*" style="display:none;" />
          </label>
        </div>
      `;
    } else if (dir.type === 'camera') {
      directiveBodyHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
          <select class="form-input dir-camera-action" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
            <option value="zoom" ${dir.cameraAction === 'zoom' ? 'selected' : ''}>Zoom In</option>
            <option value="shake" ${dir.cameraAction === 'shake' ? 'selected' : ''}>Shake Screen</option>
            <option value="reset" ${dir.cameraAction === 'reset' ? 'selected' : ''}>Reset Zoom (1.0)</option>
          </select>
          <input type="number" step="0.1" class="form-input dir-camera-zoom" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.cameraZoom ?? 1.3}" placeholder="Zoom Scale" style="font-size:0.7rem;" />
        </div>
      `;
    } else if (dir.type === 'custom_event') {
      directiveBodyHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
          <input type="text" class="form-input dir-event-name" data-nodeid="${node.id}" data-didx="${dIdx}" value="${TemplateUtils.escapeHtml(dir.eventName || '')}" placeholder="Event Name" style="font-size:0.7rem;" />
          <input type="text" class="form-input dir-event-payload" data-nodeid="${node.id}" data-didx="${dIdx}" value="${TemplateUtils.escapeHtml(dir.eventPayload || '')}" placeholder="Payload" style="font-size:0.7rem;" />
        </div>
      `;
    }

    return TemplateUtils.populate(stageDirectiveCardHtml, {
      nodeId: node.id,
      dIdx,
      typeAnimSelected: dir.type === 'animation' ? 'selected' : '',
      typeChoreoSelected: dir.type === 'choreography_group' ? 'selected' : '',
      typeGiveSelected: dir.type === 'give_item' ? 'selected' : '',
      typeTakeSelected: dir.type === 'take_item' ? 'selected' : '',
      typeEmoteSelected: dir.type === 'emote' ? 'selected' : '',
      typeLookAtSelected: dir.type === 'look_at' ? 'selected' : '',
      typeWalkToSelected: dir.type === 'walk_to' ? 'selected' : '',
      typeSfxSelected: dir.type === 'sfx' ? 'selected' : '',
      typeCameraSelected: dir.type === 'camera' ? 'selected' : '',
      typeEventSelected: dir.type === 'custom_event' ? 'selected' : '',
      delaySeconds: dir.delaySeconds ?? 0,
      directiveBodyHtml,
    });
  }

  private static renderChoiceCard(params: {
    node: DialogNode;
    choice: any;
    cIdx: number;
  }): string {
    const { node, choice: c, cIdx } = params;
    const conditionPickerHtml = this.renderConditionPicker({
      nodeId: node.id,
      choiceIdx: cIdx,
      requiredFlag: c.requiredFlag,
      notFlag: c.notFlag,
      allowFallback: false,
    });

    return TemplateUtils.populate(choiceCardHtml, {
      nodeId: node.id,
      cIdx,
      text: TemplateUtils.escapeHtml(c.text || ''),
      conditionPickerHtml,
      voiceAudioUrl: TemplateUtils.escapeHtml(c.voiceAudioUrl || ''),
    });
  }

  private static renderRouterBranchCard(params: {
    node: DialogNode;
    choice: any;
    cIdx: number;
  }): string {
    const { node, choice: c, cIdx } = params;
    const isFallback = c.requiredFlag === undefined && c.notFlag === undefined;
    const isDraggable = !isFallback;

    const conditionPickerHtml = this.renderConditionPicker({
      nodeId: node.id,
      choiceIdx: cIdx,
      requiredFlag: c.requiredFlag,
      notFlag: c.notFlag,
      allowFallback: true,
    });

    return TemplateUtils.populate(routerBranchCardHtml, {
      nodeId: node.id,
      cIdx,
      isDraggable: isDraggable ? 'true' : 'false',
      cursorStyle: isDraggable ? 'grab' : 'default',
      handleCursor: isDraggable ? 'grab' : 'not-allowed',
      handleColor: isDraggable ? '#c084fc' : '#64748b',
      handleTitle: isDraggable ? 'Drag & drop to re-order rule' : 'Fallback rule is pinned at the bottom',
      conditionPickerHtml,
    });
  }
}
