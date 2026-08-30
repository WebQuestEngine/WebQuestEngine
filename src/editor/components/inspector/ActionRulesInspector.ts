import { HotspotAction, ProjectData, SceneData } from '../../../engine/types';
import { EventBus } from '../../../engine/core/EventBus';
import { resolvePickedAssetPath } from '../../utils/AssetPathUtils';
import { VisualSpawnPickerModal } from '../VisualSpawnPickerModal';
import { ActionRulesInspectorTemplate } from './templates/ActionRulesInspector.template';

export class ActionRulesInspector {
  public static getHTML(params: {
    hIdx: number;
    actions: HotspotAction[];
    isCharacter?: boolean;
    project: ProjectData | null;
    currentScene: SceneData | null;
  }): string {
    return ActionRulesInspectorTemplate.render(params);
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
