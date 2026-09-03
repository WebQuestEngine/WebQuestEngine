import { ProjectData, SceneData, DialogTree, Vector2D } from '../../../engine/types';
import { EventBus } from '../../../engine/core/EventBus';

export interface SceneTransitionData {
  id: string;
  fromSceneId: string;
  toSceneId: string;
  label: string;
  causeName: string;
  type: 'hotspot' | 'action';
  dialogId?: string;
  hotspotId?: string;
}

export class DialogEditorUtils {
  public static startViewportPick(onPicked: (pt: Vector2D) => void): void {
    const editorModal = document.querySelector('.dialog-editor-container');
    const backdrop = document.querySelector('.dialog-editor-backdrop');
    editorModal?.classList.add('viewport-picking-active');
    backdrop?.classList.add('viewport-picking-active');

    const banner = document.createElement('div');
    banner.className = 'viewport-picker-banner';
    banner.innerHTML = `
      <span>🎯 Click anywhere on the scene viewport to set position</span>
      <button class="btn btn-primary" style="font-size:0.75rem; padding:3px 8px; cursor:pointer;">Cancel (Esc)</button>
    `;
    document.body.appendChild(banner);

    let isDone = false;
    const cleanup = () => {
      if (isDone) return;
      isDone = true;
      banner.remove();
      editorModal?.classList.remove('viewport-picking-active');
      backdrop?.classList.remove('viewport-picking-active');
      window.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        EventBus.getInstance().emit('editor:cancel_pick_spawn');
      }
    };
    window.addEventListener('keydown', onKeyDown);

    banner.querySelector('button')?.addEventListener('click', () => {
      cleanup();
      EventBus.getInstance().emit('editor:cancel_pick_spawn');
    });

