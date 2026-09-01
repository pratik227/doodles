#!/usr/bin/env node
/**
 * Finish the static site.
 *
 * `tsdown` has already bundled the playground into the publish directory --
 * this drops the page in beside it, adds a 404, and reports the total weight.
 */

import { cp, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const out = process.argv[2] || 'dist'

await cp('web/index.html', join(out, 'index.html'))

// A 404 page keeps deep links from looking broken.
await writeFile(join(out, '404.html'),
  '<!doctype html><meta charset="utf-8"><title>not found</title>'
  + '<meta http-equiv="refresh" content="0;url=/">')

const files: string[] = []
async function walk(dir: string): Promise<void> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walk(p)
    else files.push(p)
  }
}
await walk(out)
let bytes = 0
for (const f of files) bytes += (await stat(f)).size
console.log(`${out}/  ${files.length} files, ${(bytes / 1024).toFixed(0)} kB`)
