import type { Env, Site } from '../types'

export async function putMedia(env: Env, site: Site, filename: string, body: ArrayBuffer | ReadableStream, mime: string, size: number, w?: number, h?: number, alt = '') {
  await env.MEDIA.put(`${site.slug}/${filename}`, body, { httpMetadata: { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' } })
  await env.DB.prepare(
    `INSERT INTO media (site_id, filename, mime, size, width, height, alt) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (site_id, filename) DO UPDATE SET mime=excluded.mime, size=excluded.size, width=excluded.width, height=excluded.height`,
  )
    .bind(site.id, filename, mime, size, w ?? null, h ?? null, alt)
    .run()
}
