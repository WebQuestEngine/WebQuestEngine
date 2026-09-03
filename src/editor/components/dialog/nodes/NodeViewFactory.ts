import { DialogTree, DialogNode, ProjectData, DirectiveActionType } from '../../../../engine/types';
import { resolvePickedAssetPath } from '../../../utils/AssetPathUtils';
import { DialogEditorUtils } from '../DialogEditorUtils';
import { NodeViewsTemplate } from '../templates/NodeViews.template';

export class NodeViewFactory {
  public static renderConditionPicker(opts: {
    nodeId: string;
    choiceIdx?: number;
    requiredFlag?: string;
    notFlag?: string;
    allowFallback?: boolean;
  }): string {
    return NodeViewsTemplate.renderConditionPicker(opts);
  }

  public static renderNodeCard(params: {
    node: DialogNode;
    tree: DialogTree;
    project: ProjectData | null;
  }): string {
    return NodeViewsTemplate.renderNodeCard(params);
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

    // Speaker Selection Dropdown
    container.querySelectorAll('.node-speaker-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = target.dataset.nodeid!;
        if (!tree.nodes[nid]) return;

        const val = target.value;
        const customInput = container.querySelector(`.node-speaker[data-nodeid="${nid}"]`) as HTMLInputElement;

        if (val === '__custom__') {
          if (customInput) {
            customInput.style.display = 'block';
            customInput.focus();
          }
        } else if (val === 'Narrator') {
          tree.nodes[nid].speaker = 'Narrator';
          tree.nodes[nid].actorId = undefined;
          if (customInput) {
            customInput.value = 'Narrator';
            customInput.style.display = 'none';
          }
          onUpdate();
        } else {
          const selectedOption = target.options[target.selectedIndex];
          const displayName = selectedOption?.dataset.name || val;
          tree.nodes[nid].speaker = displayName;
          tree.nodes[nid].actorId = val;
          if (customInput) {
            customInput.value = displayName;
            customInput.style.display = 'none';
          }
          onUpdate();
        }
      });
    });

    // Toggle Custom Speaker Name Textbox
    container.querySelectorAll('.btn-toggle-custom-speaker').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const nid = (btn as HTMLElement).dataset.nodeid!;
        const customInput = container.querySelector(`.node-speaker[data-nodeid="${nid}"]`) as HTMLInputElement;
        if (customInput) {
          const isHidden = customInput.style.display === 'none';
          customInput.style.display = isHidden ? 'block' : 'none';
          if (isHidden) customInput.focus();
        }
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

    container.querySelectorAll('.dir-walk-ignore-walkpath').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const nid = (chk as HTMLElement).dataset.nodeid!;
        const didx = parseInt((chk as HTMLElement).dataset.didx!);
        if (tree.nodes[nid]?.directives?.[didx]) {
          tree.nodes[nid].directives![didx].ignoreWalkPath = (chk as HTMLInputElement).checked;
          onUpdate();
        }
      });
    });

    container.querySelectorAll('.btn-pick-dir-pos').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nid = (btn as HTMLElement).dataset.nodeid!;
        const didx = parseInt((btn as HTMLElement).dataset.didx!);
        DialogEditorUtils.startViewportPick((pt) => {
          if (!tree.nodes[nid]?.directives?.[didx]) return;
          if (!tree.nodes[nid].directives![didx].targetPosition) {
            tree.nodes[nid].directives![didx].targetPosition = { x: 0, y: 0 };
          }
          tree.nodes[nid].directives![didx].targetPosition!.x = pt.x;
          tree.nodes[nid].directives![didx].targetPosition!.y = pt.y;

          const xInput = container.querySelector(`.dir-walk-x[data-nodeid="${nid}"][data-didx="${didx}"]`) as HTMLInputElement;
          const yInput = container.querySelector(`.dir-walk-y[data-nodeid="${nid}"][data-didx="${didx}"]`) as HTMLInputElement;
          if (xInput) xInput.value = String(pt.x);
          if (yInput) yInput.value = String(pt.y);
          onUpdate();
        });
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
