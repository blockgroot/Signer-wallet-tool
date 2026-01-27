#!/usr/bin/env tsx

/**
 * Regenerate wallets.json and signers.json from scratch
 * Sources:
 * 1. Safe transaction links
 * 2. Signer addresses list
 * 3. CSV file (safe-address-book-2026-01-13.csv)
 */

import fs from 'fs'
import path from 'path'

// Chain prefix mapping from Safe URLs
const CHAIN_PREFIX_MAP: Record<string, string> = {
  eth: 'eth',
  bnb: 'bnb',
  arb1: 'arb1',
  polygon: 'polygon',
  matic: 'polygon',
  oeth: 'oeth',
  zkevm: 'zkevm',
  zksync: 'zksync',
  base: 'base',
  scr: 'scr',
  linea: 'linea',
  blast: 'blast',
  xlayer: 'xlayer',
  unichain: 'unichain',
  tac: 'tac',
  avax: 'avax',
  sonic: 'sonic',
  berachain: 'berachain',
  ink: 'ink',
  plasma: 'plasma',
  stable: 'stable',
  'hyper-evm': 'hyper-evm',
  mega: 'mega',
  mnt: 'mnt',
  sep: 'sep',
}

// Chain ID mapping
const CHAIN_ID_MAP: Record<string, number> = {
  eth: 1,
  bnb: 56,
  arb1: 42161,
  polygon: 137,
  matic: 137,
  oeth: 10,
  zkevm: 1101,
  zksync: 324,
  base: 8453,
  scr: 534352,
  linea: 59144,
  blast: 81457,
  xlayer: 196,
  unichain: 0, // Unknown
  tac: 0, // Unknown
  avax: 43114,
  sonic: 146,
  berachain: 0, // Unknown
  ink: 0, // Unknown
  plasma: 0, // Unknown
  stable: 0, // Unknown
  'hyper-evm': 0, // Unknown
  mega: 0, // Unknown
  mnt: 5000, // Mantle
  sep: 11155111,
}

interface WalletEntry {
  address: string
  chain: string
  chainId: number
  name: string | null
  source: string
}

interface SignerEntry {
  address: string
  name: string | null
  role: string | null
  source: string
}

// Normalize address to lowercase
function normalizeAddress(address: string): string | null {
  if (!address) return null
  
  // Extract address from URL if needed
  address = address.trim()
  
  // Remove URL parameters, keep only address part
  if (address.includes('?')) {
    const match = address.match(/0x[a-fA-F0-9]{40}/i)
    if (match) address = match[0]
  }
  
  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return null
  }
  
  return address.toLowerCase()
}

// Check if name indicates a wallet (Safe/multisig)
function isWalletName(name: string | null): boolean {
  if (!name) return false
  const lowerName = name.toLowerCase()
  return (
    lowerName.includes('safe') ||
    lowerName.includes('multisig') ||
    lowerName.includes('multi-sig') ||
    lowerName.includes('gnosis')
  )
}

// Parse Safe URL to extract address and chain
function parseSafeUrl(url: string): { address: string; chain: string; chainId: number } | null {
  // Match pattern: safe=CHAIN:ADDRESS
  const match = url.match(/safe=([^:]+):(0x[a-fA-F0-9]{40})/i)
  if (!match) return null
  
  const chainPrefix = match[1].toLowerCase()
  const address = normalizeAddress(match[2])
  if (!address) return null
  
  const chain = CHAIN_PREFIX_MAP[chainPrefix] || chainPrefix
  const chainId = CHAIN_ID_MAP[chainPrefix] || 0
  
  return { address, chain, chainId }
}

