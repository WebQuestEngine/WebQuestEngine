import { ProjectData } from '../engine/types';

export const sampleProject: ProjectData = {
  version: '1.0.0',
  title: "The Alchemist's Mystery",
  author: 'QuestEngine Team',
  startChapterId: 'ch_1',
  initialFlags: {
    hasKey: false,
    labUnlocked: false,
    talkedToAlchemist: false,
    brewedPotion: false
  },
  uiConfig: {
    preset: 'lucasarts',
    primaryColor: '#1e1b4b',
    accentColor: '#fbbf24',
    fontFamily: 'Inter, sans-serif',
    inventoryPosition: 'bottom',
    autoHideBars: false,
    showVerbText: true
  },
  chapters: [
    {
      id: 'ch_1',
      title: 'Chapter 1: The Gates of Eldoria',
      description: 'Find a way inside the Alchemist’s stronghold.',
      startStoryNodeId: 'sn_gates'
    },
    {
      id: 'ch_2',
      title: 'Chapter 2: The Secret Elixir',
      description: 'Speak with Master Eldrin and prepare the potion.',
      startStoryNodeId: 'sn_lab'
    }
  ],
  storyNodes: [
    {
      id: 'sn_gates',
      chapterId: 'ch_1',
      sceneId: 'scene_gates',
      name: 'Castle Courtyard',
      description: 'Outside the ancient castle gate.',
      position: { x: 100, y: 150 },
      connections: ['sn_lab']
    },
    {
      id: 'sn_lab',
      chapterId: 'ch_2',
      sceneId: 'scene_lab',
      name: 'Alchemist Laboratory',
      description: 'Inside Master Eldrin’s chamber.',
      position: { x: 350, y: 150 },
      connections: [],
      conditionFlag: 'labUnlocked'
    }
  ],
  scenes: [
    {
      id: 'scene_gates',
      name: 'Castle Gates',
      width: 1920,
      height: 1080,
      playerSpawn: { x: 300, y: 750 },
      layers: [
        {
          id: 'l_sky',
          name: 'Night Sky',
          imageUrl: 'procedural:castle_sky',
          parallaxX: 0.1,
          parallaxY: 0.1,
          zIndex: 1,
          opacity: 1,
          visible: true
        },
        {
          id: 'l_mountains',
          name: 'Mountains',
          imageUrl: 'procedural:castle_mountains',
          parallaxX: 0.3,
          parallaxY: 0.3,
          zIndex: 2,
          opacity: 1,
          visible: true
        },
        {
          id: 'l_bg',
          name: 'Castle Gates & Ground',
          imageUrl: 'procedural:castle_background',
          parallaxX: 1.0,
          parallaxY: 1.0,
          zIndex: 3,
          opacity: 1,
          visible: true
        }
      ],
      walkPaths: [
        {
          id: 'wp_gates',
          name: 'Courtyard Walk Area',
          enabled: true,
          points: [
            { x: 100, y: 950 },
            { x: 400, y: 650 },
            { x: 1500, y: 650 },
            { x: 1800, y: 950 }
          ],
          scaling: {
            minY: 650,
            maxY: 950,
            minScale: 0.55,
            maxScale: 1.25
          }
        }
      ],
      hotspots: [
        {
          id: 'hs_door',
          name: 'Heavy Oak Door',
          cursor: 'door',
          enabled: true,
          points: [
            { x: 640, y: 500 },
            { x: 760, y: 500 },
            { x: 760, y: 700 },
            { x: 640, y: 700 }
          ],
          actions: [
            {
              verb: 'look',
              text: 'A heavy oak door reinforced with iron bands. It requires a brass key.'
            },
            {
              verb: 'interact',
              text: 'The door is locked tight.'
            },
            {
              verb: 'use',
              requireItemId: 'item_key',
              targetSceneId: 'scene_lab',
              targetSpawnPoint: { x: 300, y: 800 },
              setFlag: 'labUnlocked',
              text: 'You unlock the door with the Brass Key!'
            }
          ]
        },
        {
          id: 'hs_shrub',
          name: 'Mysterious Shrub',
          cursor: 'interact',
          enabled: true,
          points: [
            { x: 1300, y: 720 },
            { x: 1450, y: 720 },
            { x: 1450, y: 820 },
            { x: 1300, y: 820 }
          ],
          actions: [
            {
              verb: 'look',
              text: 'A dense thorny shrub. Something gleams inside!'
            },
            {
              verb: 'pick_up',
              giveItemId: 'item_key',
              setFlag: 'hasKey',
              text: 'You reached inside the shrub and found a Brass Key!'
            },
            {
              verb: 'interact',
              text: 'You search the shrub.'
            }
          ]
        }
      ],
      characters: [
        {
          id: 'player',
          name: 'Sir Ronald',
          spriteSheetUrl: 'procedural_hero',
          frameWidth: 64,
          frameHeight: 96,
          position: { x: 300, y: 750 },
          speed: 4,
          scale: 1,
          talkColor: '#fef08a',
          animations: {
            idleDown: [0],
            idleSide: [4],
            idleUp: [8],
            walkDown: [0, 1, 2, 3],
            walkSide: [4, 5, 6, 7],
            walkUp: [8, 9, 10, 11],
            talk: [12, 13, 14, 15]
          }
        }
      ]
    },
    {
      id: 'scene_lab',
      name: 'Alchemist Laboratory',
      width: 1920,
      height: 1080,
      playerSpawn: { x: 300, y: 800 },
      layers: [
        {
          id: 'l_lab_bg',
          name: 'Laboratory Room',
          imageUrl: 'procedural:lab_background',
          parallaxX: 1.0,
          parallaxY: 1.0,
          zIndex: 1,
          opacity: 1,
          visible: true
        }
      ],
      walkPaths: [
        {
          id: 'wp_lab',
          name: 'Lab Walk Path',
          enabled: true,
          points: [
            { x: 150, y: 920 },
            { x: 300, y: 700 },
            { x: 1600, y: 700 },
            { x: 1750, y: 920 }
          ],
          scaling: {
            minY: 700,
            maxY: 920,
            minScale: 0.6,
            maxScale: 1.2
          }
        }
      ],
      hotspots: [
        {
          id: 'hs_cauldron',
          name: 'Bubbling Cauldron',
          cursor: 'interact',
          enabled: true,
          points: [
            { x: 1100, y: 650 },
            { x: 1300, y: 650 },
            { x: 1300, y: 800 },
            { x: 1100, y: 800 }
          ],
          actions: [
            {
              verb: 'look',
              text: 'A glowing cauldron brewing a magical elixir.'
            },
            {
              verb: 'use',
              requireItemId: 'item_crystal',
              giveItemId: 'item_potion',
              setFlag: 'brewedPotion',
              text: 'You drop the Glowing Crystal into the cauldron and brew the Elixir of Wisdom!'
            }
          ]
        },
        {
          id: 'hs_exit_door',
          name: 'Return to Gates',
          cursor: 'door',
          enabled: true,
          points: [
            { x: 150, y: 680 },
            { x: 320, y: 680 },
            { x: 320, y: 900 },
            { x: 150, y: 900 }
          ],
          actions: [
            {
              verb: 'interact',
              targetSceneId: 'scene_gates',
              targetSpawnPoint: { x: 700, y: 750 },
              text: 'You step back out into the courtyard.'
            }
          ]
        }
      ],
      characters: [
        {
          id: 'player',
          name: 'Sir Ronald',
          spriteSheetUrl: 'procedural_hero',
          frameWidth: 64,
          frameHeight: 96,
          position: { x: 300, y: 800 },
          speed: 4,
          scale: 1,
          talkColor: '#fef08a',
          animations: {
            idleDown: [0],
            idleSide: [4],
            idleUp: [8],
            walkDown: [0, 1, 2, 3],
            walkSide: [4, 5, 6, 7],
            walkUp: [8, 9, 10, 11],
            talk: [12, 13, 14, 15]
          }
        },
        {
          id: 'npc_eldrin',
          name: 'Master Eldrin',
          spriteSheetUrl: 'procedural_eldrin',
          frameWidth: 64,
          frameHeight: 96,
          position: { x: 900, y: 720 },
          speed: 3,
          scale: 1,
          talkColor: '#60a5fa',
          animations: {
            idleDown: [0],
            idleSide: [4],
            idleUp: [8],
            walkDown: [0, 1, 2, 3],
            walkSide: [4, 5, 6, 7],
            walkUp: [8, 9, 10, 11],
            talk: [12, 13, 14, 15]
          }
        }
      ]
    }
  ],
  items: [
    {
      id: 'item_key',
      name: 'Brass Key',
      description: 'An ornate brass key found in the shrub outside the castle.',
      iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%23fbbf24" stroke-width="2"><path d="M21 2l-2 2m-1.5 1.5L4 19.5a2.12 2.12 0 0 1-3-3L14.5 3.5M18 6l3 3"/></svg>'
    },
    {
      id: 'item_crystal',
      name: 'Glowing Crystal',
      description: 'A magical blue crystal given by Master Eldrin.',
      iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%2360a5fa" stroke-width="2"><polygon points="12 2 19 9 12 22 5 9 12 2"/></svg>'
    },
    {
      id: 'item_potion',
      name: 'Elixir of Wisdom',
      description: 'A sparkling potion brewed in Eldrin’s cauldron.',
      iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%23ec4899" stroke-width="2"><path d="M9 3h6m-3 0v4m-5 4a6 6 0 0 0 10 0l-1-4H8l-1 4z"/></svg>'
    }
  ],
  dialogs: [
    {
      id: 'dlg_eldrin',
      title: 'Conversation with Master Eldrin',
      startNodeId: 'node_1',
      nodes: {
        node_1: {
          id: 'node_1',
          speaker: 'Master Eldrin',
          text: 'Ah, Sir Ronald! You have managed to bypass my gate security. What brings you to my laboratory?',
          choices: [
            {
              id: 'c1',
              text: 'I seek the legendary Elixir of Wisdom!',
              nextNodeId: 'node_2'
            },
            {
              id: 'c2',
              text: 'Just exploring your impressive alchemy setup.',
              nextNodeId: 'node_3'
            }
          ]
        },
        node_2: {
          id: 'node_2',
          speaker: 'Master Eldrin',
          text: 'To brew the Elixir, you must drop this Glowing Crystal into my bubbling cauldron.',
          giveItem: 'item_crystal',
          choices: [
            {
              id: 'c3',
              text: 'Thank you, Master Eldrin! I shall do so at once.',
              nextNodeId: 'node_end'
            }
          ]
        },
        node_3: {
          id: 'node_3',
          speaker: 'Master Eldrin',
          text: 'Feel free to inspect the room, but do not touch the explosive compounds!',
          nextNodeId: 'node_end'
        },
        node_end: {
          id: 'node_end',
          speaker: 'Master Eldrin',
          text: 'May wisdom guide your quest.'
        }
      }
    }
  ]
};
