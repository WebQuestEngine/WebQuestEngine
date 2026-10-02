import { EventBus } from '../core/EventBus';
import { Vector2D, HotspotAction, EventScopeType } from '../types';
import { Scene } from '../scene/Scene';
import { RuntimeContext } from './RuntimeContext';

export interface ActionHost {
  readonly currentScene: Scene | null;
  readonly context: RuntimeContext;
}

export class ActionExecutor {
  private host: ActionHost;

  constructor(host: ActionHost) {
    this.host = host;
  }

  public hasGameStartEvent(): boolean {
    if (!this.host.context.project?.dialogs) return false;
    for (const tree of this.host.context.project.dialogs) {
      for (const node of Object.values(tree.nodes)) {
        if (node.nodeType === 'event_listener' && node.eventScope === 'game') {
          if (!node.eventName || node.eventName === 'start') {
            return true;
          }
        }
      }
    }
    return false;
  }

  public checkAndTriggerEvent(
    scope: EventScopeType,
    targetId: string,
    eventName: string
  ): boolean {
    if (!this.host.context.project?.dialogs) return false;

    for (const tree of this.host.context.project.dialogs) {
      for (const node of Object.values(tree.nodes)) {
        if (node.nodeType === 'event_listener') {
          const matchScope = node.eventScope === scope;
          const matchTarget =
            scope === 'game' ||
            !node.eventTargetId ||
            node.eventTargetId === 'any' ||
            node.eventTargetId === targetId;

          const matchEvent =
            node.eventName === eventName ||
            (eventName === 'interact' && node.eventName === 'interact') ||
            (node.eventName === 'interact' && ['talk_to', 'look_at', 'use', 'pick_up', 'talk', 'look'].includes(eventName)) ||
            (scope === 'game' && (node.eventName === eventName || (eventName === 'start' && (!node.eventName || node.eventName === 'start'))));

          if (matchScope && matchTarget && matchEvent) {
            console.log(
              `%c[ActionExecutor] ⚡ Event Trigger Matched: [${scope}:${targetId}:${eventName}] -> Sequence "${tree.id}", Node "${node.id}"`,
              'color: #f59e0b; font-weight: bold;'
            );

            // Ensure sequence is registered
            this.host.context.dialog.registerDialog(tree);

            if (this.host.currentScene?.playerCharacter?.data?.name) {
              this.host.context.dialog.setPlayerName(this.host.currentScene.playerCharacter.data.name);
            }
            this.host.context.dialog.startDialog(tree.id, (flag) => this.host.context.story.getFlag(flag), node.id);
            return true;
          }
        }
      }
    }
    return false;
  }

  public executeAction(action: HotspotAction | any, targetPos?: Vector2D, targetElement?: any): void {
    if (action.requiredFlag && !this.host.context.story.getFlag(action.requiredFlag)) {
      EventBus.getInstance().emit('ui:notify', 'You cannot do that right now.');
      return;
    }
    if (action.notFlag && this.host.context.story.getFlag(action.notFlag)) {
      EventBus.getInstance().emit('ui:notify', 'You cannot do that right now.');
      return;
    }

    // 1. Emit universal action event
    EventBus.getInstance().emit('action:executed', { action, targetPos, targetElement });

    // 2. Custom event trigger if specified
    if (action.eventName) {
      console.log(`%c[ActionExecutor] ⚡ Firing custom event: "${action.eventName}"`, 'color: #f59e0b; font-weight: bold;');
      EventBus.getInstance().emit(action.eventName, {
        action,
        payload: action.eventPayload,
        targetPos,
        sceneId: this.host.currentScene?.data.id
      });
    }

    // 3. Audio SFX trigger
    if (action.sfxUrl) {
      this.host.context.audio.playSFX(action.sfxUrl);
    } else if (action.giveItemId) {
      this.host.context.audio.playSFX(null, 'pickup');
    } else if (action.targetSceneId) {
      this.host.context.audio.playSFX(null, 'door');
    }

    // 4. Character orientation & animation triggers
    const player = this.host.currentScene?.playerCharacter;
    if (player) {
      if (targetPos) {
        player.faceTarget(targetPos);
      }
      if (action.faceDirection) {
        player.direction8Way = action.faceDirection;
        player.isFacingLeft = ['left', 'up_left', 'down_left'].includes(action.faceDirection);
      }
    }

    // Animation Event Trigger
    if (action.playAnimation) {
      if (action.animationTarget === 'self' && targetElement && typeof targetElement.playCustomAnimation === 'function') {
        targetElement.playCustomAnimation(action.playAnimation);
      } else if (action.animationTarget && action.animationTarget !== 'player' && this.host.currentScene?.characters.has(action.animationTarget)) {
        this.host.currentScene.characters.get(action.animationTarget)?.playCustomAnimation(action.playAnimation);
      } else if (player) {
        player.playCustomAnimation(action.playAnimation);
      }
      EventBus.getInstance().emit('animation:started', {
        animation: action.playAnimation,
        target: action.animationTarget || 'player'
      });
    } else if (!action.dialogId && player) {
      if (action.verb === 'pick_up') {
        player.playCustomAnimation('pick_up', 1200);
      } else if (action.verb === 'talk') {
        if (targetElement && typeof targetElement.talk === 'function') {
          targetElement.talk();
        } else {
          player.talk();
        }
      } else if (action.verb === 'use' && action.requireItemId) {
        player.holdItem(action.requireItemId);
      }
    }

    // 5. Speech Event
    if (action.text) {
      EventBus.getInstance().emit('ui:notify', action.text);
      this.host.context.ui.showSubtitle(action.text);
    }

    // 6. Story Flag Events
    if (action.setFlag) {
      this.host.context.story.setFlag(action.setFlag, true);
    }
    if (action.setFlags && Array.isArray(action.setFlags)) {
      action.setFlags.forEach((f: string) => this.host.context.story.setFlag(f, true));
    }
    if (action.clearFlag) {
      this.host.context.story.setFlag(action.clearFlag, false);
    }
    if (action.clearFlags && Array.isArray(action.clearFlags)) {
      action.clearFlags.forEach((f: string) => this.host.context.story.setFlag(f, false));
    }

    // 7. Inventory Event
    if (action.giveItemId) {
      this.host.context.inventory.addItem(action.giveItemId);
    }
    if (action.giveItems && Array.isArray(action.giveItems)) {
      action.giveItems.forEach((it: string) => this.host.context.inventory.addItem(it));
    }
    if (action.takeItems && Array.isArray(action.takeItems)) {
      action.takeItems.forEach((it: string) => this.host.context.inventory.removeItem(it));
    }

    // 8. Dialog Event
    if (action.dialogId) {
      console.log(`%c[ActionExecutor] 💬 Action triggering dialog: "${action.dialogId}"`, 'color: #8b5cf6; font-weight: bold;');
      if (this.host.currentScene?.playerCharacter?.data?.name) {
        this.host.context.dialog.setPlayerName(this.host.currentScene.playerCharacter.data.name);
      }
      this.host.context.dialog.startDialog(action.dialogId, (flag) => this.host.context.story.getFlag(flag));
    }

    // 9. Scene Transition Event
    if (action.targetSceneId) {
      this.host.context.story.changeScene(action.targetSceneId, action.targetSpawnPoint);
    }
  }
}
