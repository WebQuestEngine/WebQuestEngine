export class FileAccessAdapter {
  private static activeFileHandle: any = null;
  private static activeFilename: string = "the_alchemist's_mystery.json";

  public static getActiveFilename(): string {
    return this.activeFilename;
  }

  public static hasFileHandle(): boolean {
    return this.activeFileHandle !== null;
  }

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
        this.activeFileHandle = handle;
        this.activeFilename = file.name;
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
          this.activeFileHandle = null;
          this.activeFilename = file.name;
          resolve({ content, filename: file.name });
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }

  /**
   * DIRECT SAVE: Writes directly to local disk without opening ANY dialog modal!
   */
  public static async saveProjectFile(content: string, defaultFilename = "the_alchemist's_mystery.json"): Promise<boolean> {
    // 1. Try HTML5 File System Handle if available
    if (this.activeFileHandle) {
      try {
        if (this.activeFileHandle.queryPermission) {
          const status = await this.activeFileHandle.queryPermission({ mode: 'readwrite' });
          if (status !== 'granted') {
            await this.activeFileHandle.requestPermission({ mode: 'readwrite' });
          }
        }
        const writable = await this.activeFileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
      } catch (err: any) {
        console.warn('Direct file handle write failed, trying dev server API', err);
      }
    }

    // 2. Try Dev Server Direct File Save Endpoint (zero dialogs)
    try {
      const parsedData = JSON.parse(content);
      const targetName = this.activeFilename || defaultFilename;
      const res = await fetch('/api/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: targetName, data: parsedData })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return true;
      }
    } catch (err: any) {
      console.warn('Dev server direct save failed, trying fallback download', err);
    }

    // 3. Fallback direct Blob download
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.activeFilename || defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * SAVE AS: Explicitly opens file picker modal
   */
  public static async saveProjectFileAs(content: string, defaultFilename = "the_alchemist's_mystery.json"): Promise<boolean> {
    const suggested = this.activeFilename || defaultFilename;
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: suggested,
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
        this.activeFileHandle = handle;
        const file = await handle.getFile();
        this.activeFilename = file.name;
        return true;
      } catch (err: any) {
        if (err.name === 'AbortError') return false;
        console.warn('File System Access API save failed', err);
      }
    }

    return this.saveProjectFile(content, defaultFilename);
  }

  /**
   * Legacy compatibility method
   */
  public static async saveLocalProjectFile(content: string, defaultFilename = "the_alchemist's_mystery.json"): Promise<boolean> {
    return this.saveProjectFile(content, defaultFilename);
  }
}
