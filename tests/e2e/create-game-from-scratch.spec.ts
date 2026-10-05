import { test, expect } from '@playwright/test';

test.describe('Authoring Workflow: Create Game with Direct Smart Cursor', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage to ensure fresh project hub appears
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('creates a complete quest with Direct Smart Cursor, background, 2 characters, walkpath, and dialog', async ({ page }) => {
    // ------------------------------------------------------------------------
    // Step 1: Create New Project via Project Hub with Direct Smart Cursor
    // ------------------------------------------------------------------------
    const hubModal = page.locator('#project-hub-window');
    await expect(hubModal).toBeVisible();

    // Fill Title and Author
    const titleInput = page.locator('#input-new-quest-title');
    await titleInput.fill('The Lost Amulet');

    const authorInput = page.locator('#input-new-quest-author');
    await authorInput.fill('Quest Master');

    // Select Direct Smart Cursor preset
    const directCursorCard = page.locator('.hub-preset-card[data-preset="direct_cursor"]');
    await directCursorCard.click();
    await expect(directCursorCard).toHaveClass(/selected/);

    // Confirm creation
    await page.locator('#btn-create-quest-confirm').click();

    // Verify modal dismissed and canvas loaded
    await expect(hubModal).toBeHidden();
    const canvas = page.locator('#canvas-container canvas');
    await expect(canvas).toBeVisible();

    // ------------------------------------------------------------------------
    // Step 2: Add a Background Layer
    // ------------------------------------------------------------------------
    // Click Add Layer button in Project Tree header
    await page.locator('#btn-tree-add-layer').click();

    // Configure layer in Layer Inspector
    const layerNameInput = page.locator('.single-layer-name').first();
    await expect(layerNameInput).toBeVisible();
    await layerNameInput.fill('Dungeon Wall');
    await layerNameInput.dispatchEvent('input');

    // Verify layer is reflected in the project tree
    await expect(page.locator('.tree-item[data-type="layer"]', { hasText: 'Dungeon Wall' })).toBeVisible();

    // ------------------------------------------------------------------------
    // Step 3: Add and Configure Characters (Hero + NPC)
    // ------------------------------------------------------------------------
    // Default Hero already exists in starter project; add second character (NPC)
    await page.locator('#btn-tree-add-char').click();

    // Character Inspector opens for the new NPC
    const charNameInput = page.locator('.char-name').first();
    await expect(charNameInput).toBeVisible();
    await charNameInput.fill('Old Mage');
    await charNameInput.dispatchEvent('input');

    const posXInput = page.locator('.char-pos-x').first();
    if (await posXInput.isVisible()) {
      await posXInput.fill('960');
      await posXInput.dispatchEvent('input');
    }

    // Assert both characters exist in the tree
    await expect(page.locator('.tree-item[data-type="character"]', { hasText: 'Hero' })).toBeVisible();
    await expect(page.locator('.tree-item[data-type="character"]', { hasText: 'Old Mage' })).toBeVisible();

    // ------------------------------------------------------------------------
    // Step 4: Configure Scene Walk Path
    // ------------------------------------------------------------------------
    // Click WalkPath node in project tree to open WalkPath Inspector
    await page.locator('.tree-item[data-type="walkpath"]').first().click();

    // Start drawing polygon walk path
    const drawWalkpathBtn = page.locator('#btn-draw-wp-scratch');
    await expect(drawWalkpathBtn).toBeVisible();
    await drawWalkpathBtn.click();

    // Click 4 points on the canvas to form a walkable floor polygon
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      // Click four points around bottom floor to define polygon
      await page.mouse.click(centerX - 250, centerY + 100);
      await page.mouse.click(centerX + 250, centerY + 100);
      await page.mouse.click(centerX + 250, centerY + 220);
      // Close polygon by clicking near starting point
      await page.mouse.click(centerX - 250, centerY + 100);
    }

    // Configure perspective scaling if input visible
    const minScaleInput = page.locator('#wp-min-scale');
    if (await minScaleInput.isVisible()) {
      await minScaleInput.fill('0.8');
      await minScaleInput.dispatchEvent('input');
    }

    // ------------------------------------------------------------------------
    // Step 5: Open Dialog Editor and Add Branching Dialogue
    // ------------------------------------------------------------------------
    // Open Dialog Flowchart Studio from top toolbar
    await page.locator('#btn-dialog-tree').click();
    const dialogModal = page.locator('.dialog-editor-container');
    await expect(dialogModal).toBeVisible();

    // Create a new dialogue sequence
    await page.locator('#btn-add-tree').click();
    const treeTitleInput = page.locator('#tree-title-input');
    await expect(treeTitleInput).toBeVisible();
    await treeTitleInput.fill('Mage Conversation');
    await treeTitleInput.dispatchEvent('input');

    // Configure starting beat node text
    const firstSpeechNode = page.locator('.dialog-graph-card').first();
    await expect(firstSpeechNode).toBeVisible();

    const textInput = firstSpeechNode.locator('.node-text');
    await textInput.fill('Greetings traveler. What brings you to these ruins?');
    await textInput.dispatchEvent('input');

    // Add response node
    await page.locator('#btn-add-beat-node').click();
    const secondSpeechNode = page.locator('.dialog-graph-card').nth(1);
    await expect(secondSpeechNode).toBeVisible();
    await secondSpeechNode.locator('.node-text').fill('Beware! Danger lies ahead.');
    await secondSpeechNode.locator('.node-text').dispatchEvent('input');

    // Close Dialog Editor via close button
    await page.locator('#btn-close-dialog-editor').click();
    await expect(dialogModal).toBeHidden();

    // ------------------------------------------------------------------------
    // Step 6: Verify in Play Mode with Direct Smart Cursor
    // ------------------------------------------------------------------------
    // Click Play Test button in toolbar
    const playToggleBtn = page.locator('#btn-play-toggle');
    await playToggleBtn.click();

    // Verify runtime initialized
    await expect(page.locator('#play-text')).toHaveText('Pause Editor');

    // Verify Direct Smart Cursor HUD elements
    await expect(page.locator('.direct-verb-bar')).toBeVisible();
    await expect(page.locator('.direct-inv-dock')).toBeVisible();
    await expect(page.locator('#ui-action-sentence')).toBeVisible();

    // Verify default active verb is "Walk"
    await expect(page.locator('.direct-verb-bar .verb-btn[data-verb="walk"]')).toHaveClass(/active/);

    // Return to editor mode cleanly via the floating exit bar
    await page.locator('#btn-exit-play-bar').click();
    await expect(page.locator('#play-text')).toHaveText('Play Test');
  });
});
