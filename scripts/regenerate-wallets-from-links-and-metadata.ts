#!/usr/bin/env tsx

/**
 * Regenerate data/wallets.json from scratch using ONLY:
 * - data/safe-wallet-links.txt
 * - data/safe-wallet-with-metadata.txt
 *
 * Rules:
 * - No CSV usage
 * - No trust in existing wallets.json
 * - Deduplicate case-insensitively by (chain, address)
 * - Address must be a valid 0x + 40 hex
 */

import fs from 'fs'
import path from 'path'

type WalletJson = {
  address: string
  chain: string
  chainId: number | null
  name: string | null
  source: 'safe_link'
}

// Safe "network slug" -> chainId (best-effort; some are custom/unknown)
const NETWORK_CHAIN_ID: Record<string, number> = {
  eth: 1,
  sep: 11155111,

  bnb: 56,
  matic: 137,
  avax: 43114,

  arb1: 42161,
  oeth: 10, // Optimism
  base: 8453,
  zkevm: 1101,
  zksync: 324,
  linea: 59144,
  blast: 81457,
  scr: 534352,
  scroll: 534352,

  // Custom / emerging networks (set to null-equivalent unknowns if not sure)
  tac: 239,
  xlayer: 196,
  unichain: 130,
  sonic: 146,
  berachain: 80094,
  ink: 57073,
  plasma: 9745,
  stable: 2016,
  'hyper-evm': 999,
  mega: 6342,
  mnt: 5000,
}

function normalizeAddress(addr: string): string | null {
  const match = addr.match(/0x[a-fA-F0-9]{40}/)
  if (!match) return null
  return match[0].toLowerCase()
}

function parseMetadataFile(filePath: string): Map<string, string> {
  const out = new Map<string, string>()
  const raw = fs.readFileSync(filePath, 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(':')
    if (parts.length < 2) continue
    const addressPart = parts[0].trim()
    const namePart = parts.slice(1).join(':').trim()
    const address = normalizeAddress(addressPart)
    if (!address) continue
    if (!namePart) continue
    // First non-empty name wins; don't churn on duplicates
    if (!out.has(address)) out.set(address, namePart)
  }
  return out
}

function extractSafeFromUrl(url: string): { chain: string; chainId: number | null; address: string } | null {
  // Accept both app.safe.global and safe.tac.build (or any host) as long as it has `safe=chain:0x...`
  const match = url.match(/[?&]safe=([^:]+):(0x[a-fA-F0-9]{40})/)
  if (!match) return null
  const chain = match[1].toLowerCase()
  const address = normalizeAddress(match[2])
  if (!address) return null
  const chainId = NETWORK_CHAIN_ID[chain] ?? null
  return { chain, chainId, address }
}

async function main() {
  const linksPath = path.join(process.cwd(), 'data', 'safe-wallet-links.txt')
  const metadataPath = path.join(process.cwd(), 'data', 'safe-wallet-with-metadata.txt')
  const outPath = path.join(process.cwd(), 'data', 'wallets.json')

  if (!fs.existsSync(linksPath)) {
    throw new Error(`Missing source file: ${linksPath}`)
  }
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Missing source file: ${metadataPath}`)
  }

  const nameByAddress = parseMetadataFile(metadataPath)

  const rawLinks = fs.readFileSync(linksPath, 'utf-8')
  const urls = rawLinks
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  const wallets = new Map<string, WalletJson>() // key: `${chain}:${address}`
  const rejected: Array<{ line: string; reason: string }> = []

  for (const line of urls) {
    const parsed = extractSafeFromUrl(line)
    if (!parsed) {
      rejected.push({ line, reason: 'No safe=chain:0x... found' })
      continue
    }

    const key = `${parsed.chain}:${parsed.address}`
    if (wallets.has(key)) continue

    wallets.set(key, {
      address: parsed.address,
      chain: parsed.chain,
      chainId: parsed.chainId,
      name: nameByAddress.get(parsed.address) ?? null,
      source: 'safe_link',
    })
  }

  // Stable output ordering for diffs
  const out = Array.from(wallets.values()).sort((a, b) => {
    if (a.chain !== b.chain) return a.chain.localeCompare(b.chain)
    return a.address.localeCompare(b.address)
  })

  // Final validation: no empty addresses
  for (const w of out) {
    if (!w.address || !/^0x[a-f0-9]{40}$/.test(w.address)) {
      throw new Error(`Invalid address in output: ${JSON.stringify(w)}`)
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')

  console.log('✅ wallets.json regenerated from links+metadata only')
  console.log(`- Output wallets: ${out.length}`)
  console.log(`- Named wallets (matched metadata): ${out.filter((w) => w.name).length}`)
  console.log(`- Rejected lines: ${rejected.length}`)
  if (rejected.length > 0) {
    console.log('\nFirst 5 rejected lines:')
    for (const r of rejected.slice(0, 5)) {
      console.log(`- ${r.reason}: ${r.line}`)
    }
  }
}

main().catch((e) => {
  console.error('❌ Failed to regenerate wallets.json:', e)
  process.exit(1)
})

