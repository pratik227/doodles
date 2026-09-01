#!/usr/bin/env node
/** Render one contact sheet per feature category into out/. */
import { execFileSync } from 'node:child_process'
import { catalogue } from '../src/index'

const cats = Object.keys(await catalogue())
for (const c of cats) {
  execFileSync('node', ['--import', 'tsx', 'bin/naives.ts', 'sheet', '--category', c, '-o', `out/sheet-${c}.svg`], { stdio: 'inherit' })
}
