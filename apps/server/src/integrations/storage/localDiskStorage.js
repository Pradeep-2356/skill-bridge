/**
 * File storage adapter backed by the local disk (SB1/US17).
 * Interface: save(buffer, { folder, ext }) → { key, url } and remove(key).
 * Next semester an S3 adapter with the same interface replaces this file.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export function createLocalDiskStorage({ rootDir, publicPath = '/uploads' }) {
  const root = path.resolve(rootDir);

  /** Resolves a key inside the upload root; refuses anything that escapes it. */
  function safePath(key) {
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error(`Refusing to access a path outside uploads: ${key}`);
    return full;
  }

  return {
    kind: 'local-disk',
    rootDir: root,
    async save(buffer, { folder = 'misc', ext = 'bin' } = {}) {
      const key = `${folder}/${crypto.randomUUID()}.${ext}`;
      const full = safePath(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buffer);
      return { key, url: `${publicPath}/${key}` };
    },
    async remove(key) {
      if (!key) return;
      try {
        await fs.unlink(safePath(key));
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    },
  };
}
