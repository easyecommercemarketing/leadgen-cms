import type { Env } from '../types'

// Verifies the Cloudflare Access JWT on admin requests. Access already blocks unauthenticated
// visitors at the edge; this check makes sure a request can't reach the admin by bypassing Access
// (for example via the workers.dev URL).

type JWK = JsonWebKey & { kid: string }
let certCache: { keys: JWK[]; at: number } | null = null

async function getKeys(team: string): Promise<JWK[]> {
  if (certCache && Date.now() - certCache.at < 3600_000) return certCache.keys
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`)
  if (!r.ok) throw new Error('Could not load Access certs')
  const { keys } = (await r.json()) as { keys: JWK[] }
  certCache = { keys, at: Date.now() }
  return keys
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export type AccessUser = { email: string }

export async function verifyAccess(req: Request, env: Env): Promise<AccessUser | null> {
  if (env.DEV_BYPASS_AUTH === 'true') return { email: 'dev@localhost' }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null

  const token =
    req.headers.get('cf-access-jwt-assertion') ||
    (req.headers.get('cookie') || '').match(/CF_Authorization=([^;]+)/)?.[1]
  if (!token) return null

  const [h, p, sig] = token.split('.')
  if (!h || !p || !sig) return null
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)))
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)))

  const team = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, '')
  const keys = await getKeys(team)
  const jwk = keys.find((k) => k.kid === header.kid)
  if (!jwk) return null

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`))
  if (!ok) return null

  const now = Math.floor(Date.now() / 1000)
  const aud: string[] = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!aud.includes(env.ACCESS_AUD)) return null
  if (payload.exp && payload.exp < now) return null
  if (payload.iss && !String(payload.iss).includes(team)) return null

  // Service tokens (used by the import script) carry common_name instead of email
  return { email: payload.email || payload.common_name || 'service-token' }
}
