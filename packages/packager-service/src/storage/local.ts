import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readFile, unlink, readdir, access, stat } from 'fs/promises';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';
import type { StorageAdapter } from './types.js';
import { config } from '../utils/config.js';

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || config.localStoragePath;
  }

  private getFullPath(filePath: string): string {
    return path.join(this.basePath, filePath);
  }

  async write(filePath: string, data: Buffer | Readable): Promise<void> {
    const fullPath = this.getFullPath(filePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await mkdir(dir, { recursive: true });

    if (data instanceof Buffer) {
      const { writeFile } = await import('fs/promises');
      await writeFile(fullPath, data);
    } else {
      const writeStream = createWriteStream(fullPath);
      await pipeline(data, writeStream);
    }
  }

  async read(filePath: string): Promise<Buffer> {
    const fullPath = this.getFullPath(filePath);
    return readFile(fullPath);
  }

  createReadStream(filePath: string): Readable {
    const fullPath = this.getFullPath(filePath);
    return createReadStream(fullPath);
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(filePath);
    try {
      await access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = this.getFullPath(filePath);
    await unlink(fullPath);
  }

  async list(prefix: string): Promise<string[]> {
    const fullPath = this.getFullPath(prefix);
    const files: string[] = [];

    async function walk(dir: string) {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(entryPath);
        } else {
          files.push(entryPath);
        }
      }
    }

    try {
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        await walk(fullPath);
      } else {
        files.push(fullPath);
      }
    } catch {
      // Directory doesn't exist, return empty list
    }

    // Return relative paths
    return files.map((f) => path.relative(this.basePath, f));
  }

  getUrl(filePath: string): string {
    // For local storage, return a path that can be served by nginx
    return `/content/${filePath}`;
  }
}
