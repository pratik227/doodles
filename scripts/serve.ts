#!/usr/bin/env node
/** Zero-dependency static server for the playground. `npm start` */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(process.argv[2] || process.cwd())
const port = Number(process.env.PORT || 5173)
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    if (p === '/' && !existsSync(join(root, 'index.html'))) {
      res.writeHead(302, { location: '/web/' })   // keep relative imports resolving
      res.end()

return
    }
    let file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''))
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
  }
}).listen(port, () => console.log(`naives: serving ${root} -> http://localhost:${port}/`))
