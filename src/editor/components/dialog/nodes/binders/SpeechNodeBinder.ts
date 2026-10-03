import { NodeBinderParams } from './NodeBinderTypes';
import { DialogEditorUtils } from '../../DialogEditorUtils';
import { TemplateUtils } from '../../../../utils/TemplateUtils';
import { resolvePickedAssetPath } from '../../../../utils/AssetPathUtils';

export class SpeechNodeBinder {
  public static bind(params: NodeBinderParams): void {
    const { container, tree, project, onUpdate } = params;

    // Speaker Selection Dropdown
    container.querySelectorAll('.node-speaker-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = target.dataset.nodeid!;
        if (!tree.nodes[nid]) return;

        const val = target.value;
        const customInput = container.querySelector(`.node-speaker[data-nodeid="${nid}"]`) as HTMLInputElement;

        const updateAnimSelect = (actorId?: string) => {
          const animSelect = container.querySelector(`.node-speaker-anim-select[data-nodeid="${nid}"]`) as HTMLSelectElement;
          if (animSelect) {
            const anims = DialogEditorUtils.getActorAnimations(project, actorId);
            const currentAnim = (tree.nodes[nid]?.speakerAnimation || '').trim();
            const isCustom = Boolean(currentAnim && !anims.includes(currentAnim));
            const optionsHtml = [
              `<option value="" ${!currentAnim ? 'selected' : ''}>-- None (Default Talk) --</option>`,
              ...anims.map(an => `<option value="${TemplateUtils.escapeHtml(an)}" ${(!isCustom && currentAnim === an) ? 'selected' : ''}>${TemplateUtils.escapeHtml(an)}</option>`),
              `<option value="__custom__" ${isCustom ? 'selected' : ''}>✏️ Custom Anim...</option>`
            ].join('');
            animSelect.innerHTML = optionsHtml;
          }
        };

        if (val === '__custom__') {
          if (customInput) {
            customInput.style.display = 'block';
            customInput.focus();
          }
          updateAnimSelect(undefined);
        } else if (val === 'Narrator') {
          tree.nodes[nid].speaker = 'Narrator';
          tree.nodes[nid].actorId = undefined;
          if (customInput) {
            customInput.value = 'Narrator';
            customInput.style.display = 'none';
          }
          updateAnimSelect(undefined);
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
          updateAnimSelect(val);
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

    // Speaker Animation Select Dropdown
    container.querySelectorAll('.node-speaker-anim-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const nid = target.dataset.nodeid!;
        if (!tree.nodes[nid]) return;

        const val = target.value;
        const customInput = container.querySelector(`.node-speaker-anim[data-nodeid="${nid}"]`) as HTMLInputElement;

        if (val === '__custom__') {
          if (customInput) {
            customInput.style.display = 'block';
            customInput.focus();
          }
        } else if (!val) {
          tree.nodes[nid].speakerAnimation = undefined;
          if (customInput) {
            customInput.value = '';
            customInput.style.display = 'none';
          }
          onUpdate();
        } else {
          tree.nodes[nid].speakerAnimation = val;
          if (customInput) {
            customInput.value = val;
            customInput.style.display = 'none';
          }
          onUpdate();
        }
      });
    });

    // Speaker Animation Custom Text Input
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

    // Voiceover Audio File
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
  }
}
