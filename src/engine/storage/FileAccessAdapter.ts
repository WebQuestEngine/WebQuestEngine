export class FileAccessAdapter {
  /**
   * Open a project JSON file from the user's local disk using HTML5 File System Access API
   */
  public static async openLocalProjectFile(): Promise<{ content: string; filename: string } | null> {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Quest Engine Project JSON',
              accept: { 'application/json': ['.json'] }
            }
          ],
          multiple: false
        });
        const file = await handle.getFile();
        const content = await file.text();
        return { content, filename: file.name };
      } catch (err: any) {
        if (err.name === 'AbortError') return null;
        console.warn('File System Access API failed, trying fallback input picker', err);
      }
    }

    // Fallback standard web picker
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        if (input.files && input.files[0]) {
          const file = input.files[0];
          const content = await file.text();
          resolve({ content, filename: file.name });
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }

  /**
   * Save a project JSON file directly to local disk using HTML5 File System Access API
   */
  public static async saveLocalProjectFile(content: string, defaultFilename = 'quest_project.json'): Promise<boolean> {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [
            {
              description: 'Quest Engine Project JSON',
              accept: { 'application/json': ['.json'] }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
      } catch (err: any) {
        if (err.name === 'AbortError') return false;
        console.warn('File System Access API save failed, falling back to download', err);
      }
    }

    // Fallback blob download
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }
}
