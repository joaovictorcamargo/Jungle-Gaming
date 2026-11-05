// Auditoria Lighthouse: início e detalhe do NFT, perfis mobile e desktop, 3 medições cada, mediana por categoria.
// Pré-requisito: `npm run build && npm run preview` (build otimizado + cenário padrão dos mocks).
import { launch } from 'chrome-launcher'
import lighthouse, { desktopConfig } from 'lighthouse'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import os from 'node:os'

const BASE = process.env.AUDIT_URL ?? 'http://localhost:4173'
const RUNS = Number(process.env.AUDIT_RUNS ?? 3)
const OUT = 'lighthouse/reports'
const PAGES = { home: '/', detail: '/nft/nft-001' }
const PROFILES = { mobile: undefined, desktop: desktopConfig }
const CATS = ['performance', 'accessibility', 'best-practices', 'seo']
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]

mkdirSync(OUT, { recursive: true })
const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] })
const summary = { env: { node: process.version, lighthouse: JSON.parse(readFileSync('node_modules/lighthouse/package.json')).version, chrome: null, platform: `${os.platform()} ${os.release()}`, cpus: os.cpus().length, runs: RUNS, url: BASE, mocks: 'cenário padrão (default)' }, results: {} }

for (const [pName, path] of Object.entries(PAGES)) {
  for (const [profile, config] of Object.entries(PROFILES)) {
    const runs = []
    for (let i = 0; i < RUNS; i++) {
      const r = await lighthouse(`${BASE}${path}`, { port: chrome.port, output: ['json', 'html'], logLevel: 'error', onlyCategories: CATS }, config)
      const lhr = r.lhr
      summary.env.chrome = lhr.environment.hostUserAgent
      const scores = Object.fromEntries(CATS.map((c) => [c, Math.round((lhr.categories[c].score ?? 0) * 100)]))
      const m = lhr.audits
      runs.push({ scores, lcp: m['largest-contentful-paint'].numericValue, cls: m['cumulative-layout-shift'].numericValue, tbt: m['total-blocking-time'].numericValue })
      writeFileSync(`${OUT}/${pName}-${profile}-run${i + 1}.json`, r.report[0])
      writeFileSync(`${OUT}/${pName}-${profile}-run${i + 1}.html`, r.report[1])
    }
    summary.results[`${pName}/${profile}`] = {
      median: Object.fromEntries(CATS.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
      lcpMs: Math.round(median(runs.map((r) => r.lcp))), cls: Number(median(runs.map((r) => r.cls)).toFixed(3)), tbtMs: Math.round(median(runs.map((r) => r.tbt))),
      runs,
    }
    console.log(pName, profile, JSON.stringify(summary.results[`${pName}/${profile}`].median), 'LCP', summary.results[`${pName}/${profile}`].lcpMs, 'CLS', summary.results[`${pName}/${profile}`].cls, 'TBT', summary.results[`${pName}/${profile}`].tbtMs)
  }
}
await chrome.kill()
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2))