    EventBus.getInstance().emit('editor:pick_spawn_point', (pt: Vector2D, cancelled?: boolean) => {
      cleanup();
      if (!cancelled && pt) {
        const cleanPt = { x: Math.round(pt.x), y: Math.round(pt.y) };
        onPicked(cleanPt);
      }
    });
  }
  public static escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public static getAllScenes(project: ProjectData | null): SceneData[] {
    return project?.scenes || [];
  }

  public static getAllHotspots(project: ProjectData | null): { id: string; name: string; sceneId: string; sceneName: string }[] {
    const list: { id: string; name: string; sceneId: string; sceneName: string }[] = [];
    if (project?.scenes) {
      for (const sc of project.scenes) {
        for (const hs of sc.hotspots || []) {
          list.push({ id: hs.id, name: hs.name, sceneId: sc.id, sceneName: sc.name });
        }
      }
    }
    return list;
  }

  public static getAllCharacters(project: ProjectData | null): { id: string; name: string; sceneId: string; sceneName: string }[] {
    const list: { id: string; name: string; sceneId: string; sceneName: string }[] = [];
    if (project?.scenes) {
      for (const sc of project.scenes) {
        for (const ch of sc.characters || []) {
          list.push({ id: ch.id, name: ch.name, sceneId: sc.id, sceneName: sc.name });
        }
      }
    }
    return list;
  }

  public static getAllItems(project: ProjectData | null): { id: string; name: string }[] {
    return (project?.items || []).map(it => ({ id: it.id, name: it.name }));
  }

  public static getEventsForScope(scope: string): { id: string; label: string }[] {
    switch (scope) {
      case 'game':
        return [
          { id: 'start', label: '🎮 On Game Start / Launch' },
          { id: 'end', label: '🏁 On Game End / Victory' },
          { id: 'loaded', label: '💾 On Save Game Loaded' }
        ];
      case 'scene':
        return [
          { id: 'enter', label: '🚪 On Enter Scene' },
          { id: 'first_enter', label: '✨ On First Time Enter Scene' },
          { id: 'exit', label: '🚶 On Exit Scene' }
        ];
      case 'hotspot':
        return [
          { id: 'interact', label: '⚡ On Any Interaction' },
          { id: 'look_at', label: '👁️ On Look At' },
          { id: 'use', label: '✋ On Use / Activate' },
          { id: 'talk_to', label: '💬 On Talk To' },
          { id: 'pick_up', label: '🎒 On Pick Up / Take' },
          { id: 'open', label: '🔓 On Open' },
          { id: 'close', label: '🔒 On Close' }
        ];
      case 'character':
        return [
          { id: 'talk_to', label: '💬 On Talk To' },
          { id: 'interact', label: '⚡ On Any Interaction' },
          { id: 'arrived_at', label: '📍 On Arrived At Target' },
          { id: 'anim_completed', label: '🎬 On Animation Finished' }
        ];
      case 'item':
        return [
          { id: 'use', label: '✋ On Use Item' },
          { id: 'examine', label: '🔍 On Examine Item' },
          { id: 'obtained', label: '🎁 On Item Obtained' },
          { id: 'combine', label: '🔗 On Item Combined' }
        ];
      default:
        return [{ id: 'trigger', label: '⚡ On Trigger' }];
    }
  }

  public static findDialogScene(project: ProjectData | null, dTree: DialogTree): SceneData | null {
    if (!project || !project.scenes) return null;
    for (const sc of project.scenes) {
      for (const ch of sc.characters || []) {
        if (ch.actions?.some(a => a.dialogId === dTree.id) || (dTree.id && dTree.id.includes(ch.id.replace(/^npc_/, '')))) return sc;
      }
      for (const hs of sc.hotspots || []) {
        if (hs.actions?.some(a => a.dialogId === dTree.id)) return sc;
      }
    }
    return project.scenes[0] || null;
  }

  public static getAllProjectActors(project: ProjectData | null): { id: string; name: string; displayName: string; animations: string[] }[] {
    const playerChar = project?.scenes?.flatMap(s => s.characters || []).find(c => c.id === 'player');
    const playerName = playerChar?.name || 'Hero';
    const playerAnims = playerChar?.animations ? Object.keys(playerChar.animations) : ['idle', 'walk', 'talk', 'pick_up', 'listen', 'gesture', 'bow', 'cower'];

    const actors: { id: string; name: string; displayName: string; animations: string[] }[] = [
      { id: 'player', name: `👤 ${playerName} (Player)`, displayName: playerName, animations: playerAnims }
    ];
    if (project?.scenes) {
      for (const sc of project.scenes) {
        for (const c of sc.characters) {
          const anims = c.animations ? Object.keys(c.animations) : ['idle', 'talk', 'walk', 'gesture', 'look_around'];
          if (!actors.some(a => a.id === c.id)) {
            actors.push({ id: c.id, name: `🎭 ${c.name} (${c.id})`, displayName: c.name, animations: anims });
          }
        }
        for (const hs of sc.hotspots) {
          if (!actors.some(a => a.id === hs.id)) {
            actors.push({ id: hs.id, name: `📦 ${hs.name} (${hs.id})`, displayName: hs.name, animations: ['idle', 'active', 'open', 'close'] });
          }
        }
      }
    }
    return actors;
  }

  public static getActorAnimations(project: ProjectData | null, actorId: string): string[] {
    const actors = DialogEditorUtils.getAllProjectActors(project);
    const found = actors.find(a => a.id === actorId);
    if (found && found.animations && found.animations.length > 0) return found.animations;
    return ['idle', 'talk', 'walk', 'gesture', 'stir_cauldron', 'look_around', 'cower', 'celebrate'];
  }

  public static getSequenceSceneId(project: ProjectData | null, dTree: DialogTree): string {
    if (dTree.sceneId) return dTree.sceneId;
    if (!project || !project.scenes) return 'global';

    // Check characters & hotspots in scenes
    for (const sc of project.scenes) {
      for (const ch of sc.characters || []) {
        if (ch.actions?.some(a => a.dialogId === dTree.id)) return sc.id;
      }
      for (const hs of sc.hotspots || []) {
        if (hs.actions?.some(a => a.dialogId === dTree.id)) return sc.id;
      }
      const strippedId = sc.id.replace(/^scene_/, '');
      if (strippedId && dTree.id.includes(strippedId)) return sc.id;
    }

    // Check event nodes inside sequence
    for (const node of Object.values(dTree.nodes || {})) {
      if (node.eventScope === 'scene' && node.eventTargetId) return node.eventTargetId;
    }

    return 'global';
  }

  public static getSequencesForScene(project: ProjectData | null, sceneId: string): DialogTree[] {
    if (!project || !project.dialogs) return [];
    return project.dialogs.filter(d => {
      const sId = DialogEditorUtils.getSequenceSceneId(project, d);
      return sId === sceneId;
    });
  }

  public static getSceneTransitions(project: ProjectData | null): SceneTransitionData[] {
    const transitions: SceneTransitionData[] = [];
    if (!project || !project.scenes) return transitions;

    for (const sc of project.scenes) {
      // Hotspots with targetSceneId
      for (const hs of sc.hotspots || []) {
        for (const action of hs.actions || []) {
          if (action.targetSceneId && action.targetSceneId !== sc.id) {
            const trId = `tr_hs_${sc.id}_${action.targetSceneId}_${hs.id}`;
            if (!transitions.some(t => t.id === trId)) {
              transitions.push({
                id: trId,
                fromSceneId: sc.id,
                toSceneId: action.targetSceneId,
                label: `🚪 ${hs.name}`,
                causeName: hs.name,
                type: 'hotspot',
                hotspotId: hs.id
              });
            }
          }
        }
      }

      // Action nodes with scene_change
      for (const dt of project.dialogs || []) {
        const dSceneId = DialogEditorUtils.getSequenceSceneId(project, dt);
        if (dSceneId === sc.id) {
          for (const node of Object.values(dt.nodes || {})) {
            if (node.actionCategory === 'scene_change' && node.targetSceneId && node.targetSceneId !== sc.id) {
              const trId = `tr_act_${sc.id}_${node.targetSceneId}_${dt.id}_${node.id}`;
              if (!transitions.some(t => t.id === trId)) {
                transitions.push({
                  id: trId,
                  fromSceneId: sc.id,
                  toSceneId: node.targetSceneId,
                  label: `🎬 ${dt.title || dt.id}`,
                  causeName: dt.title || dt.id,
                  type: 'action',
                  dialogId: dt.id
                });
              }
            }
          }
        }
      }
    }
    return transitions;
  }

  public static getSwitchNodePosition(
    project: ProjectData | null,
    tr: SceneTransitionData,
    allTransitions: SceneTransitionData[]
  ): Vector2D {
    // 1. Saved custom position
    if (project?.storyboardSettings?.switchNodePositions?.[tr.id]) {
      return project.storyboardSettings.switchNodePositions[tr.id];
    }

    if (!project || !project.scenes) return { x: 200, y: 200 };

    const fromIdx = project.scenes.findIndex(s => s.id === tr.fromSceneId);
    const toIdx = project.scenes.findIndex(s => s.id === tr.toSceneId);

    const fromSc = project.scenes[fromIdx];
    const toSc = project.scenes[toIdx];

    const fromX = fromSc?.storyPosition?.x ?? (80 + (fromIdx >= 0 ? (fromIdx % 3) * 390 : 0));
    const fromY = fromSc?.storyPosition?.y ?? (80 + (fromIdx >= 0 ? Math.floor(fromIdx / 3) * 360 : 0));

    const toX = toSc?.storyPosition?.x ?? (80 + (toIdx >= 0 ? (toIdx % 3) * 390 : 0));
    const toY = toSc?.storyPosition?.y ?? (80 + (toIdx >= 0 ? Math.floor(toIdx / 3) * 360 : 0));

    const midX = (fromX + toX) / 2 + 60;
    const midY = (fromY + toY) / 2 + 70;

    // Check if there is a reverse transition (two-way loop)
    const hasReverse = allTransitions.some(t => t.fromSceneId === tr.toSceneId && t.toSceneId === tr.fromSceneId);

    if (hasReverse) {
      const dy = toY - fromY;
      const dx = toX - fromX;

      if (Math.abs(dy) >= Math.abs(dx)) {
        // Vertical layout: bow to left or right
        if (fromY < toY) {
          // Going downwards (e.g. Lab -> Gates): bow out to the LEFT
          return { x: midX - 260, y: midY };
        } else {
          // Going upwards (e.g. Gates -> Lab): bow out to the RIGHT
          return { x: midX + 260, y: midY };
        }
      } else {
        // Horizontal layout: bow above or below
        if (fromX < toX) {
          // Going rightwards: bow above
          return { x: midX, y: midY - 160 };
        } else {
          // Going leftwards: bow below
          return { x: midX, y: midY + 160 };
        }
      }
    }

    return { x: midX, y: midY };
  }
}
