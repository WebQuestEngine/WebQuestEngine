import { Application } from 'pixi.js';
import { EventBus } from '../core/EventBus';
import { Camera } from '../core/Camera';
import { Scene } from '../scene/Scene';
import { Character } from '../scene/Character';
import { Hotspot } from '../scene/Hotspot';
import { Vector2D, VerbType, HotspotAction } from '../types';
import { RuntimeContext } from './RuntimeContext';
import { LetterboxManager } from './LetterboxManager';

export interface InputHost {
  readonly isDestroyed: boolean;
  readonly isPaused: boolean;
  readonly currentScene: Scene | null;
  readonly camera: Camera;
  readonly context: RuntimeContext;
  readonly app: Application;
  checkAndTriggerEvent(scope: 'game' | 'scene' | 'hotspot' | 'character' | 'item', targetId: string, eventName: string): boolean;
  executeAction(action: any, targetPos?: Vector2D, targetElement?: any): void;
}

export class InputHandler {
  private host: InputHost;
  private letterboxManager: LetterboxManager;

  private currentHoverTarget: Hotspot | Character | null = null;
  private targetActionIndex = 0;
  private lastMouseWorldPos: Vector2D | null = null;
  private cleanupListeners: (() => void)[] = [];

  constructor(host: InputHost, letterboxManager: LetterboxManager) {
    this.host = host;
    this.letterboxManager = letterboxManager;
  }

