import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check for signers with 'unknown' in name or empty name
  const signers = await prisma.signer.findMany({
    include: { addresses: true },
  })

  console.log(`Total signers: ${signers.length}\n`)

  // Filter signers that might be "Unknown"
  const unknownSigners = signers.filter(
    (s) =>
      !s.name ||
      s.name.trim() === '' ||
      s.name.toLowerCase().includes('unknown')
  )

  console.log(`Signers with Unknown or empty name: ${unknownSigners.length}\n`)

  if (unknownSigners.length > 0) {
    unknownSigners.forEach((s) => {
      console.log(`  - "${s.name}" (ID: ${s.id}) - ${s.addresses.length} addresses`)
      s.addresses.forEach((a) => console.log(`    * ${a.address}`))
    })
  }

  // Check specific addresses from user's list
  const userAddresses = [
    '0x0d30a563e38fe2926b37783a046004a74dd9edff',
    '0x2366c3830a9e1fbb5ea0b6bc4bb9717a8e7c74d0',
    '0x26d60a69f3c9ac4c9a405a5d3d54548978528d32',
    '0x5ae348bb75bc9587290a28636187b83b9f42e4e5',
    '0x37fb3e91eb591e2d7140e06d2dceefbbd2292176',
    '0x3da6b24d9003228356f7040f6e6b1fa575248c36',
  ]

  console.log('\nChecking specific addresses from user list:')
  for (const addr of userAddresses) {
    const found = await prisma.signerAddress.findUnique({
      where: { address: addr.toLowerCase() },
      include: { signer: true },
    })
    if (found) {
      console.log(`  ✓ ${addr} -> Signer: "${found.signer.name}"`)
    } else {
      console.log(`  ✗ ${addr} -> Not found in signer_addresses`)
    }

    // Also check if it's a wallet
    const wallet = await prisma.wallet.findFirst({
      where: { address: addr.toLowerCase() },
    })
    if (wallet) {
      console.log(`    (Also exists as wallet: ${wallet.name || 'unnamed'})`)
    }
  }

  // Get all signer addresses and their signer names
  console.log('\nAll signer addresses with their signer names:')
  const allSignerAddresses = await prisma.signerAddress.findMany({
    include: { signer: true },
    orderBy: { createdAt: 'asc' },
  })

  allSignerAddresses.forEach((sa, index) => {
    console.log(
      `${index + 1}. ${sa.address} -> Signer: "${sa.signer.name}" (ID: ${sa.signer.id})`
    )
  })

  await prisma.$disconnect()
}

main().catch(console.error)
