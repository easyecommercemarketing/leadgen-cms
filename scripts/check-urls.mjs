#!/usr/bin/env node
// Checks every URL from the old site against a host: status code, one H1, and that images load.
//   node scripts/check-urls.mjs https://leadgen-cms.<you>.workers.dev [scripts/eem-old-urls.txt]
import { readFileSync } from 'node:fs'

const base = (process.argv[2] || '').replace(/\/$/, '')
const list = process.argv[3] || new URL('./eem-old-urls.txt', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
if (!base) {
  console.error('Usage: node scripts/check-urls.mjs <base url> [url list]')
  process.exit(1)
}
const paths = readFileSync(list, 'utf8').split(/\r?\n/).filter(Boolean)
const results = []
const images = new Set()

async function check(path) {
  try {
    const r = await fetch(base + path, { redirect: 'manual' })
    const out = { path, status: r.status, location: r.headers.get('location') || '' }
    if (r.status === 200) {
      const html = await r.text()
      out.h1 = (html.match(/<h1[\s>]/g) || []).length
      for (const m of html.matchAll(/<img[^>]+src="(\/media\/[^"]+)"/g)) images.add(m[1])
    }
    return out
  } catch (e) {
    return { path, status: 'ERR', error: e.message }
  }
}

async function pool(items, n, fn) {
  const out = []
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]) } }))
  return out
}

console.log(`Checking ${paths.length} URLs on ${base} …`)
results.push(...(await pool(paths, 8, check)))
const by = {}
for (const r of results) by[r.status] = (by[r.status] || 0) + 1
console.log('Status codes:', by)
for (const r of results) if (r.status !== 200) console.log(`  ${r.status}  ${r.path}${r.location ? '  →  ' + r.location : ''}${r.error ? '  ' + r.error : ''}`)
const badH1 = results.filter((r) => r.status === 200 && r.h1 !== 1)
console.log(badH1.length ? `Pages without exactly one H1: ${badH1.map((r) => `${r.path} (${r.h1})`).join(', ')}` : 'Every page has exactly one H1.')

const imgList = [...images]
const broken = (await pool(imgList, 8, async (src) => {
  try { const r = await fetch(base + src, { method: 'HEAD' }); return r.status === 200 ? null : `${r.status} ${src}` } catch (e) { return `ERR ${src}` }
})).filter(Boolean)
console.log(broken.length ? `Broken images (${broken.length}):\n  ${broken.join('\n  ')}` : `All ${imgList.length} images load.`)
const ok = by[200] + (by[301] || 0) === paths.length && !badH1.length && !broken.length
console.log(ok ? '\n✅ All good. Ready to go live.' : '\n⚠️  Issues above need a look before go-live.')
