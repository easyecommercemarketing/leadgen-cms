#!/usr/bin/env node
// Push a site's import data (site.json, shared.json, content.json, redirects.json, media/) into the CMS.
//
//   node scripts/import.mjs import-data/eem --api http://localhost:8787
//   node scripts/import.mjs import-data/eem --api https://cms.easyecommercemarketing.com
//
// Production calls go through Cloudflare Access. Either:
//   - log in to the CMS in your browser and copy the CF_Authorization cookie value into CF_ACCESS_TOKEN, or
//   - use an Access service token: CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET
//
// Safe to re-run: everything is an upsert, and media files already uploaded are skipped.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const args = process.argv.slice(2)
const dir = args.find((a) => !a.startsWith('--'))
const api = (args[args.indexOf('--api') + 1] || 'http://localhost:8787').replace(/\/$/, '')
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null
if (!dir) {
  console.error('Usage: node scripts/import.mjs <data-dir> --api <cms url> [--only site,media,shared,content,redirects]')
  process.exit(1)
}

const headers = {}
if (process.env.CF_ACCESS_TOKEN) {
  // Your own browser login: the value of the CF_Authorization cookie on the CMS domain
  const t = process.env.CF_ACCESS_TOKEN.trim().replace(/^CF_Authorization=/, '')
  headers['cf-access-token'] = t
  headers['cookie'] = `CF_Authorization=${t}`
} else if (process.env.CF_ACCESS_CLIENT_ID) {
  headers['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID.trim()
  headers['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET.trim()
}

const load = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))
const want = (step) => !only || only.includes(step)

async function call(method, path, body, extra = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(api + '/api/import' + path, {
        method,
        headers: { ...headers, ...(body && !(body instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}), ...extra },
        body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined,
      })
      const text = await r.text()
      if (r.status === 401 || r.status === 403) {
        const err = new Error(`${r.status}: Cloudflare Access rejected the login. Check CF_ACCESS_TOKEN (or the service token) is current.`)
        err.fatal = true
        throw err
      }
      if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 300)}`)
      return JSON.parse(text)
    } catch (e) {
      if (e.fatal || attempt >= 4) throw e
      await new Promise((res) => setTimeout(res, 1000 * attempt))
    }
  }
}

const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.gif': 'image/gif' }

async function run() {
  const site = load('site.json')
  const { id } = await call('POST', '/site', site)
  console.log(`Site "${site.name}" → id ${id}`)

  if (want('media') && existsSync(join(dir, 'media'))) {
    const meta = existsSync(join(dir, 'media.json')) ? load('media.json') : {}
    const have = new Set((await call('GET', `/media/${id}`)).map((m) => m.filename))
    const files = readdirSync(join(dir, 'media')).filter((f) => !have.has(f))
    console.log(`Media: ${have.size} already uploaded, ${files.length} to upload`)
    let done = 0
    const queue = [...files]
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        while (queue.length) {
          const f = queue.shift()
          const m = meta[f] || {}
          const q = new URLSearchParams({ filename: f, ...(m.w ? { w: m.w, h: m.h } : {}) })
          const buf = readFileSync(join(dir, 'media', f))
          await call('PUT', `/media/${id}?${q}`, new Uint8Array(buf), { 'content-type': MIME[extname(f).toLowerCase()] || 'application/octet-stream' })
          if (++done % 50 === 0) console.log(`  ${done}/${files.length}`)
        }
      }),
    )
  }

  if (want('shared') && existsSync(join(dir, 'shared.json'))) {
    const items = load('shared.json')
    await call('POST', '/shared', { site_id: id, items })
    console.log(`Sections: ${items.length}`)
  }

  if (want('content') && existsSync(join(dir, 'content.json'))) {
    const items = load('content.json')
    // batch by size so large posts don't make huge requests
    let batch = [], size = 0, saved = 0
    const errors = []
    const flush = async () => {
      if (!batch.length) return
      const r = await call('POST', '/content', { site_id: id, items: batch })
      saved += r.saved
      errors.push(...r.errors)
      batch = []
      size = 0
      process.stdout.write(`\r  content ${saved}/${items.length}`)
    }
    for (const it of items) {
      const s = JSON.stringify(it).length
      if (size + s > 900_000 || batch.length >= 25) await flush()
      batch.push(it)
      size += s
    }
    await flush()
    console.log(`\nContent: ${saved} saved${errors.length ? `, ${errors.length} errors` : ''}`)
    for (const e of errors) console.log(`  ✗ ${e.path}: ${e.error}`)
  }

  if (want('redirects') && existsSync(join(dir, 'redirects.json'))) {
    const items = load('redirects.json')
    await call('POST', '/redirects', { site_id: id, items })
    console.log(`Redirects: ${items.length}`)
  }

  await call('POST', `/finish/${id}`)
  console.log('Done. Cache cleared.')
}

run().catch((e) => {
  console.error('\nImport failed:', e.message)
  process.exit(1)
})
