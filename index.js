/**
 * Host half of the plugin-settings-hub bundle.
 *
 * The feature itself is browser-side: the hub tab and the settings-navigation
 * grouping live in `client.js`. This half only carries the bundle row and a
 * small diagnostic sink (`POST /plugin-settings-hub/log`) for the browser
 * half, because a slot entry that throws during render abdicates silently and
 * the page console is not reachable from here.
 */
import { appendFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Diagnostic log written by the browser half. */
const LOG_PATH = join(homedir(), '.dsh', 'plugin-settings-hub.log')

/** Collapse repeats so one rendering loop cannot flood the log. */
let lastLine = ''
let lastLineAt = 0

/**
 * Append one diagnostic line, dropping immediate repeats within ten seconds.
 * @param line - Text reported by the browser half.
 */
function record(line) {
  const now = Date.now()
  if (line === lastLine && now - lastLineAt < 10_000) return
  lastLine = line
  lastLineAt = now
  appendFile(LOG_PATH, `${new Date(now).toISOString()} ${line}\n`).catch(() => {})
}

/**
 * Mount the diagnostic sink.
 * @param ctx - Host plugin context.
 */
export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined || webServer === null) return
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/plugin-settings-hub/log',
    handler: (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405)
        res.end()
        return
      }
      const chunks = []
      req.on('data', chunk => { chunks.push(chunk) })
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8').slice(0, 4000)
        if (body.length > 0) record(body)
        res.writeHead(204)
        res.end()
      })
    },
  }), 'plugin-settings-hub: diagnostic sink')
}
