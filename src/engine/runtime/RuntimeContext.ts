import { ProjectData, AudioConfig, UIConfig } from '../types';
import { EventBus } from '../core/EventBus';
import { AudioSystem } from '../systems/AudioSystem';
import { DialogSystem } from '../systems/DialogSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { StoryGraphSystem } from '../systems/StoryGraphSystem';
import { UISystem } from '../systems/UISystem';
import { PathfindingSystem } from '../systems/PathfindingSystem';

export class RuntimeContext {
  public eventBus: EventBus;
  public audio: AudioSystem;
  public dialog: DialogSystem;
  public inventory: InventorySystem;
  public story: StoryGraphSystem;
  public ui: UISystem;
  public pathfinding: PathfindingSystem;
  public project: ProjectData;

  constructor(project: ProjectData, uiContainerElement: HTMLElement) {
    this.project = project;
    this.eventBus = new EventBus();

    this.audio = new AudioSystem();
    if (project.audioConfig) {
      this.audio.setConfig(project.audioConfig);
    }
    this.audio.setPlayMode(true);

    this.dialog = new DialogSystem();
    this.inventory = new InventorySystem();
    this.story = new StoryGraphSystem();
    this.ui = new UISystem();
    this.pathfinding = new PathfindingSystem();

    // Initialize systems with project data
    this.story.loadProject(project);

    this.inventory.clear();
    if (project.items) {
      for (const item of project.items) {
        this.inventory.registerItem(item);
      }
    }

    // Set active singleton proxies for play mode
    StoryGraphSystem.setInstance(this.story);
    InventorySystem.setInstance(this.inventory);
    DialogSystem.setInstance(this.dialog);
    UISystem.setInstance(this.ui);
    AudioSystem.setInstance(this.audio);
  }

  public destroy(): void {
    this.audio.stopAll();
    this.audio.setPlayMode(false);
    this.dialog.endDialog();
    this.inventory.clear();
    this.ui.destroy();
    this.eventBus.clear();

    StoryGraphSystem.setInstance(null);
    InventorySystem.setInstance(null);
    DialogSystem.setInstance(null);
    UISystem.setInstance(null);
    AudioSystem.setInstance(null);
  }
}
