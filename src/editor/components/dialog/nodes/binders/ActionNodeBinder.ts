import { NodeBinderParams } from './NodeBinderTypes';
import { DialogEditorUtils } from '../../DialogEditorUtils';
import { resolvePickedAssetPath } from '../../../../utils/AssetPathUtils';

export class ActionNodeBinder {
  public static bind(params: NodeBinderParams): void {
    const { container, tree, project, onReRender, onUpdate } = params;

    // Action Node Category Selector
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

    // Screen FX
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

    // Video URL & Upload
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

    // Camera Action
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
        const nid = (e.target as HTMLElement).dataset.nodeid!;
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

    // Character Action Handlers
    container.querySelectorAll('.node-char-actor').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].actorId = (sel as HTMLSelectElement).value;
          tree.nodes[nid].targetActorId = (sel as HTMLSelectElement).value;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-char-action-type').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nid = (sel as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].characterAction = (sel as HTMLSelectElement).value as any;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-char-x').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].targetPosition) tree.nodes[nid].targetPosition = { x: 500, y: 750 };
          tree.nodes[nid].targetPosition!.x = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-char-y').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          if (!tree.nodes[nid].targetPosition) tree.nodes[nid].targetPosition = { x: 500, y: 750 };
          tree.nodes[nid].targetPosition!.y = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.node-char-ignore-walkpath').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const nid = (chk as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].ignoreWalkPath = (chk as HTMLInputElement).checked;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-pick-node-pos').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nid = (btn as HTMLElement).dataset.nodeid!;
        DialogEditorUtils.startViewportPick((pt) => {
          if (!tree.nodes[nid]) return;
          if (!tree.nodes[nid].targetPosition) tree.nodes[nid].targetPosition = { x: 0, y: 0 };
          tree.nodes[nid].targetPosition!.x = pt.x;
          tree.nodes[nid].targetPosition!.y = pt.y;

          const xInput = container.querySelector(`.node-char-x[data-nodeid="${nid}"]`) as HTMLInputElement;
          const yInput = container.querySelector(`.node-char-y[data-nodeid="${nid}"]`) as HTMLInputElement;
          if (xInput) xInput.value = String(pt.x);
          if (yInput) yInput.value = String(pt.y);
          onUpdate();
        });
      });
    });

    // Audio Action
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

    // Delay Seconds
    container.querySelectorAll('.node-delay-seconds').forEach(input => {
      input.addEventListener('input', (e) => {
        const nid = (input as HTMLElement).dataset.nodeid!;
        if (tree.nodes[nid]) {
          tree.nodes[nid].waitDurationSeconds = parseFloat((input as HTMLInputElement).value) || 0;
          onUpdate();
        }
      });
    });

    // Scene Transition & Spawn Points
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

    // Flags Set & Clear
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

    // Items Give & Take
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
  }
}