  public setupInputListeners(): void {
    const canvas = this.host.app.canvas;

    const onKeyDown = (e: KeyboardEvent) => {
      if (this.host.isDestroyed) return;
      if (e.key === 'Escape' && !this.host.context.dialog.isActive()) {
        this.host.context.ui.toggleMenu();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    this.cleanupListeners.push(() => window.removeEventListener('keydown', onKeyDown));

    const onClick = (e: MouseEvent) => {
      if (this.host.isDestroyed) return;
      this.handleCanvasClick(e);
    };
    canvas.addEventListener('click', onClick);
    this.cleanupListeners.push(() => canvas.removeEventListener('click', onClick));

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (this.host.isDestroyed) return;
      this.handleCanvasRightClick(e);
    };
    canvas.addEventListener('contextmenu', onContextMenu);
    this.cleanupListeners.push(() => canvas.removeEventListener('contextmenu', onContextMenu));

    const onMouseMove = (e: MouseEvent) => {
      if (this.host.isDestroyed) return;
      this.handleCanvasMouseMove(e);
    };
    canvas.addEventListener('mousemove', onMouseMove);
    this.cleanupListeners.push(() => canvas.removeEventListener('mousemove', onMouseMove));

    const onMouseLeave = () => {
      if (this.host.isDestroyed) return;
      this.host.context.ui.showPointerCursor();
    };
    canvas.addEventListener('mouseleave', onMouseLeave);
    this.cleanupListeners.push(() => canvas.removeEventListener('mouseleave', onMouseLeave));

    const onMouseEnter = (e: MouseEvent) => {
      if (this.host.isDestroyed) return;
      this.host.context.ui.isHoveringUI = false;
      this.handleCanvasMouseMove(e);
    };
    canvas.addEventListener('mouseenter', onMouseEnter);
    this.cleanupListeners.push(() => canvas.removeEventListener('mouseenter', onMouseEnter));

    const onWheel = (e: WheelEvent) => {
      if (this.host.isDestroyed) return;
      this.handleCanvasWheel(e);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    this.cleanupListeners.push(() => canvas.removeEventListener('wheel', onWheel));

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    canvas.addEventListener('dragover', onDragOver);
    this.cleanupListeners.push(() => canvas.removeEventListener('dragover', onDragOver));

    const onDrop = (e: DragEvent) => {
      if (this.host.isDestroyed) return;
      this.handleCanvasDrop(e);
    };
    canvas.addEventListener('drop', onDrop);
    this.cleanupListeners.push(() => canvas.removeEventListener('drop', onDrop));
  }

  public getWorldPoint(e: MouseEvent): Vector2D {
    return this.letterboxManager.screenToWorld(
      this.host.app.canvas,
      e.clientX,
      e.clientY,
      this.host.camera.viewport,
      this.host.context.project.viewportSettings
    );
  }

  private handleCanvasClick(e: MouseEvent): void {
    if (
      this.host.isDestroyed ||
      !this.host.currentScene ||
      this.host.context.dialog.isActive() ||
      this.host.isPaused ||
      this.host.context.ui.isMenuOpen()
    ) {
      return;
    }

    const worldPoint = this.getWorldPoint(e);
    const selectedItem = this.host.context.inventory.getSelectedItem();
    const hotspot = this.host.currentScene.findHotspotAt(worldPoint);
    const charNPC = this.host.currentScene.findCharacterAt(worldPoint);
    const player = this.host.currentScene.playerCharacter;
    const walkPath = this.host.currentScene.getWalkPath();
    const preset = this.host.context.project.uiConfig.preset;

    // 1. If an item is held -> Use item on Hotspot or NPC
    if (selectedItem && (hotspot || charNPC)) {
      const targetHotspot =
        hotspot || (charNPC ? this.host.currentScene.findHotspotAt({ x: charNPC.container.x, y: charNPC.container.y - 40 }) : null);

      if (targetHotspot) {
        const action = targetHotspot.getActionForItemId(selectedItem.id) || targetHotspot.getBestAction('use', selectedItem.id);
        const targetCenter = targetHotspot.getCenter();
        if (action) {
          if (player) {
            player.walkTo(targetCenter, walkPath, () => this.host.executeAction(action, targetCenter));
          } else {
            this.host.executeAction(action, targetCenter);
          }
        } else {
          if (player) {
            player.walkTo(targetCenter, walkPath, () => {
              EventBus.getInstance().emit('ui:notify', `Using ${selectedItem.name} on ${targetHotspot.data.name} has no effect.`);
            });
          }
        }
      } else if (charNPC) {
        if (player) {
          player.walkTo(charNPC.position, walkPath, () => {
            EventBus.getInstance().emit('ui:notify', `Giving ${selectedItem.name} to ${charNPC.data.name} has no effect.`);
          });
        }
      }

      this.host.context.inventory.selectItem(null);
      this.host.context.ui.setActiveVerb('walk');
      return;
    }

    // 2. Context Coin Menu Trigger
    if (!selectedItem && (hotspot || charNPC) && preset === 'context_coin') {
      const rect = this.host.app.canvas.getBoundingClientRect();
      this.host.context.ui.showContextCoin(e.clientX - rect.left, e.clientY - rect.top);
      return;
    }

    this.host.context.ui.hideContextCoin();

    // 3. NPC Interaction with Walk-to-Actor
    if (charNPC && charNPC !== player) {
      const available = this.getAvailableActionsForTarget(charNPC);
      const chosen = available[this.targetActionIndex % available.length] || available[0];

      let action: HotspotAction | undefined;
      if (chosen.itemId) {
        action = charNPC.getActionForItemId(chosen.itemId);
      } else {
        action = charNPC.getBestAction(chosen.verb);
      }

      if (!action) {
        action = charNPC.getBestAction();
      }

      if (action) {
        if (player) {
          player.walkTo(charNPC.position, walkPath, () => {
            const triggered =
              this.host.checkAndTriggerEvent('character', charNPC.data.id, chosen.verb) ||
              this.host.checkAndTriggerEvent('character', charNPC.data.id, 'interact');
            if (triggered) return;
            this.host.executeAction(action, charNPC.position);
          });
        } else {
          const triggered =
            this.host.checkAndTriggerEvent('character', charNPC.data.id, chosen.verb) ||
            this.host.checkAndTriggerEvent('character', charNPC.data.id, 'interact');
          if (triggered) return;
          this.host.executeAction(action, charNPC.position);
        }
        return;
      }

      if (charNPC.data.actions && charNPC.data.actions[0]?.dialogId) {
        const dialogId = charNPC.data.actions[0].dialogId;
        if (player) {
          player.walkTo(charNPC.position, walkPath, () => {
            const triggered =
              this.host.checkAndTriggerEvent('character', charNPC.data.id, chosen.verb) ||
              this.host.checkAndTriggerEvent('character', charNPC.data.id, 'interact');
            if (triggered) return;
            if (this.host.currentScene?.playerCharacter?.data?.name) {
              this.host.context.dialog.setPlayerName(this.host.currentScene.playerCharacter.data.name);
            }
            this.host.context.dialog.startDialog(dialogId, (flag) => this.host.context.story.getFlag(flag));
          });
        } else {
          const triggered =
            this.host.checkAndTriggerEvent('character', charNPC.data.id, chosen.verb) ||
            this.host.checkAndTriggerEvent('character', charNPC.data.id, 'interact');
          if (triggered) return;
          if (this.host.currentScene?.playerCharacter?.data?.name) {
            this.host.context.dialog.setPlayerName(this.host.currentScene.playerCharacter.data.name);
          }
          this.host.context.dialog.startDialog(dialogId, (flag) => this.host.context.story.getFlag(flag));
        }
        return;
      }

      if (player) {
        player.walkTo(charNPC.position, walkPath, () => {
          const triggered =
            this.host.checkAndTriggerEvent('character', charNPC.data.id, chosen.verb) ||
            this.host.checkAndTriggerEvent('character', charNPC.data.id, 'interact');
          if (triggered) return;
          if (chosen.verb === 'talk') this.host.context.ui.showSubtitle("They don't have much to say.");
          else if (chosen.verb === 'look') this.host.context.ui.showSubtitle(`It's ${charNPC.data.name}.`);
          else this.host.context.ui.showSubtitle("That doesn't seem to work.");
        });
      }
      return;
    }

    // 4. Hotspot Interaction with Walk-to-Object
    if (hotspot) {
      const available = this.getAvailableActionsForTarget(hotspot);
      const chosen = available[this.targetActionIndex % available.length] || available[0];

      let action: HotspotAction | undefined;
      if (chosen.itemId) {
        action = hotspot.getActionForItemId(chosen.itemId);
      } else {
        action = hotspot.getBestAction(chosen.verb);
      }

      if (!action) {
        action = hotspot.getBestAction();
      }

      if (action?.verb === 'look' || chosen.verb === 'look') {
        hotspot.isExamined = true;
        hotspot.data.examined = true;
      }

      const targetCenter = hotspot.getCenter();
      if (action) {
        if (player) {
          player.walkTo(targetCenter, walkPath, () => {
            const triggered =
              this.host.checkAndTriggerEvent('hotspot', hotspot.data.id, chosen.verb) ||
              this.host.checkAndTriggerEvent('hotspot', hotspot.data.id, 'interact');
            if (triggered) return;
            this.host.executeAction(action, targetCenter);
          });
        } else {
          const triggered =
            this.host.checkAndTriggerEvent('hotspot', hotspot.data.id, chosen.verb) ||
            this.host.checkAndTriggerEvent('hotspot', hotspot.data.id, 'interact');
          if (triggered) return;
          this.host.executeAction(action, targetCenter);
        }
      } else {
        if (player) {
          player.walkTo(targetCenter, walkPath, () => {
            const triggered =
              this.host.checkAndTriggerEvent('hotspot', hotspot.data.id, chosen.verb) ||
              this.host.checkAndTriggerEvent('hotspot', hotspot.data.id, 'interact');
            if (triggered) return;
            if (chosen.verb === 'talk') this.host.context.ui.showSubtitle("It doesn't talk.");
            else if (chosen.verb === 'look') this.host.context.ui.showSubtitle(`It's ${hotspot.data.name}.`);
            else this.host.context.ui.showSubtitle("That doesn't seem to work.");
          });
        } else {
          const triggered =
            this.host.checkAndTriggerEvent('hotspot', hotspot.data.id, chosen.verb) ||
            this.host.checkAndTriggerEvent('hotspot', hotspot.data.id, 'interact');
          if (triggered) return;
          if (chosen.verb === 'talk') this.host.context.ui.showSubtitle("It doesn't talk.");
          else if (chosen.verb === 'look') this.host.context.ui.showSubtitle(`It's ${hotspot.data.name}.`);
          else this.host.context.ui.showSubtitle("That doesn't seem to work.");
        }
      }
      return;
    }

    // 5. Empty ground click -> Walk
    if (player) {
      player.walkTo(worldPoint, walkPath);
    }
  }

  public getAvailableActionsForTarget(
    target: Hotspot | Character
  ): { verb: VerbType; itemId?: string; label: string; action?: HotspotAction }[] {
    const list: { verb: VerbType; itemId?: string; label: string; action?: HotspotAction }[] = [];
    const storySystem = this.host.context.story;
    const inventory = this.host.context.inventory;
    const heldItems = inventory.getItems();
    const seenKeys = new Set<string>();

    if (target.data.actions && target.data.actions.length > 0) {
      for (const act of target.data.actions) {
        // Check flag requirements
        if (act.requiredFlag && !storySystem.getFlag(act.requiredFlag)) continue;
        if (act.notFlag && storySystem.getFlag(act.notFlag)) continue;

        if (act.requireItemId) {
          // Only available if player currently possesses this item
          const hasItem = heldItems.some(i => i.id === act.requireItemId);
          if (hasItem) {
            const item = heldItems.find(i => i.id === act.requireItemId)!;
            const key = `item:${item.id}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              list.push({
                verb: 'use',
                itemId: item.id,
                label: `Use ${item.name} on`,
                action: act
              });
            }
          }
        } else {
          const actVerb = (act.verb === 'use' ? 'interact' : act.verb) as VerbType;
          if (!seenKeys.has(actVerb)) {
            seenKeys.add(actVerb);
            const verbLabels: Record<string, string> = {
              walk: 'Walk to',
              look: 'Look at',
              interact: 'Use',
              talk: 'Talk to',
              pick_up: 'Pick up'
            };
            list.push({
              verb: actVerb,
              label: verbLabels[actVerb] || actVerb,
              action: act
            });
          }
        }
      }
    }

    // Fallback if no specific actions matched
    if (list.length === 0) {
      const fallbackVerb = (target.data.cursor as VerbType) || (target instanceof Character ? 'talk' : 'interact');
      list.push({
        verb: fallbackVerb,
        label: fallbackVerb === 'talk' ? 'Talk to' : (fallbackVerb === 'look' ? 'Look at' : 'Use')
      });
    }

    return list;
  }

  private handleCanvasRightClick(e: MouseEvent): void {
    if (this.host.isDestroyed || !this.host.currentScene) return;

    const selectedItem = this.host.context.inventory.getSelectedItem();

    // 1. Right-click with held item or manual tool selection -> reset to walk / default
    if (selectedItem || this.targetActionIndex !== 0) {
      this.host.context.inventory.selectItem(null);
      this.targetActionIndex = 0;
      this.host.context.ui.setActiveVerb('walk');
      this.updateCursorAndHover(this.lastMouseWorldPos);
      return;
    }

    const worldPoint = this.getWorldPoint(e);
    const hotspot = this.host.currentScene.findHotspotAt(worldPoint);
    const charNPC = this.host.currentScene.findCharacterAt(worldPoint);

    // 2. Right-click in Context Coin mode -> Open coin
    if ((hotspot || charNPC) && this.host.context.project.uiConfig.preset === 'context_coin') {
      const rect = this.host.app.canvas.getBoundingClientRect();
      this.host.context.ui.showContextCoin(e.clientX - rect.left, e.clientY - rect.top);
      return;
    }

    // 3. Right-click on Hotspot / NPC -> Trigger Look At
    if (hotspot || charNPC) {
      const available = this.getAvailableActionsForTarget(hotspot || charNPC!);
      const lookIdx = available.findIndex(a => a.verb === 'look');
      if (lookIdx !== -1) {
        this.targetActionIndex = lookIdx;
      }
      this.handleCanvasClick(e);
    }
  }

  private handleCanvasMouseMove(e: MouseEvent): void {
    if (this.host.isDestroyed || !this.host.currentScene) return;

    if (this.host.context.ui.isHoveringUI) {
      this.host.context.ui.showPointerCursor();
      return;
    }

    const worldPt = this.getWorldPoint(e);
    this.lastMouseWorldPos = worldPt;

    const hotspot = this.host.currentScene.findHotspotAt(worldPt);
    const charNPC = this.host.currentScene.findCharacterAt(worldPt);
    const targetElem = hotspot || charNPC || null;

    if (targetElem !== this.currentHoverTarget) {
      this.currentHoverTarget = targetElem;
      this.targetActionIndex = 0;
    }

    this.updateCursorAndHover(worldPt);
  }

  public updateCursorAndHover(worldPt: Vector2D | null): void {
    if (this.host.isDestroyed || !this.host.currentScene) return;

    if (this.host.context.ui.isHoveringUI) {
      this.host.context.ui.showPointerCursor();
      return;
    }

    const pt = worldPt || { x: 0, y: 0 };

    const hotspot = this.host.currentScene.findHotspotAt(pt);
    const charNPC = this.host.currentScene.findCharacterAt(pt);
    const targetElem = hotspot || charNPC;
    const selectedItem = this.host.context.inventory.getSelectedItem();
    const uiConfig = this.host.context.project.uiConfig;

    if (selectedItem) {
      this.host.app.canvas.style.cursor = 'none';
      this.host.context.ui.updateCustomCursor(selectedItem.iconUrl, 16, 16);
      if (targetElem) {
        this.host.context.ui.updateHoverTitle(`Use ${selectedItem.name} on ${targetElem.data.name}`);
      } else {
        this.host.context.ui.clearHoverTitle();
      }
      return;
    }

    if (!targetElem) {
      // Outside any object: default to Walk
      this.host.context.ui.setActiveVerb('walk');
      const walkCursor = uiConfig?.customCursors?.['walk'];
      if (walkCursor?.url) {
        this.host.app.canvas.style.cursor = 'none';
        this.host.context.ui.updateCustomCursor(walkCursor.url, walkCursor.hotspotX ?? 0, walkCursor.hotspotY ?? 0);
      } else {
        this.host.context.ui.showPointerCursor();
      }
      this.host.context.ui.clearHoverTitle();
      return;
    }

    // Over an object: resolve currently selected available action
    const available = this.getAvailableActionsForTarget(targetElem);
    const chosen = available[this.targetActionIndex % available.length] || available[0];

    this.host.context.ui.setActiveVerb(chosen.verb);

    // Custom cursor follower
    if (chosen.itemId) {
      const item = this.host.context.inventory.getItems().find(i => i.id === chosen.itemId);
      this.host.app.canvas.style.cursor = 'none';
      this.host.context.ui.updateCustomCursor(item?.iconUrl || null, 16, 16);
    } else if ((targetElem.data as any).customCursorUrl) {
      this.host.app.canvas.style.cursor = 'none';
      this.host.context.ui.updateCustomCursor(
        (targetElem.data as any).customCursorUrl,
        (targetElem.data as any).customCursorHotspotX ?? 0,
        (targetElem.data as any).customCursorHotspotY ?? 0
      );
    } else if (uiConfig?.customCursors?.[chosen.verb]?.url) {
      const cConfig = uiConfig.customCursors[chosen.verb]!;
      this.host.app.canvas.style.cursor = 'none';
      this.host.context.ui.updateCustomCursor(cConfig.url, cConfig.hotspotX ?? 0, cConfig.hotspotY ?? 0);
    } else if (chosen.verb === 'pointer' || chosen.verb === ('arrow' as any)) {
      this.host.app.canvas.style.cursor = 'none';
      this.host.context.ui.showPointerCursor();
    } else {
      this.host.context.ui.updateCustomCursor(null);
      this.host.app.canvas.style.cursor = 'pointer';
    }

    // Contextual hover label
    const label = `${chosen.label} ${targetElem.data.name}`;
    this.host.context.ui.updateHoverTitle(label);
  }

  private handleCanvasDrop(e: DragEvent): void {
    e.preventDefault();
    if (this.host.isDestroyed || !this.host.currentScene) return;
    const itemId = e.dataTransfer?.getData('text/plain') || this.host.context.inventory.getSelectedItem()?.id;
    if (!itemId) return;

    const worldPoint = this.getWorldPoint(e as any);
    const hotspot = this.host.currentScene.findHotspotAt(worldPoint);
    const charNPC = this.host.currentScene.findCharacterAt(worldPoint);
    const player = this.host.currentScene.playerCharacter;
    const walkPath = this.host.currentScene.getWalkPath();
    const itemData = this.host.context.inventory.getItems().find(i => i.id === itemId);

    if (hotspot) {
      const action = hotspot.getActionForItemId(itemId) || hotspot.getBestAction('use', itemId);
      const targetCenter = hotspot.getCenter();
      if (action) {
        if (player) {
          player.walkTo(targetCenter, walkPath, () => this.host.executeAction(action, targetCenter));
        } else {
          this.host.executeAction(action, targetCenter);
        }
      } else {
        if (player) {
          player.walkTo(targetCenter, walkPath, () => {
            EventBus.getInstance().emit('ui:notify', `Using ${itemData?.name || itemId} on ${hotspot.data.name} has no effect.`);
          });
        }
      }
    } else if (charNPC) {
      if (player) {
        player.walkTo(charNPC.position, walkPath, () => {
          EventBus.getInstance().emit('ui:notify', `Giving ${itemData?.name || itemId} to ${charNPC.data.name} has no effect.`);
        });
      }
    }

    this.host.context.inventory.selectItem(null);
    this.targetActionIndex = 0;
    this.host.context.ui.setActiveVerb('walk');
  }

  private handleCanvasWheel(e: WheelEvent): void {
    e.preventDefault();
    if (this.host.isDestroyed || !this.host.currentScene) return;

    const worldPt = this.lastMouseWorldPos || { x: 0, y: 0 };
    const hotspot = this.host.currentScene.findHotspotAt(worldPt);
    const charNPC = this.host.currentScene.findCharacterAt(worldPt);
    const targetElem = hotspot || charNPC;

    if (targetElem) {
      // Over an object: cycle ONLY through available actions defined on this target
      const available = this.getAvailableActionsForTarget(targetElem);
      if (available.length > 1) {
        const step = e.deltaY > 0 ? 1 : -1;
        this.targetActionIndex = (this.targetActionIndex + step + available.length) % available.length;
      }
    } else {
      // Outside any object: cycle through held inventory items or return to Walk
      const items = this.host.context.inventory.getItems();
      if (items.length > 0) {
        const itemIds: (string | null)[] = [null, ...items.map(i => i.id)];
        const currentSelected = this.host.context.inventory.getSelectedItem()?.id || null;
        const currentIdx = itemIds.indexOf(currentSelected);
        const step = e.deltaY > 0 ? 1 : -1;
        const nextIdx = (currentIdx + step + itemIds.length) % itemIds.length;
        const nextId = itemIds[nextIdx];
        this.host.context.inventory.selectItem(nextId);
        this.host.context.ui.setActiveVerb(nextId ? 'use' : 'walk');
      }
    }

    this.updateCursorAndHover(this.lastMouseWorldPos);
  }

  public destroy(): void {
    this.cleanupListeners.forEach(cleanup => cleanup());
    this.cleanupListeners = [];
  }
}