// Parse signer address line
function parseSignerLine(line: string): { address: string; name: string | null; role: string } | null {
  // Try to extract address and name
  const addressMatch = line.match(/0x[a-fA-F0-9]{40}/i)
  if (!addressMatch) return null
  
  const address = normalizeAddress(addressMatch[0])
  if (!address) return null
  
      // Extract name (text before address)
      let name: string | null = line.substring(0, addressMatch.index || 0).trim()
      name = name.replace(/[:-]$/, '').trim() || null
  
  // Extract role if present
  let role: string | null = null
  if (line.includes('Co-Founder') || line.includes('Co-founder')) {
    role = 'Co-Founder'
  } else if (line.includes('Venture Capital') || line.includes('VC')) {
    role = 'Investor'
  } else if (line.includes('Head')) {
    role = 'Team'
  } else if (line.includes('Ledger') || line.includes('Hardware Wallet')) {
    role = 'Team'
  } else if (line.includes('Hot Wallet')) {
    role = 'Team'
  } else if (line.includes('Operator') || line.includes('Proposer')) {
    role = 'Team'
  } else {
    role = 'Unknown'
  }
  
  return { address, name, role }
}

async function regenerateJson() {
  console.log('🔄 Regenerating wallets.json and signers.json from scratch...\n')
  
  const wallets = new Map<string, WalletEntry>()
  const signers = new Map<string, SignerEntry>()
  
  // 1. Parse Safe transaction links
  console.log('📋 Step 1: Parsing Safe transaction links...')
  const safeLinksText = `
https://app.safe.global/transactions/tx?safe=eth:0xCbcdd778AA25476F203814214dD3E9b9c0b582dfb261d80264a18f1d8b50740af954df21e54744aabfa78b5f308c90
https://app.safe.global/transactions/tx?safe=eth:0xEe68dF9f661da6ED968Ea4cbF7EC68fcF7fa1d65f8938e1c2b117a2ab45ebe2ee5c7685db31b04cd2d055607e9e61d
https://app.safe.global/transactions/tx?safe=bnb:0xb4222155CDB309Ecee1bA64d56c8bAb042a19dea58518951878eb5edb05da3352eae44246969ee0299a1b599f6bc32
https://app.safe.global/transactions/tx?safe=oeth:0x0d30A563e38Fe2926b37783A046004A74dd9edff1e378dc7ae0b16c9ea481ad8dec442ea5cfbe3852d7c578221c8b
https://app.safe.global/transactions/tx?safe=arb1:0x96D97D66d4290C9182A09470a5775FF922a26c540f024a52606fb4165ec43f6e997a9973e08efffb6ca89c0fafda1
https://app.safe.global/transactions/tx?safe=arb1:0xd4481D595D99E2BA0E3eDFBd65fBB79bc116799bad230469f5d5d68ded7535f9de882b1a648e6a883f0ac6bb1b0a4
https://app.safe.global/transactions/tx?safe=zkevm:0x424Fc153C4005F8D5f23E08d94F520319b3ac6bc36b9324ebe160f9757d6cb3f591bb6472ff6550fc4d8e8779109
https://app.safe.global/transactions/tx?safe=zksync:0xeD38DA849b20Fa27B07D073053C5F5ea96c5df289fda5a3a544539331a28c5233df25fa8f01fdb962afc4c80d5d
https://app.safe.global/transactions/tx?safe=base:0x7Da95539762Dd11005889F6B72a6674Ae42734641ab6a4dd938559455aefb888c79e7ac5f6e8a4213fb81a039c1d8
https://app.safe.global/transactions/tx?safe=scr:0xEe68dF9f661da6ED968Ea4cbF7EC68fcF1bccaeb0e7081c55046ed0e22dae8c70f3723de7ef1dd01731993754388ee
https://app.safe.global/transactions/tx?safe=linea:0xEe68dF9f661da6ED968Ea4cbF7EC68fc796d70ce56ff9c61f291b8b22e318f588465a5a622e9792001356590aaea
https://app.safe.global/transactions/tx?safe=blast:0xEe68dF9f661da6ED968Ea4cbF7EC68fcF7fa1d65f8938e1c2b117a2ab45ebe2ee5c7685db31b04cd2d055607e9e61d
https://app.safe.global/transactions/tx?safe=xlayer:0xEe68dF9f661da6ED968Ea4cbF7EC68fc13e49f022dbc2a72783f4f11bd31eca1c826f06ab38db912b0611959ef55f
https://app.safe.global/transactions/tx?safe=xlayer:0x449DEFBac8dc846fE51C6f0aBD92d091e6c461137fab653d4bc090aaa9504ec84933fccc9df6c44b437b3559051
https://app.safe.global/transactions/tx?safe=unichain:0x9Fc47d6A2F5A1EFd8BaF475E187387af709c2928614350c1daf097807a09dcbe92066ad0129daebcc4d595474
https://safe.tac.build/transactions/tx?safe=tac:0x3DA6b24D9003228356f7040f6e6b1fa575248c3646717167a8c5c48a778ae1068b75a8ad248bb95805bcbf529352b3d
https://app.safe.global/transactions/tx?safe=avax:0xB2Bb1425514Ab5903BE6bBDb6b44958e76b0c7b08d43ea1211674f53361ec2ea4612be61f1cb6678fbfe15f7449db
https://app.safe.global/transactions/tx?safe=sonic:0xCbcdd778AA25476F203814214dD3E9b9c0b582dfe797bf4de0aa9fb96606466f5281ccf22e9e6a312007cc7814378ae6c0d53
https://app.safe.global/transactions/tx?safe=berachain:0x7Ac1cE0cB6A7c6eF59c2f95A8594d92893c0f8a12baab8a2c05015c14013337bc3a802e6df70d7561338dc72
https://app.safe.global/transactions/tx?safe=ink:0x7a1112494843d0228BFFBa13eF3Ce57f4909988b311d2a128fd2596fb7e96f2ac164faa41d9b6005feb7c87204f34e
https://app.safe.global/transactions/tx?safe=plasma:0x5Ae348Bb75bC9587290a28636187B83b9f42e4e54fb9f83a9a2bc949fd0f85e36f93a5ae8a9223b829667a19e73
https://app.safe.global/transactions/tx?safe=stable:0x26d60a69f3c9Ac4c9a405A5D3D54548978528d32c9f22aa1646de9b8686c540c83ee64598964f31a861bb89f952
https://app.safe.global/transactions/tx?safe=hyper-evm:0xc58DBA139E376AE06270b3b46697c96ca988535d3a16d536698bcad571d8fb9ae87e59b5565b24727d777676
https://app.safe.global/transactions/tx?safe=mega:0xfa3bA682f2210d05D087b331c71F5b340d897aa7158b251cb8b0b2071df390eb3856bb06bd0f5887aac707d209e4a
https://app.safe.global/transactions/tx?safe=mnt:0xfa3bA682f2210d05D087b331c71F5b34F6c19886480b6794d4e96ef898661feff21ac5a0958db9e9c001cfcf3f694a
https://app.safe.global/transactions/tx?safe=eth:0xb9577E83a6d9A6DE35047aa066E375822d73a7c57a5c6c2d3d334d1be89389c0e93bc38fec204edd686df253aa69df
https://app.safe.global/transactions/tx?safe=eth:0x4E9096741c99D035f60abAEbDE8a35c31a23bf40b9e3b11d2a8408aabfae1139c8db77d26baf3a7ffce793e94be6e0
BNBx Manager Role : : https://app.safe.global/transactions/tx?safe=bnb:0x79A2Ae748AC8bE4118B7a8096681B30310c3adBEdf0aa1d4b33f701ba040bf6ada4a11afa1f30ba9f0ab1ecc3cc83cd296cab
maticx childPool owner : https://app.safe.global/transactions/tx?safe=matic:0x51358004cFe135E64453d7F6a0dC433a7d4798ffeaf1e3161bfe57c8df8b78214ccef6a33c514957e1b35357cc8a
MaticX internal multisig : https://app.safe.global/transactions/tx?safe=eth:0x80A43dd35382C4919991C5Bca7f46Dd24Fde4C679ec9a69187dc42d52e8f1585f25e3c348d455f26e9b0a578472e531f4b37d
https://app.safe.global/transactions/tx?safe=eth:0x87ff94bB7709c70c6B2018FED12E4Ce0Adb0afaae42a3a2dbb18541cbbf7eddd3e176650cb98939d4acd6f444272e1
https://app.safe.global/transactions/tx?safe=sep:0xddC16e789Bc667d531FC04034a70dD575d73ae509132c005798d623621b1dde87c6ced3c682a4993c88aec04114f32
https://app.safe.global/transactions/tx?safe=eth:0x729F22bF83110b837b0f16aebbCA33bb9016698283be4c63707205406f742e7a0d48ff65c23116513afb879d85e6aa
https://app.safe.global/transactions/tx?safe=eth:0xC8Ef93B3cf2f0784e8C668458f8b7Bd5b28335097b9f3360625d7e2a962223107a5fedcbe7605ef845be294a984191
kernel airdrop : https://app.safe.global/transactions/tx?safe=bnb:0x2366c3830a9e1FBB5Ea0B6BC4Bb9717A8e7c74d0505ca7c2f2bde4f58a41eed8eef2f8ab4cbae5c3f7bef7c7c342da
https://app.safe.global/transactions/tx?safe=zkevm:0x424Fc153C4005F8D5f23E08d94F5203f2a9486fc3cd8c68becfa08feaf5447654ece956cfaa613e3c08cb1870adc
https://app.safe.global/transactions/tx?safe=bnb:0x40f5f0f5E78289B33E450fBCA1cbD870048c4c27efcde558e7f3d802c565ae098847c2e4f8a59303fae72dd83041ee
https://app.safe.global/transactions/tx?safe=bnb:0x762966a8F4F4ed9016f8651B352e9435c89001ce9437f1b43c906acf2a86fea00a5e58349a596fa5558160250d3e80
5/8 multisig : https://app.safe.global/transactions/tx?safe=bnb:0x845c3dB355f7bEcA27Ac8b4652517f859770817f2b98bba3fb386f956a9bc4de40f92e4ab3bfc4c3c17df4199fda62
https://app.safe.global/transactions/tx?safe=bnb:0x85Dfbf5A7c26DA08406b792e673d847750d6ea23651b9e5424718e8e4fdcd917a57fc672d1cdd998b76816fa0f2111
https://app.safe.global/transactions/tx?safe=bnb:0x881fE09B89F8DD5186F195Cc454104Af7194d7e2a6be42ab13a5caa07b73e0d88352e4ef1226331f2076102e8ea4ee
https://app.safe.global/transactions/tx?safe=bnb:0xb3696a817D01C8623E66D156B6798291f21b08ceec74bba1e2cca77165c2cbe61659cd7fe509e2d107227b59bd8bf0
https://app.safe.global/transactions/tx?safe=arb1:0xe85F0d083D0CD18485E531c1A8B8a05a0e0b8dd78aa755784299737726de3ca31319f0a8eb6e6cb47605d50d55f5b
https://app.safe.global/transactions/tx?safe=oeth:0x37FB3e91EB591E2d7140E06d2dcEEfbBd2292176f242a167a394d1a8d2cd3a81999925171ee620a60ee89f446d512
https://app.safe.global/transactions/tx?safe=oeth:0x71a06E7F6332dCA230748D387758BfC4ba2a09fae77ff821a5c81a5e74e8def3cec0f5158fba8de992cf6afce7b80
https://app.safe.global/transactions/tx?safe=avax:0xF268892aF58a4EE3232Ca41FE138344de05cff594891c29cfa825d465fe852be02ec65ed9ab688aff4f5f7a19c93e
`
  
  const safeLinks = safeLinksText.split('\n').filter(line => line.trim() && line.includes('safe='))
  
  for (const link of safeLinks) {
    // Extract name if present (text before the URL)
    const nameMatch = link.match(/^([^:]+?)\s*:\s*https?/)
    const name = nameMatch ? nameMatch[1].trim() : null
    
    const parsed = parseSafeUrl(link)
    if (parsed) {
      const key = `${parsed.address}-${parsed.chainId}`
      if (!wallets.has(key)) {
        wallets.set(key, {
          address: parsed.address,
          chain: parsed.chain,
          chainId: parsed.chainId,
          name: name || null,
          source: 'safe_link',
        })
      } else {
        // Update name if we have a better one
        const existing = wallets.get(key)!
        if (name && !existing.name) {
          existing.name = name
        }
      }
    }
  }
  
  console.log(`  ✅ Extracted ${wallets.size} wallets from Safe links`)
  
  // 2. Parse signer addresses
  console.log('\n📋 Step 2: Parsing signer addresses...')
  const signerText = `
Members Dheeraj - Co-Founder at Stader - 0x75db63125A4f04E59A1A2Ab4aCC4FC1Cd5Daddd5
Sidhartha - Co-founder at Mira - 0x601767c4ba4134cc2E906ea7cf25EaB845152A7C
Accel Partners - Venture Capital Firm - 0xd9BA47739E6Cb24bd4B670e32cb1440e082688D1
CA Aishwary - Head - India & Payment & Global Head - FinTech & Payments at Polygon - 0xe736dFd4659eE4793E509F7c3A4448B2b3148f02
Rajath - 0xDf83E84F1eB00F0230eB912E2Ec823C979800B1c
Gus: 0x1f7A03b70C5448DFd0a2C5a7865169253c2C769b
Dheeraj (Account 1): 0x7AAd74b7f0d60D5867B59dbD377a71783425af47
Dheera (Account 2):
Timo (Ledger): 0x51C59785639CCa31c09D0833749e76A5D945C9F3
Timo (Hot Wallet): 0x5DB1955f51f892ce1bbEf3EcEC8a46b85fe75F27
Amit: 0x746d6a9f789999799AE7f5d62Aa70422F86826b6
Sid: 0x601767c4ba4134cc2E906ea7cf25EaB845152A7C
Saurabh: 0x268DA1016634e06f17F11CF584C5Ddf1c44787eb
Manoj: 0x0e4B97563723eF7f0a7FDe4c7bD3B17a5bF63fBf
Punit: 0x86CbBAEB08861D005fD2147A5123E43e558db167
Mihailo (Hot Wallet): 0xCF7bF9D3a485b9c4d4A38d65e4d68e081a585662
Mihailo (Hardware Wallet): 0xFCc1C98F887C93C38Deb5e38A6Fb820AD3fB9DFD
Crash (Hassan): 0x956764BAd3aDf4e5a1DAFf3B68343a845B3fE45C
Batphonghan: 0xa2a4A1Cb7AB2D6E5aae489572ea4d23E649DB11d
Kelp Operator EOA: 0xF2099c4783921f44Ac988B67e743DAeFd4A00efd
Kelp Multisig Proposer EOA: 0x477bAB866EAce0437bb57b809D03D34046B2FDc6
`
  
  const signerLines = signerText.split('\n').filter(line => line.trim())
  
  for (const line of signerLines) {
    const parsed = parseSignerLine(line)
    if (parsed) {
      if (!signers.has(parsed.address)) {
        signers.set(parsed.address, {
          address: parsed.address,
          name: parsed.name,
          role: parsed.role,
          source: 'signer_list',
        })
      } else {
        // Update if we have better info
        const existing = signers.get(parsed.address)!
        if (parsed.name && !existing.name) {
          existing.name = parsed.name
        }
        if (parsed.role && existing.role === 'Unknown') {
          existing.role = parsed.role
        }
      }
    }
  }
  
  console.log(`  ✅ Extracted ${signers.size} signers from signer list`)
  
  // 3. Parse CSV file
  console.log('\n📋 Step 3: Parsing CSV file...')
  const csvPath = path.join(process.cwd(), 'data', 'safe-address-book-2026-01-13.csv')
  
  if (!fs.existsSync(csvPath)) {
    console.log(`  ⚠️  CSV file not found: ${csvPath}`)
  } else {
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim() && !line.startsWith('address'))
    
    let csvWallets = 0
    let csvSigners = 0
    
    for (const line of lines) {
      const [address, name, chainIdStr] = line.split(',').map(s => s.trim())
      
      const normalizedAddress = normalizeAddress(address)
      if (!normalizedAddress) continue
      
      const chainId = parseInt(chainIdStr, 10)
      if (isNaN(chainId)) continue
      
      // Determine if wallet or signer based on name
      if (isWalletName(name)) {
        // Find chain name from chainId
        const chainEntry = Object.entries(CHAIN_ID_MAP).find(([_, id]) => id === chainId)
        const chain = chainEntry ? chainEntry[0] : `chain_${chainId}`
        
        const key = `${normalizedAddress}-${chainId}`
        if (!wallets.has(key)) {
          wallets.set(key, {
            address: normalizedAddress,
            chain: chain,
            chainId: chainId,
            name: name || null,
            source: 'csv',
          })
          csvWallets++
        }
      } else {
        // It's a signer
        if (!signers.has(normalizedAddress)) {
          signers.set(normalizedAddress, {
            address: normalizedAddress,
            name: name || null,
            role: 'Unknown',
            source: 'csv',
          })
          csvSigners++
        } else {
          // Update name if CSV has it
          const existing = signers.get(normalizedAddress)!
          if (name && !existing.name) {
            existing.name = name
          }
        }
      }
    }
    
    console.log(`  ✅ Added ${csvWallets} wallets and ${csvSigners} signers from CSV`)
  }
  
  // 4. Final validation and deduplication
  console.log('\n📋 Step 4: Final validation...')
  
  // Remove any addresses that appear in both (prioritize wallet if from Safe link)
  const walletAddresses = new Set(Array.from(wallets.values()).map(w => w.address))
  for (const [address, signer] of Array.from(signers.entries())) {
    if (walletAddresses.has(address)) {
      // Check if it's a wallet from Safe link - if so, remove from signers
      const walletEntry = Array.from(wallets.values()).find(w => w.address === address && w.source === 'safe_link')
      if (walletEntry) {
        console.log(`  ⚠️  Removing ${address} from signers (exists as wallet from Safe link)`)
        signers.delete(address)
      }
    }
  }
  
  // Convert to arrays
  const walletsArray = Array.from(wallets.values())
  const signersArray = Array.from(signers.values())
  
  // Validate no duplicates
  const walletAddressSet = new Set(walletsArray.map(w => `${w.address}-${w.chainId}`))
  const signerAddressSet = new Set(signersArray.map(s => s.address))
  
  if (walletAddressSet.size !== walletsArray.length) {
    console.error('  ❌ Duplicate wallets found!')
  }
  if (signerAddressSet.size !== signersArray.length) {
    console.error('  ❌ Duplicate signers found!')
  }
  
  console.log(`\n✅ Final counts:`)
  console.log(`  Wallets: ${walletsArray.length}`)
  console.log(`  Signers: ${signersArray.length}`)
  
  // 5. Write JSON files
  console.log('\n📋 Step 5: Writing JSON files...')
  
  const walletsPath = path.join(process.cwd(), 'data', 'wallets.json')
  const signersPath = path.join(process.cwd(), 'data', 'signers.json')
  
  fs.writeFileSync(walletsPath, JSON.stringify(walletsArray, null, 2))
  fs.writeFileSync(signersPath, JSON.stringify(signersArray, null, 2))
  
  console.log(`  ✅ Written ${walletsPath}`)
  console.log(`  ✅ Written ${signersPath}`)
  
  console.log('\n🎉 Regeneration complete!')
}

regenerateJson().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
