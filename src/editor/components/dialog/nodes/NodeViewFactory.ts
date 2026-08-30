import { DialogTree, DialogNode, ProjectData, DirectiveActionType } from '../../../../engine/types';
import { resolvePickedAssetPath } from '../../../utils/AssetPathUtils';
import { DialogEditorUtils } from '../DialogEditorUtils';

export class NodeViewFactory {
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

    return `
      <div class="unified-condition-box" style="display:flex; gap:5px; align-items:center; background:rgba(0,0,0,0.25); padding:3px 6px; border-radius:5px; border:1px solid rgba(255,255,255,0.06); margin-bottom:4px;">
        <span style="font-size:0.65rem; color:var(--accent-gold); font-weight:700;">Condition:</span>
        <span style="font-size:0.65rem; color:var(--text-muted);">If</span>
        <input type="text" 
               class="form-input ${nameClass}" 
               data-nodeid="${nodeId}" 
               ${cidxAttr} 
               value="${currentFlag}" 
               placeholder="flagName" 
               style="flex:1; font-size:0.7rem; font-weight:600; color:#38bdf8; ${isAlwaysOrFallback ? 'opacity:0.35;' : ''}" 
               ${isAlwaysOrFallback ? 'disabled' : ''} />
        <span style="font-size:0.65rem; color:var(--text-muted);">is</span>
        <select class="form-input ${opClass}" 
                data-nodeid="${nodeId}" 
                ${cidxAttr} 
                style="width:115px; font-size:0.65rem; font-weight:700; color:${currentOp === 'false' ? '#ef4444' : (currentOp === 'true' ? '#22c55e' : (currentOp === 'fallback' ? '#f59e0b' : '#94a3b8'))};">
          ${allowFallback ? `
            <option value="true" ${currentOp === 'true' ? 'selected' : ''}>✅ TRUE</option>
            <option value="false" ${currentOp === 'false' ? 'selected' : ''}>❌ FALSE</option>
            <option value="fallback" ${currentOp === 'fallback' ? 'selected' : ''}>⚡ Else (Fallback)</option>
          ` : `
            <option value="always" ${currentOp === 'always' ? 'selected' : ''}>⚡ Always</option>
            <option value="true" ${currentOp === 'true' ? 'selected' : ''}>✅ TRUE</option>
            <option value="false" ${currentOp === 'false' ? 'selected' : ''}>❌ FALSE</option>
          `}
        </select>
      </div>
    `;
  }

  public static renderNodeCard(params: {
    node: DialogNode;
    tree: DialogTree;
    project: ProjectData | null;
  }): string {
    const { node, tree, project } = params;
    const isStartNode = node.id === tree.startNodeId;
    const rawType = node.nodeType || (node.isRouterNode ? 'router' : 'beat');
    const nodeType: 'beat' | 'router' | 'event_listener' | 'action' = rawType;
    const isRouter = nodeType === 'router';
    const isEvent = nodeType === 'event_listener';
    const isAction = nodeType === 'action';
    const isBeat = nodeType === 'beat';

    const choiceCount = node.choices?.length || 0;
    const hasMultipleOutgoing = choiceCount > 1;
    const isInteractive = node.isChoiceInteractive !== false;
    const directives = node.directives || [];

    const actorsList = DialogEditorUtils.getAllProjectActors(project);
    const scenesList = DialogEditorUtils.getAllScenes(project);
    const hotspotsList = DialogEditorUtils.getAllHotspots(project);
    const charactersList = DialogEditorUtils.getAllCharacters(project);
    const itemsList = DialogEditorUtils.getAllItems(project);
    const allChoreoGroups = [...(project?.choreographyGroups || [])];

    let cardBg = 'rgba(30,41,59,0.96)';
    let cardBorder = isStartNode ? 'var(--accent-gold)' : 'var(--panel-border)';
    let portInColor = '#38bdf8';
    let headerColor = '#38bdf8';
    let typeBadge = '🎬 BEAT:';

    if (isRouter) {
      cardBg = 'linear-gradient(135deg, rgba(76,29,149,0.95), rgba(30,41,59,0.96))';
      cardBorder = '#c084fc';
      portInColor = '#c084fc';
      headerColor = '#c084fc';
      typeBadge = '🔀 ROUTER:';
    } else if (isEvent) {
      cardBg = 'linear-gradient(135deg, rgba(120,53,15,0.95), rgba(30,41,59,0.96))';
      cardBorder = '#f59e0b';
      portInColor = '#f59e0b';
      headerColor = '#f59e0b';
      typeBadge = '⚡ EVENT:';
    } else if (isAction) {
      cardBg = 'linear-gradient(135deg, rgba(6,78,59,0.95), rgba(30,41,59,0.96))';
      cardBorder = '#10b981';
      portInColor = '#10b981';
      headerColor = '#10b981';
      typeBadge = '✨ ACTION:';
    }

    return `
      <div class="dialog-graph-card" data-nodeid="${node.id}" style="position:absolute; left:${node.position?.x ?? 50}px; top:${node.position?.y ?? 50}px; width:380px; background:${cardBg}; border:1px solid ${cardBorder}; border-radius:10px; padding:12px; box-shadow:0 8px 24px rgba(0,0,0,0.5); font-size:0.8rem; pointer-events:auto;">
        
        <!-- Left Input Port -->
        <div class="node-port node-port-in" data-nodeid="${node.id}" style="position:absolute; left:-9px; top:18px; width:18px; height:18px; border-radius:50%; background:${portInColor}; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px ${portInColor}aa; z-index:10;" title="Input Port: Drag an arrow from another node's output port to connect here"></div>

        <!-- Header -->
        <div class="node-drag-handle" data-nodeid="${node.id}" style="display:flex; justify-content:space-between; align-items:center; cursor:move; padding-bottom:8px; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1);">
          <div style="display:flex; gap:6px; align-items:center;">
            <span style="font-weight:700; color:${isStartNode ? 'var(--accent-gold)' : headerColor};">${typeBadge} ${node.id}</span>
            ${isStartNode ? '<span style="background:var(--accent-gold); color:#000; font-size:0.6rem; font-weight:800; padding:1px 5px; border-radius:4px;">START</span>' : ''}
          </div>
          <div style="display:flex; gap:4px; align-items:center;">
            <select class="form-input node-type-select" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 4px; font-weight:700; background:rgba(0,0,0,0.5);">
              <option value="beat" ${nodeType === 'beat' ? 'selected' : ''}>🎬 Beat</option>
              <option value="router" ${nodeType === 'router' ? 'selected' : ''}>🔀 Router</option>
              <option value="event_listener" ${nodeType === 'event_listener' ? 'selected' : ''}>⚡ Event</option>
              <option value="action" ${nodeType === 'action' ? 'selected' : ''}>✨ Action</option>
            </select>
            ${!isStartNode ? `<button class="btn btn-make-start" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;" title="Set as Start Node">🚩 Start</button>` : ''}
            <button class="btn btn-del-node" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px; color:#ef4444;" title="Delete Node">✕</button>
          </div>
        </div>

        <!-- ⚡ EVENT TRIGGER NODE BODY -->
        ${isEvent ? `
          <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(245,158,11,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
            <div style="margin-bottom:6px;">
              <label style="font-size:0.65rem; color:#f59e0b; font-weight:700;">🎯 Target Object Scope</label>
              <select class="form-input node-event-scope" data-nodeid="${node.id}" style="width:100%; font-size:0.75rem; font-weight:600; color:#f59e0b;">
                <option value="game" ${node.eventScope === 'game' ? 'selected' : ''}>🎮 Entire Game / Global</option>
                <option value="scene" ${(node.eventScope === 'scene' || !node.eventScope) ? 'selected' : ''}>🌄 Scene</option>
                <option value="hotspot" ${node.eventScope === 'hotspot' ? 'selected' : ''}>📦 Hotspot / Object</option>
                <option value="character" ${node.eventScope === 'character' ? 'selected' : ''}>🎭 Character / NPC</option>
                <option value="item" ${node.eventScope === 'item' ? 'selected' : ''}>🎒 Inventory Item</option>
              </select>
            </div>

            ${(node.eventScope === 'scene' || !node.eventScope) ? `
              <div style="margin-bottom:6px;">
                <label style="font-size:0.65rem; color:var(--text-muted);">🌄 Target Scene</label>
                <select class="form-input node-event-target" data-nodeid="${node.id}" style="width:100%; font-size:0.75rem;">
                  ${scenesList.map(sc => `<option value="${sc.id}" ${(node.eventTargetId === sc.id || (!node.eventTargetId && sc === scenesList[0])) ? 'selected' : ''}>🏰 ${sc.name} (${sc.id})</option>`).join('')}
                </select>
              </div>
            ` : ''}

            ${node.eventScope === 'hotspot' ? `
              <div style="margin-bottom:6px;">
                <label style="font-size:0.65rem; color:var(--text-muted);">📦 Target Hotspot / Object</label>
                <select class="form-input node-event-target" data-nodeid="${node.id}" style="width:100%; font-size:0.75rem;">
                  ${hotspotsList.map(hs => `<option value="${hs.id}" ${node.eventTargetId === hs.id ? 'selected' : ''}>📦 ${hs.sceneName} ➔ ${hs.name} (${hs.id})</option>`).join('')}
                </select>
              </div>
            ` : ''}

            ${node.eventScope === 'character' ? `
              <div style="margin-bottom:6px;">
                <label style="font-size:0.65rem; color:var(--text-muted);">🎭 Target Character / NPC</label>
                <select class="form-input node-event-target" data-nodeid="${node.id}" style="width:100%; font-size:0.75rem;">
                  ${charactersList.map(ch => `<option value="${ch.id}" ${node.eventTargetId === ch.id ? 'selected' : ''}>🎭 ${ch.sceneName} ➔ ${ch.name} (${ch.id})</option>`).join('')}
                </select>
              </div>
            ` : ''}

            ${node.eventScope === 'item' ? `
              <div style="margin-bottom:6px;">
                <label style="font-size:0.65rem; color:var(--text-muted);">🎒 Target Item</label>
                <select class="form-input node-event-target" data-nodeid="${node.id}" style="width:100%; font-size:0.75rem;">
                  ${itemsList.map(it => `<option value="${it.id}" ${node.eventTargetId === it.id ? 'selected' : ''}>🎁 ${it.name} (${it.id})</option>`).join('')}
                </select>
              </div>
            ` : ''}

            <div>
              <label style="font-size:0.65rem; color:#f59e0b; font-weight:700;">⚡ Event Trigger</label>
              <select class="form-input node-event-name" data-nodeid="${node.id}" style="width:100%; font-size:0.75rem; font-weight:700; color:#38bdf8;">
                ${DialogEditorUtils.getEventsForScope(node.eventScope || 'scene').map(ev => `<option value="${ev.id}" ${(node.eventName === ev.id || (!node.eventName && ev.id === 'enter')) ? 'selected' : ''}>${ev.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:6px; border:1px solid rgba(245,158,11,0.2); position:relative;">
            <span style="font-size:0.7rem; color:#f59e0b; font-weight:700;">⚡ Trigger Flow:</span>
            <span style="font-size:0.72rem; color:${node.nextNodeId ? '#38bdf8' : 'var(--text-muted)'}; font-weight:700;">
              ${node.nextNodeId ? `➔ ${node.nextNodeId}` : '(Drag Port to Target)'}
            </span>
            <div class="node-port node-port-out" data-nodeid="${node.id}" style="position:absolute; right:-15px; top:50%; transform:translateY(-50%); width:18px; height:18px; border-radius:50%; background:#f59e0b; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(245,158,11,0.9); z-index:10;" title="⚡ Trigger Port: Drag arrow to connect to target node"></div>
          </div>
        ` : ''}

        <!-- ✨ ACTION / CINEMATIC FX NODE BODY -->
        ${isAction ? `
          <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(16,185,129,0.25); border-radius:6px; padding:8px; margin-bottom:8px;">
            <div style="margin-bottom:6px;">
              <label style="font-size:0.65rem; color:#10b981; font-weight:700;">🎬 Action / FX Type</label>
              <select class="form-input node-action-category" data-nodeid="${node.id}" style="width:100%; font-size:0.75rem; font-weight:700; color:#10b981;">
                <option value="screen_effect" ${(node.actionCategory === 'screen_effect' || !node.actionCategory) ? 'selected' : ''}>✨ Screen Effect / Fade</option>
                <option value="video" ${node.actionCategory === 'video' ? 'selected' : ''}>🎥 Video Cutscene</option>
                <option value="camera" ${node.actionCategory === 'camera' ? 'selected' : ''}>🎬 Camera Action</option>
                <option value="audio" ${node.actionCategory === 'audio' ? 'selected' : ''}>🎵 Audio / Music Cue</option>
                <option value="delay" ${node.actionCategory === 'delay' ? 'selected' : ''}>⏳ Timed Delay / Wait</option>
                <option value="scene_change" ${node.actionCategory === 'scene_change' ? 'selected' : ''}>🏰 Scene Transition</option>
                <option value="mutation" ${node.actionCategory === 'mutation' ? 'selected' : ''}>📦 Inventory & State Mutation</option>
              </select>
            </div>

            ${(node.actionCategory === 'screen_effect' || !node.actionCategory) ? `
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
            ` : ''}

            ${node.actionCategory === 'video' ? `
              <div style="margin-bottom:6px;">
                <label style="font-size:0.65rem; color:var(--text-muted);">🎥 Video File (MP4/WebM)</label>
                <div style="display:flex; gap:4px; align-items:center;">
                  <input type="text" class="form-input node-video-url" data-nodeid="${node.id}" value="${node.videoUrl || ''}" placeholder="e.g. assets/videos/intro.mp4" style="flex:1; font-size:0.7rem;" />
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
            ` : ''}

            ${node.actionCategory === 'camera' ? `
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
                  ${actorsList.map(a => `<option value="${a.id}" ${node.targetActorId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                </select>
              ` : ''}
            ` : ''}

            ${node.actionCategory === 'audio' ? `
              <div style="margin-bottom:6px;">
                <label style="font-size:0.65rem; color:var(--text-muted);">Audio Action</label>
                <select class="form-input node-audio-action" data-nodeid="${node.id}" style="width:100%; font-size:0.7rem;">
                  <option value="play_bgm" ${node.audioAction === 'play_bgm' ? 'selected' : ''}>🎵 Play Background Music</option>
                  <option value="stop_bgm" ${node.audioAction === 'stop_bgm' ? 'selected' : ''}>⏹️ Stop Background Music</option>
                  <option value="play_sfx" ${node.audioAction === 'play_sfx' ? 'selected' : ''}>🔊 Play Sound FX (SFX)</option>
                </select>
              </div>
              <div style="margin-bottom:6px; display:flex; gap:4px; align-items:center;">
                <input type="text" class="form-input node-audio-url" data-nodeid="${node.id}" value="${node.audioUrl || ''}" placeholder="e.g. assets/audio/magic.mp3" style="flex:1; font-size:0.7rem;" />
                <label class="btn btn-primary" style="padding:2px 6px; cursor:pointer;" title="Choose Audio File">
                  📁
                  <input type="file" class="node-audio-file" data-nodeid="${node.id}" accept="audio/*" style="display:none;" />
                </label>
              </div>
            ` : ''}

            ${node.actionCategory === 'delay' ? `
              <div>
                <label style="font-size:0.65rem; color:var(--text-muted);">Wait Duration (seconds)</label>
                <input type="number" step="0.1" class="form-input node-delay-seconds" data-nodeid="${node.id}" value="${node.waitDurationSeconds ?? 1.0}" style="width:100%; font-size:0.75rem;" />
              </div>
            ` : ''}

            ${node.actionCategory === 'scene_change' ? `
              <div style="margin-bottom:6px;">
                <label style="font-size:0.65rem; color:var(--text-muted);">Target Scene</label>
                <select class="form-input node-scene-target" data-nodeid="${node.id}" style="width:100%; font-size:0.7rem;">
                  ${scenesList.map(sc => `<option value="${sc.id}" ${node.targetSceneId === sc.id ? 'selected' : ''}>🏰 ${sc.name} (${sc.id})</option>`).join('')}
                </select>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <input type="number" class="form-input node-scene-spawn-x" data-nodeid="${node.id}" value="${node.targetSpawnPoint?.x ?? 300}" placeholder="Spawn X" style="font-size:0.7rem;" />
                <input type="number" class="form-input node-scene-spawn-y" data-nodeid="${node.id}" value="${node.targetSpawnPoint?.y ?? 750}" placeholder="Spawn Y" style="font-size:0.7rem;" />
              </div>
            ` : ''}

            ${node.actionCategory === 'mutation' ? `
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
                <div>
                  <label style="font-size:0.65rem; color:#22c55e;">🚩 Set Flag</label>
                  <input type="text" class="form-input node-set-flag" data-nodeid="${node.id}" value="${node.setFlag || ''}" placeholder="flag_name" style="font-size:0.7rem;" />
                </div>
                <div>
                  <label style="font-size:0.65rem; color:#ef4444;">❌ Clear Flag</label>
                  <input type="text" class="form-input node-clear-flag" data-nodeid="${node.id}" value="${node.clearFlag || ''}" placeholder="flag_name" style="font-size:0.7rem;" />
                </div>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <div>
                  <label style="font-size:0.65rem; color:#fbbf24;">🎁 Give Item</label>
                  <select class="form-input node-give-item" data-nodeid="${node.id}" style="font-size:0.7rem;">
                    <option value="">-- None --</option>
                    ${itemsList.map(it => `<option value="${it.id}" ${node.giveItem === it.id ? 'selected' : ''}>${it.name}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="font-size:0.65rem; color:#ef4444;">🎒 Take Item</label>
                  <select class="form-input node-take-item" data-nodeid="${node.id}" style="font-size:0.7rem;">
                    <option value="">-- None --</option>
                    ${itemsList.map(it => `<option value="${it.id}" ${(node.takeItems && node.takeItems[0] === it.id) ? 'selected' : ''}>${it.name}</option>`).join('')}
                  </select>
                </div>
              </div>
            ` : ''}
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:6px; border:1px solid rgba(16,185,129,0.2); position:relative;">
            <span style="font-size:0.7rem; color:#10b981; font-weight:700;">▶ On Complete:</span>
            <span style="font-size:0.72rem; color:${node.nextNodeId ? '#38bdf8' : 'var(--text-muted)'}; font-weight:700;">
              ${node.nextNodeId ? `➔ ${node.nextNodeId}` : '(End Sequence)'}
            </span>
            <div class="node-port node-port-out" data-nodeid="${node.id}" style="position:absolute; right:-15px; top:50%; transform:translateY(-50%); width:18px; height:18px; border-radius:50%; background:#10b981; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(16,185,129,0.9); z-index:10;" title="▶ On Complete: Drag arrow to connect to target node"></div>
          </div>
        ` : ''}

        <!-- 🎬 BEAT / DIALOGUE NODE BODY -->
        ${isBeat ? `
          <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:8px; margin-bottom:8px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px; position:relative;">
              <div>
                <label style="font-size:0.65rem; color:var(--text-muted);">🗣️ Speaker Name</label>
                <input type="text" class="form-input node-speaker" data-nodeid="${node.id}" value="${node.speaker || ''}" placeholder="e.g. Hero, Guard, Merchant" style="width:100%; font-weight:600; font-size:0.75rem;" />
              </div>
              <div>
                <label style="font-size:0.65rem; color:#f59e0b;">🎭 Speaker Talk Anim</label>
                <input type="text" class="form-input node-speaker-anim" data-nodeid="${node.id}" value="${node.speakerAnimation || ''}" placeholder="e.g. talk, gesture" style="width:100%; font-size:0.75rem;" />
              </div>
            </div>

            <div style="margin-bottom:6px;">
              <label style="font-size:0.65rem; color:var(--text-muted);">💬 Spoken Dialogue Text</label>
              <textarea class="form-input node-text" data-nodeid="${node.id}" style="width:100%; height:44px; font-size:0.8rem;">${node.text || ''}</textarea>
            </div>

            <!-- Voiceover Audio URL -->
            <div>
              <label style="font-size:0.65rem; color:var(--text-muted);">🎙️ Voiceover Audio File (URL)</label>
              <div style="display:flex; gap:6px; align-items:center;">
                <input type="text" class="form-input node-voice-url" data-nodeid="${node.id}" value="${node.voiceAudioUrl || ''}" placeholder="e.g. assets/audio/dialog_line_1.mp3" style="flex:1; font-size:0.75rem;" />
                <label class="btn btn-primary" style="padding:4px 8px; cursor:pointer;" title="Choose Audio File">
                  📁
                  <input type="file" class="node-voice-file" data-nodeid="${node.id}" accept="audio/*" style="display:none;" />
                </label>
              </div>
            </div>
          </div>

          <!-- 🎭 STAGE DIRECTIVES (Multi-Actor Choreography) -->
          <div style="background:rgba(245, 158, 11, 0.05); border:1px solid rgba(245, 158, 11, 0.2); border-radius:6px; padding:8px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:0.7rem; font-weight:700; color:#f59e0b;">🎭 STAGE DIRECTIVES (${directives.length})</span>
              <button class="btn btn-primary btn-add-directive" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;">+ Add Directive</button>
            </div>

            ${directives.length === 0 ? `
              <div style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">No background character or camera choreography. Click "+ Add Directive".</div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${directives.map((dir, dIdx) => {
                  const actorAnims = DialogEditorUtils.getActorAnimations(project, dir.actorId || 'player');
                  return `
                    <div class="stage-directive-card" data-nodeid="${node.id}" data-didx="${dIdx}" draggable="true" style="position:relative; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); padding:6px; border-radius:6px; cursor:grab;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <div style="display:flex; gap:4px; align-items:center;">
                          <span class="choice-drag-handle" style="cursor:grab; color:var(--text-muted); font-size:0.85rem; font-weight:800; user-select:none; padding-right:2px;" title="Drag & drop to re-order directive">⠿</span>
                          <select class="form-input dir-type-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem; font-weight:700; color:#38bdf8; padding:2px 4px;">
                            <option value="animation" ${dir.type === 'animation' ? 'selected' : ''}>🎬 Actor Animation</option>
                            <option value="choreography_group" ${dir.type === 'choreography_group' ? 'selected' : ''}>👥 Choreography Group</option>
                            <option value="give_item" ${dir.type === 'give_item' ? 'selected' : ''}>🎁 Give Item</option>
                            <option value="take_item" ${dir.type === 'take_item' ? 'selected' : ''}>🎒 Take Item</option>
                            <option value="emote" ${dir.type === 'emote' ? 'selected' : ''}>💬 Emote Bubble</option>
                            <option value="look_at" ${dir.type === 'look_at' ? 'selected' : ''}>👀 Face / Turn To</option>
                            <option value="walk_to" ${dir.type === 'walk_to' ? 'selected' : ''}>🚶 Walk To</option>
                            <option value="sfx" ${dir.type === 'sfx' ? 'selected' : ''}>🔊 Audio SFX</option>
                            <option value="camera" ${dir.type === 'camera' ? 'selected' : ''}>🎥 Camera Action</option>
                            <option value="custom_event" ${dir.type === 'custom_event' ? 'selected' : ''}>⚡ Custom Event</option>
                          </select>
                        </div>
                        <div style="display:flex; align-items:center; gap:4px;">
                          <span style="font-size:0.6rem; color:var(--text-muted);">⏱️ Delay:</span>
                          <input type="number" step="0.1" class="form-input dir-delay-input" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.delaySeconds ?? 0}" style="width:44px; font-size:0.65rem; padding:1px 3px;" title="Delay offset in seconds" />
                          <button class="btn btn-del-directive" data-nodeid="${node.id}" data-didx="${dIdx}" style="padding:1px 4px; font-size:0.6rem; color:#ef4444;" title="Delete Directive">✕</button>
                        </div>
                      </div>

                      <!-- Dynamic fields based on directive type -->
                      ${dir.type === 'animation' ? `
                        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:4px;">
                          <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                            ${actorsList.map(a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                          </select>
                          <select class="form-input dir-anim-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem; color:#f59e0b; font-weight:600;">
                            ${actorAnims.map(an => `<option value="${an}" ${dir.animationName === an ? 'selected' : ''}>${an}</option>`).join('')}
                          </select>
                        </div>
                        <div style="margin-top:3px; display:flex; align-items:center; gap:4px;">
                          <input type="checkbox" class="dir-loop-chk" data-nodeid="${node.id}" data-didx="${dIdx}" ${dir.loopAnimation ? 'checked' : ''} id="loop_${node.id}_${dIdx}" />
                          <label for="loop_${node.id}_${dIdx}" style="font-size:0.65rem; color:var(--text-muted); cursor:pointer;">Loop Animation</label>
                        </div>
                      ` : ''}

                      ${dir.type === 'choreography_group' ? `
                        <select class="form-input dir-choreo-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="width:100%; font-size:0.7rem;">
                          <option value="">-- Select Choreography Group --</option>
                          ${allChoreoGroups.map(cg => `<option value="${cg.id}" ${dir.choreographyGroupId === cg.id ? 'selected' : ''}>👥 ${cg.name}</option>`).join('')}
                        </select>
                      ` : ''}

                      ${(dir.type === 'give_item' || dir.type === 'take_item') ? `
                        <select class="form-input dir-item-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="width:100%; font-size:0.7rem;">
                          <option value="">-- Select Item --</option>
                          ${itemsList.map(it => `<option value="${it.id}" ${dir.itemId === it.id ? 'selected' : ''}>🎁 ${it.name} (${it.id})</option>`).join('')}
                        </select>
                      ` : ''}

                      ${dir.type === 'emote' ? `
                        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:4px;">
                          <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                            ${actorsList.map(a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                          </select>
                          <input type="text" class="form-input dir-emote-text" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.emoteText || ''}" placeholder="e.g. ❗ 'Look!'" style="font-size:0.7rem;" />
                        </div>
                      ` : ''}

                      ${dir.type === 'look_at' ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                          <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                            ${actorsList.map(a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                          </select>
                          <select class="form-input dir-target-actor" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                            <option value="">-- Face Target --</option>
                            ${actorsList.map(a => `<option value="${a.id}" ${dir.targetActorId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                          </select>
                        </div>
                      ` : ''}

                      ${dir.type === 'walk_to' ? `
                        <div style="display:grid; grid-template-columns:1.2fr 1fr 1fr; gap:4px;">
                          <select class="form-input dir-actor-select" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                            ${actorsList.map(a => `<option value="${a.id}" ${dir.actorId === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                          </select>
                          <input type="number" class="form-input dir-walk-x" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.targetPosition?.x ?? 500}" placeholder="X" style="font-size:0.7rem;" />
                          <input type="number" class="form-input dir-walk-y" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.targetPosition?.y ?? 700}" placeholder="Y" style="font-size:0.7rem;" />
                        </div>
                      ` : ''}

                      ${dir.type === 'sfx' ? `
                        <div style="display:flex; gap:4px; align-items:center;">
                          <input type="text" class="form-input dir-sfx-url" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.sfxUrl || ''}" placeholder="e.g. assets/audio/magic_cast.mp3" style="flex:1; font-size:0.7rem;" />
                          <label class="btn btn-primary" style="padding:2px 6px; cursor:pointer;" title="Choose SFX File">
                            📁
                            <input type="file" class="dir-sfx-file" data-nodeid="${node.id}" data-didx="${dIdx}" accept="audio/*" style="display:none;" />
                          </label>
                        </div>
                      ` : ''}

                      ${dir.type === 'camera' ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                          <select class="form-input dir-camera-action" data-nodeid="${node.id}" data-didx="${dIdx}" style="font-size:0.7rem;">
                            <option value="zoom" ${dir.cameraAction === 'zoom' ? 'selected' : ''}>Zoom In</option>
                            <option value="shake" ${dir.cameraAction === 'shake' ? 'selected' : ''}>Shake Screen</option>
                            <option value="reset" ${dir.cameraAction === 'reset' ? 'selected' : ''}>Reset Zoom (1.0)</option>
                          </select>
                          <input type="number" step="0.1" class="form-input dir-camera-zoom" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.cameraZoom ?? 1.3}" placeholder="Zoom Scale" style="font-size:0.7rem;" />
                        </div>
                      ` : ''}

                      ${dir.type === 'custom_event' ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                          <input type="text" class="form-input dir-event-name" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.eventName || ''}" placeholder="Event Name" style="font-size:0.7rem;" />
                          <input type="text" class="form-input dir-event-payload" data-nodeid="${node.id}" data-didx="${dIdx}" value="${dir.eventPayload || ''}" placeholder="Payload" style="font-size:0.7rem;" />
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Condition Section (Beats Only) -->
          ${NodeViewFactory.renderConditionPicker({ nodeId: node.id, requiredFlag: node.requiredFlag, notFlag: node.notFlag })}

          <!-- Interactivity Checkbox -->
          ${hasMultipleOutgoing ? `
            <div style="background:rgba(251, 191, 36, 0.1); border:1px solid rgba(251, 191, 36, 0.3); border-radius:6px; padding:6px; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
              <input type="checkbox" class="node-interactive-chk" data-nodeid="${node.id}" ${isInteractive ? 'checked' : ''} id="chk_inter_${node.id}" />
              <label for="chk_inter_${node.id}" style="font-size:0.7rem; color:var(--accent-gold); font-weight:700; cursor:pointer;">
                ☑️ Interactive Player Selection Box
              </label>
            </div>
          ` : ''}

          <!-- Outgoing Choices / Responses -->
          <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:6px; margin-top:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:0.7rem; font-weight:700; color:var(--accent-gold);">Outgoing Responses (${choiceCount}):</span>
              <button class="btn btn-add-choice" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;">+ Response</button>
            </div>

            ${node.choices && node.choices.length > 0 ? `
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${node.choices.map((c, cIdx) => `
                  <div class="choice-card" data-nodeid="${node.id}" data-cidx="${cIdx}" draggable="true" style="position:relative; background:rgba(0,0,0,0.35); border:1px solid var(--panel-border); padding:6px; border-radius:6px; cursor:grab;">
                    <div style="display:flex; gap:5px; align-items:center; margin-bottom:4px;">
                      <span class="choice-drag-handle" style="cursor:grab; color:var(--text-muted); font-size:0.85rem; font-weight:800; user-select:none; padding-right:2px;" title="Drag & drop to re-order response">⠿</span>
                      <input type="text" class="form-input choice-text" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.text}" placeholder="Response Text..." style="flex:1; font-size:0.75rem; font-weight:600;" />
                      <button class="btn btn-del-choice" data-nodeid="${node.id}" data-cidx="${cIdx}" style="padding:2px 5px; font-size:0.6rem; color:#ef4444;" title="Delete Response">✕</button>
                    </div>
                    
                    ${NodeViewFactory.renderConditionPicker({ nodeId: node.id, choiceIdx: cIdx, requiredFlag: c.requiredFlag, notFlag: c.notFlag, allowFallback: false })}

                    <div style="display:flex; gap:6px; align-items:center;">
                      <input type="text" class="form-input choice-voice-url" data-nodeid="${node.id}" data-cidx="${cIdx}" value="${c.voiceAudioUrl || ''}" placeholder="🎙️ Response Voiceover URL..." style="flex:1; font-size:0.68rem;" />
                      <label class="btn btn-primary" style="padding:2px 6px; cursor:pointer;" title="Choose Audio File">
                        📁
                        <input type="file" class="choice-voice-file" data-nodeid="${node.id}" data-cidx="${cIdx}" accept="audio/*" style="display:none;" />
                      </label>
                    </div>
                    
                    <div class="node-port node-port-out" data-nodeid="${node.id}" data-cidx="${cIdx}" style="position:absolute; right:-15px; top:50%; transform:translateY(-50%); width:18px; height:18px; border-radius:50%; background:#fbbf24; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(251,191,36,0.9); z-index:10;" title="Click & Drag arrow to connect to target node Input Port"></div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:6px; border:1px solid rgba(56,189,248,0.2); position:relative;">
                <span style="font-size:0.7rem; color:#38bdf8; font-weight:700;">▶ Next Beat:</span>
                <span style="font-size:0.72rem; color:${node.nextNodeId ? '#38bdf8' : 'var(--text-muted)'}; font-weight:700;">
                  ${node.nextNodeId ? `➔ ${node.nextNodeId}` : '(End Sequence)'}
                </span>
                <div class="node-port node-port-out" data-nodeid="${node.id}" style="position:absolute; right:-15px; top:50%; transform:translateY(-50%); width:18px; height:18px; border-radius:50%; background:#38bdf8; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(56,189,248,0.9); z-index:10;" title="▶ Next Beat: Drag arrow to connect to target node Input Port"></div>
              </div>
            `}
          </div>
        ` : ''}

        <!-- 🔀 LOGIC ROUTER NODE BODY -->
        ${isRouter ? `
          <div style="background:rgba(192, 132, 252, 0.15); border:1px dashed #c084fc; border-radius:6px; padding:6px; margin-bottom:8px; font-size:0.7rem; color:#e9d5ff;">
            ⚡ <b>Invisible Logic Router Node</b>: Evaluates outgoing conditions in order. The first matching branch is automatically selected!
          </div>

          <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:6px; margin-top:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:0.7rem; font-weight:700; color:#c084fc;">Branch Rules (${choiceCount}):</span>
              <button class="btn btn-add-choice" data-nodeid="${node.id}" style="font-size:0.65rem; padding:2px 6px;">+ Rule</button>
            </div>

            ${node.choices && node.choices.length > 0 ? `
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${node.choices.map((c, cIdx) => {
                  const isFallback = c.requiredFlag === undefined && c.notFlag === undefined;
                  const isDraggable = !isFallback;

                  return `
                    <div class="router-branch-card" data-nodeid="${node.id}" data-cidx="${cIdx}" draggable="${isDraggable}" style="position:relative; background:rgba(0,0,0,0.35); border:1px solid rgba(192, 132, 252, 0.3); padding:6px 8px; border-radius:6px; cursor:${isDraggable ? 'grab' : 'default'};">
                      <div style="display:flex; gap:5px; align-items:center;">
                        <span class="choice-drag-handle" style="cursor:${isDraggable ? 'grab' : 'not-allowed'}; color:${isDraggable ? '#c084fc' : '#64748b'}; font-size:0.85rem; font-weight:800; user-select:none; padding-right:2px;" title="${isDraggable ? 'Drag & drop to re-order rule' : 'Fallback rule is pinned at the bottom'}">⠿</span>

                        <div style="flex:1;">
                          ${NodeViewFactory.renderConditionPicker({ nodeId: node.id, choiceIdx: cIdx, requiredFlag: c.requiredFlag, notFlag: c.notFlag, allowFallback: true })}
                        </div>

                        <button class="btn btn-del-choice" data-nodeid="${node.id}" data-cidx="${cIdx}" style="padding:2px 5px; font-size:0.6rem; color:#ef4444;" title="Delete Rule">✕</button>
                      </div>

                      <div class="node-port node-port-out" data-nodeid="${node.id}" data-cidx="${cIdx}" style="position:absolute; right:-15px; top:50%; transform:translateY(-50%); width:18px; height:18px; border-radius:50%; background:#c084fc; border:2px solid #0f172a; cursor:crosshair; box-shadow:0 0 10px rgba(192,132,252,0.9); z-index:10;" title="Click & Drag arrow to connect to target node"></div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}

      </div>
    `;
  }

  public static attachNodeEvents(params: {
    container: HTMLElement;
    tree: DialogTree;
    project: ProjectData | null;
    onReRender: () => void;
    onUpdate: () => void;
  }): void {
    const { container, tree, project, onReRender, onUpdate } = params;

    const enforceRouterFallbackLast = (nid: string) => {
      const node = tree.nodes[nid];
      if (!node || !node.isRouterNode || !node.choices) return;
      const fallbackIdx = node.choices.findIndex(c => c.requiredFlag === undefined && c.notFlag === undefined);
      if (fallbackIdx !== -1 && fallbackIdx !== node.choices.length - 1) {
        const [fallback] = node.choices.splice(fallbackIdx, 1);
        node.choices.push(fallback);
      }
    };

    // Node Type Selector
    container.querySelectorAll('.node-type-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        const newType = (e.target as HTMLSelectElement).value as 'beat' | 'router' | 'event_listener' | 'action';
        const node = tree.nodes[nid];
        if (!node) return;

        node.nodeType = newType;
        node.isRouterNode = newType === 'router';

        if (newType === 'event_listener') {
          if (!node.eventScope) node.eventScope = 'scene';
          if (!node.eventTargetId) node.eventTargetId = project?.scenes[0]?.id || '';
          if (!node.eventName) node.eventName = 'enter';
        } else if (newType === 'action') {
          if (!node.actionCategory) node.actionCategory = 'screen_effect';
          if (!node.screenEffectType) node.screenEffectType = 'fade_in';
          if (node.screenEffectDuration === undefined) node.screenEffectDuration = 1.0;
        } else if (newType === 'router') {
          if (!node.choices || node.choices.length === 0) {
            node.choices = [
              { id: 'branch_1', text: 'If Has Flag...', nextNodeId: '' },
              { id: 'branch_2', text: 'Else (Fallback)', nextNodeId: '' }
            ];
          }
        }

        onReRender();
        onUpdate();
      });
    });

    // Make Start Node
    container.querySelectorAll('.btn-make-start').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        tree.startNodeId = nid;
        onReRender();
        onUpdate();
      });
    });

    // Delete Node
    container.querySelectorAll('.btn-del-node').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        delete tree.nodes[nid];
        if (tree.startNodeId === nid) {
          tree.startNodeId = Object.keys(tree.nodes)[0] || '';
        }
        onReRender();
        onUpdate();
      });
    });

    // Speaker Edit
    container.querySelectorAll('.node-speaker').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].speaker = (e.target as HTMLInputElement).value;
          onUpdate();
        }
      });
    });

    // Speaker Animation Edit
    container.querySelectorAll('.node-speaker-anim').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].speakerAnimation = (e.target as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    // Text Edit
    container.querySelectorAll('.node-text').forEach(txt => {
      txt.addEventListener('input', (e) => {
        const nid = (txt as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].text = (txt as HTMLTextAreaElement).value;
          onUpdate();
        }
      });
    });

    // Voiceover Audio URL
    container.querySelectorAll('.node-voice-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].voiceAudioUrl = (input as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-voice-file').forEach(fileInput => {
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        const nid = target.dataset.nodeid!;

        if (file && tree.nodes[nid]) {
          const targetScene = DialogEditorUtils.findDialogScene(project, tree);
          const relPath = resolvePickedAssetPath(file, 'audio', targetScene, project);
          tree.nodes[nid].voiceAudioUrl = relPath;
          const urlInput = container.querySelector(`.node-voice-url[data-nodeid="${nid}"]`) as HTMLInputElement;
          if (urlInput) urlInput.value = relPath;
          onUpdate();
        }
      });
    });

    // Condition Flag Name & Op
    container.querySelectorAll('.cond-node-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          const val = (input as HTMLInputElement).value;
          const opSel = container.querySelector(`.cond-node-op[data-nodeid="${nid}"]`) as HTMLSelectElement;
          const op = opSel?.value || 'always';
          if (op === 'false') {
            tree.nodes[nid].notFlag = val;
            tree.nodes[nid].requiredFlag = undefined;
          } else if (op === 'true') {
            tree.nodes[nid].requiredFlag = val;
            tree.nodes[nid].notFlag = undefined;
          } else {
            tree.nodes[nid].requiredFlag = undefined;
            tree.nodes[nid].notFlag = undefined;
          }
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.cond-node-op').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          const nameInput = container.querySelector(`.cond-node-name[data-nodeid="${nid}"]`) as HTMLInputElement;
          const flag = nameInput?.value.trim() || '';
          const op = (e.target as HTMLSelectElement).value;
          if (op === 'false') {
            tree.nodes[nid].notFlag = flag;
            tree.nodes[nid].requiredFlag = undefined;
          } else if (op === 'true') {
            tree.nodes[nid].requiredFlag = flag;
            tree.nodes[nid].notFlag = undefined;
          } else {
            tree.nodes[nid].requiredFlag = undefined;
            tree.nodes[nid].notFlag = undefined;
          }
          onReRender();
          onUpdate();
        }
      });
    });

    // Interactive Selection Box
    container.querySelectorAll('.node-interactive-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const nid = (chk as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].isChoiceInteractive = (chk as HTMLInputElement).checked;
          onReRender();
          onUpdate();
        }
      });
    });

    // Choices & Rules Add
    container.querySelectorAll('.btn-add-choice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].choices) tree.nodes[nid].choices = [];
          const isR = Boolean(tree.nodes[nid].isRouterNode);
          const cIdx = tree.nodes[nid].choices!.length + 1;
          const newChoice = {
            id: `branch_${cIdx}`,
            text: isR ? 'Flag is true' : 'Response option...',
            requiredFlag: isR ? '' : undefined,
            nextNodeId: ''
          };

          if (isR && tree.nodes[nid].choices!.length > 0) {
            const lastChoice = tree.nodes[nid].choices![tree.nodes[nid].choices!.length - 1];
            if (lastChoice && lastChoice.requiredFlag === undefined && lastChoice.notFlag === undefined) {
              tree.nodes[nid].choices!.splice(tree.nodes[nid].choices!.length - 1, 0, newChoice);
            } else {
              tree.nodes[nid].choices!.push(newChoice);
            }
          } else {
            tree.nodes[nid].choices!.push(newChoice);
          }

          enforceRouterFallbackLast(nid);
          onReRender();
          onUpdate();
        }
      });
    });

    // Choices Delete
    container.querySelectorAll('.btn-del-choice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices) {
          tree.nodes[nid].choices!.splice(cIdx, 1);
          onReRender();
          onUpdate();
        }
      });
    });

    // Choices Text
    container.querySelectorAll('.choice-text').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].text = target.value;
          onUpdate();
        }
      });
    });

    // Choices Condition Flag
    container.querySelectorAll('.cond-choice-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        const choice = tree.nodes[nid]?.choices?.[cIdx];
        if (choice) {
          const val = target.value;
          const opSel = container.querySelector(`.cond-choice-op[data-nodeid="${nid}"][data-cidx="${cIdx}"]`) as HTMLSelectElement;
          const op = opSel?.value || 'always';
          if (op === 'false') {
            choice.notFlag = val;
            choice.requiredFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = val ? `${val} is false` : 'is false';
          } else if (op === 'true') {
            choice.requiredFlag = val;
            choice.notFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = val ? `${val} is true` : 'is true';
          } else {
            choice.requiredFlag = undefined;
            choice.notFlag = undefined;
          }
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.cond-choice-op').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const cIdx = parseInt((sel as HTMLElement).dataset.cidx!);
        const choice = tree.nodes[nid]?.choices?.[cIdx];
        if (choice) {
          const nameInput = container.querySelector(`.cond-choice-name[data-nodeid="${nid}"][data-cidx="${cIdx}"]`) as HTMLInputElement;
          const flag = nameInput?.value || '';
          const op = target.value;
          if (op === 'false') {
            choice.notFlag = flag;
            choice.requiredFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = flag ? `${flag} is false` : 'is false';
          } else if (op === 'true') {
            choice.requiredFlag = flag;
            choice.notFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = flag ? `${flag} is true` : 'is true';
          } else {
            choice.requiredFlag = undefined;
            choice.notFlag = undefined;
            if (tree.nodes[nid].isRouterNode) choice.text = 'Else (Fallback)';
          }
          if (tree.nodes[nid].isRouterNode) {
            enforceRouterFallbackLast(nid);
          }
          onReRender();
          onUpdate();
        }
      });
    });

    // Choices Voiceover
    container.querySelectorAll('.choice-voice-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);
        if (tree.nodes[nid]?.choices?.[cIdx]) {
          tree.nodes[nid].choices![cIdx].voiceAudioUrl = target.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.choice-voice-file').forEach(fileInput => {
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        const nid = target.dataset.nodeid!;
        const cIdx = parseInt(target.dataset.cidx!);

        if (file && tree.nodes[nid]?.choices?.[cIdx]) {
          const targetScene = DialogEditorUtils.findDialogScene(project, tree);
          const relPath = resolvePickedAssetPath(file, 'audio', targetScene, project);
          tree.nodes[nid].choices![cIdx].voiceAudioUrl = relPath;
          const urlInput = container.querySelector(`.choice-voice-url[data-nodeid="${nid}"][data-cidx="${cIdx}"]`) as HTMLInputElement;
          if (urlInput) urlInput.value = relPath;
          onUpdate();
        }
      });
    });

    // Stage Directives
    container.querySelectorAll('.btn-add-directive').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nid = (e.currentTarget as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].directives) tree.nodes[nid].directives = [];
          tree.nodes[nid].directives!.push({
            id: `dir_${Date.now()}`,
            type: 'animation',
            actorId: 'player',
            animationName: 'gesture'
          });
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-del-directive').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const nid = target.dataset.nodeid!;
        const didx = parseInt(target.dataset.didx!);
        if (tree.nodes[nid]?.directives) {
          tree.nodes[nid].directives!.splice(didx, 1);
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-type-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].type = target.value as DirectiveActionType;
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-actor-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].actorId = target.value;
          const anims = DialogEditorUtils.getActorAnimations(project, target.value);
          if (anims.length > 0) tree.nodes[nid].directives![didx].animationName = anims[0];
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-anim-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].animationName = target.value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-loop-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const nid = (chk as HTMLElement).dataset.nodeid!;
        const didx = parseInt((chk as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].loopAnimation = (chk as HTMLInputElement).checked;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-delay-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].delaySeconds = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-choreo-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].choreographyGroupId = target.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-item-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].itemId = target.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-emote-text').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].emoteText = (input as HTMLInputElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-target-actor').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].targetActorId = target.value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-walk-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          if (!tree.nodes[nid].directives![didx].targetPosition) tree.nodes[nid].directives![didx].targetPosition = { x: 500, y: 700 };
          tree.nodes[nid].directives![didx].targetPosition!.x = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-walk-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          if (!tree.nodes[nid].directives![didx].targetPosition) tree.nodes[nid].directives![didx].targetPosition = { x: 500, y: 700 };
          tree.nodes[nid].directives![didx].targetPosition!.y = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-sfx-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].sfxUrl = (input as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-camera-action').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = (sel as HTMLElement).dataset.nodeid!;
        const didx = parseInt((sel as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].cameraAction = target.value as any;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-camera-zoom').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].cameraZoom = parseFloat((input as HTMLInputElement).value) || 1.0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-event-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].eventName = (input as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-event-payload').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        const didx = parseInt((input as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].eventPayload = (input as HTMLInputElement).value || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.dir-sfx-file').forEach(fileInput => {
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        const nid = target.dataset.nodeid!;
        const didx = parseInt(target.dataset.didx!);

        if (file && tree.nodes[nid]?.directives?.[didx]) {
          const targetScene = DialogEditorUtils.findDialogScene(project, tree);
          const relPath = resolvePickedAssetPath(file, 'audio', targetScene, project);
          tree.nodes[nid].directives![didx].sfxUrl = relPath;
          const urlInput = container.querySelector(`.dir-sfx-url[data-nodeid="${nid}"][data-didx="${didx}"]`) as HTMLInputElement;
          if (urlInput) urlInput.value = relPath;
          onUpdate();
        }
      });
    });

    // Action Node Event Handlers
    container.querySelectorAll('.node-action-category').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        const cat = (e.target as HTMLSelectElement).value as any;
        const node = tree.nodes[nid];
        if (node) {
          node.actionCategory = cat;
          if (cat === 'screen_effect' && !node.screenEffectType) {
            node.screenEffectType = 'fade_in';
            node.screenEffectDuration = 1.0;
          }
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-screen-fx-type').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].screenEffectType = (e.target as HTMLSelectElement).value as any;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-screen-fx-duration').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].screenEffectDuration = parseFloat((e.target as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-screen-fx-color').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].screenEffectColor = (e.target as HTMLInputElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-video-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].videoUrl = (e.target as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-video-file').forEach(fileInput => {
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        const nid = target.dataset.nodeid!;
        if (file && tree.nodes[nid]) {
          const targetScene = DialogEditorUtils.findDialogScene(project, tree);
          const relPath = resolvePickedAssetPath(file, 'video', targetScene, project);
          tree.nodes[nid].videoUrl = relPath;
          const urlInput = container.querySelector(`.node-video-url[data-nodeid="${nid}"]`) as HTMLInputElement;
          if (urlInput) urlInput.value = relPath;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-video-skippable').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const nid = (chk as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].videoSkippable = (chk as HTMLInputElement).checked;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-camera-action').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].cameraAction = (e.target as HTMLSelectElement).value as any;
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-camera-zoom').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].cameraZoom = parseFloat((e.target as HTMLInputElement).value) || 1.0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-camera-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].targetPosition) tree.nodes[nid].targetPosition = { x: 500, y: 500 };
          tree.nodes[nid].targetPosition!.x = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-camera-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].targetPosition) tree.nodes[nid].targetPosition = { x: 500, y: 500 };
          tree.nodes[nid].targetPosition!.y = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-camera-actor').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].targetActorId = (sel as HTMLSelectElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-audio-action').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].audioAction = (sel as HTMLSelectElement).value as any;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-audio-url').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].audioUrl = (input as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-audio-file').forEach(fileInput => {
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        const nid = target.dataset.nodeid!;
        if (file && tree.nodes[nid]) {
          const targetScene = DialogEditorUtils.findDialogScene(project, tree);
          const relPath = resolvePickedAssetPath(file, 'audio', targetScene, project);
          tree.nodes[nid].audioUrl = relPath;
          const urlInput = container.querySelector(`.node-audio-url[data-nodeid="${nid}"]`) as HTMLInputElement;
          if (urlInput) urlInput.value = relPath;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-delay-seconds').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].waitDurationSeconds = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-scene-target').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].targetSceneId = (sel as HTMLSelectElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-scene-spawn-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].targetSpawnPoint) tree.nodes[nid].targetSpawnPoint = { x: 300, y: 750 };
          tree.nodes[nid].targetSpawnPoint!.x = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-scene-spawn-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].targetSpawnPoint) tree.nodes[nid].targetSpawnPoint = { x: 300, y: 750 };
          tree.nodes[nid].targetSpawnPoint!.y = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-set-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].setFlag = (input as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-clear-flag').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].clearFlag = (input as HTMLInputElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-give-item').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].giveItem = (sel as HTMLSelectElement).value.trim() || undefined;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-take-item').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          const val = (sel as HTMLSelectElement).value.trim();
          tree.nodes[nid].takeItems = val ? [val] : undefined;
          onUpdate();
        }
      });
    });

    // Event Listener Handlers
    container.querySelectorAll('.node-event-scope').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        const scope = (e.target as HTMLSelectElement).value as any;
        const node = tree.nodes[nid];
        if (node) {
          node.eventScope = scope;
          if (scope === 'scene') node.eventTargetId = project?.scenes[0]?.id || '';
          else if (scope === 'hotspot') node.eventTargetId = DialogEditorUtils.getAllHotspots(project)[0]?.id || '';
          else if (scope === 'character') node.eventTargetId = DialogEditorUtils.getAllCharacters(project)[0]?.id || '';
          else if (scope === 'item') node.eventTargetId = DialogEditorUtils.getAllItems(project)[0]?.id || '';
          else node.eventTargetId = 'game';

          const availableEvents = DialogEditorUtils.getEventsForScope(scope);
          node.eventName = availableEvents[0]?.id || 'enter';
          onReRender();
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-event-target').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        const targetId = (e.target as HTMLSelectElement).value;
        if (tree.nodes[nid]) {
          tree.nodes[nid].eventTargetId = targetId;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-event-name').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (e.target as HTMLElement).dataset.nodeid!;
        const evName = (e.target as HTMLSelectElement).value;
        if (tree.nodes[nid]) {
          tree.nodes[nid].eventName = evName;
          onUpdate();
        }
      });
    });

    // Drag & Drop Re-ordering for Rules and Choices
    let draggedChoiceNid: string | null = null;
    let draggedChoiceIdx: number | null = null;

    container.querySelectorAll('.router-branch-card, .choice-card').forEach(card => {
      const el = card as HTMLElement;

      el.addEventListener('dragstart', (e) => {
        const nid = el.dataset.nodeid;
        const cidx = parseInt(el.dataset.cidx || '-1');
        if (nid && cidx >= 0) {
          draggedChoiceNid = nid;
          draggedChoiceIdx = cidx;
          el.style.opacity = '0.4';
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `${nid}:${cidx}`);
          }
        }
      });

      el.addEventListener('dragend', () => {
        draggedChoiceNid = null;
        draggedChoiceIdx = null;
        el.style.opacity = '1';
        container.querySelectorAll('.router-branch-card, .choice-card').forEach(c => {
          (c as HTMLElement).style.outline = '';
        });
      });

      el.addEventListener('dragover', (e) => {
        const nid = el.dataset.nodeid;
        if (draggedChoiceNid === nid) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          el.style.outline = '2px dashed #c084fc';
        }
      });

      el.addEventListener('dragleave', () => {
        el.style.outline = '';
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.style.outline = '';
        const targetNid = el.dataset.nodeid;
        const targetCIdx = parseInt(el.dataset.cidx || '-1');

        if (draggedChoiceNid && draggedChoiceNid === targetNid && draggedChoiceIdx !== null && targetCIdx >= 0 && draggedChoiceIdx !== targetCIdx) {
          const choices = tree.nodes[targetNid]?.choices;
          if (choices) {
            const [moved] = choices.splice(draggedChoiceIdx, 1);
            choices.splice(targetCIdx, 0, moved);
            enforceRouterFallbackLast(targetNid);
            onReRender();
            onUpdate();
          }
        }
        draggedChoiceNid = null;
        draggedChoiceIdx = null;
      });
    });

    // Drag & Drop Re-ordering for Stage Directives
    let draggedDirNid: string | null = null;
    let draggedDirIdx: number | null = null;

    container.querySelectorAll('.stage-directive-card').forEach(card => {
      const el = card as HTMLElement;

      el.addEventListener('dragstart', (e) => {
        const nid = el.dataset.nodeid;
        const didx = parseInt(el.dataset.didx || '-1');
        if (nid && didx >= 0) {
          draggedDirNid = nid;
          draggedDirIdx = didx;
          el.style.opacity = '0.4';
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `${nid}:${didx}`);
          }
        }
      });

      el.addEventListener('dragend', () => {
        draggedDirNid = null;
        draggedDirIdx = null;
        el.style.opacity = '1';
        container.querySelectorAll('.stage-directive-card').forEach(c => {
          (c as HTMLElement).style.outline = '';
        });
      });

      el.addEventListener('dragover', (e) => {
        const nid = el.dataset.nodeid;
        if (draggedDirNid === nid) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          el.style.outline = '2px dashed #f59e0b';
        }
      });

      el.addEventListener('dragleave', () => {
        el.style.outline = '';
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.style.outline = '';
        const targetNid = el.dataset.nodeid;
        const targetDIdx = parseInt(el.dataset.didx || '-1');

        if (draggedDirNid && draggedDirNid === targetNid && draggedDirIdx !== null && targetDIdx >= 0 && draggedDirIdx !== targetDIdx) {
          const dirs = tree.nodes[targetNid]?.directives;
          if (dirs) {
            const [moved] = dirs.splice(draggedDirIdx, 1);
            dirs.splice(targetDIdx, 0, moved);
            onReRender();
            onUpdate();
          }
        }
        draggedDirNid = null;
        draggedDirIdx = null;
      });
    });
  }
}
