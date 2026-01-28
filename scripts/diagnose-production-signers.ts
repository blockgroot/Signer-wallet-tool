import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Diagnostic script to check what signers exist in production
 * This helps identify why "Unknown" is showing up
 */
async function main() {
  console.log('🔍 Diagnosing signers in database...\n')

  try {
    // Get all signers with their addresses
    const signers = await prisma.signer.findMany({
      include: {
        addresses: {
          select: {
            id: true,
            address: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    console.log(`📋 Total signers: ${signers.length}\n`)

    // Check for problematic signers
    const problematicSigners: Array<{
      id: string
      name: string | null
      nameLength: number
      trimmedName: string
      addressCount: number
      addresses: string[]
    }> = []

    for (const signer of signers) {
      const name = signer.name || ''
      const trimmedName = name.trim()
      const nameLength = name.length

      // Check if this signer would display as "Unknown" or "-"
      const isProblematic =
        !name ||
        nameLength === 0 ||
        trimmedName === '' ||
        trimmedName.toLowerCase() === 'unknown' ||
        trimmedName.length < 2

      if (isProblematic) {
        problematicSigners.push({
          id: signer.id,
          name: signer.name,
          nameLength,
          trimmedName,
          addressCount: signer.addresses.length,
          addresses: signer.addresses.map((a) => a.address),
        })
      }
    }

    if (problematicSigners.length > 0) {
      console.log(
        `❌ Found ${problematicSigners.length} problematic signers:\n`
      )

      problematicSigners.forEach((signer, index) => {
        console.log(`${index + 1}. Signer ID: ${signer.id}`)
        console.log(`   Name: ${JSON.stringify(signer.name)}`)
        console.log(`   Name Length: ${signer.nameLength}`)
        console.log(`   Trimmed: ${JSON.stringify(signer.trimmedName)}`)
        console.log(`   Address Count: ${signer.addressCount}`)
        console.log(`   Addresses:`)
        signer.addresses.forEach((addr) => {
          console.log(`     - ${addr}`)
        })
        console.log('')
      })
    } else {
      console.log('✅ No problematic signers found\n')
    }

    // Also check all signer addresses and see which ones would show as "Unknown"
    console.log('\n📋 Checking all signer addresses:\n')
    const allSignerAddresses = await prisma.signerAddress.findMany({
      include: {
        signer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const addressesWithUnknownSigners = allSignerAddresses.filter((sa) => {
      const signerName = sa.signer.name || ''
      const trimmed = signerName.trim()
      return (
        !signerName ||
        trimmed === '' ||
        trimmed.toLowerCase() === 'unknown' ||
        trimmed.length < 2
      )
    })

    if (addressesWithUnknownSigners.length > 0) {
      console.log(
        `❌ Found ${addressesWithUnknownSigners.length} addresses with Unknown/empty signer names:\n`
      )
      addressesWithUnknownSigners.forEach((sa, index) => {
        console.log(
          `${index + 1}. ${sa.address} -> Signer: ${JSON.stringify(sa.signer.name)} (ID: ${sa.signer.id})`
        )
      })
    } else {
      console.log('✅ All addresses have valid signer names\n')
    }

    // Check if any addresses are also Safe wallets
    console.log('\n📋 Checking for addresses that are also Safe wallets:\n')
    const walletAddresses = await prisma.wallet.findMany({
      select: { address: true },
    })
    const walletAddressSet = new Set(
      walletAddresses.map((w) => w.address.toLowerCase())
    )

    const addressesThatAreWallets = allSignerAddresses.filter((sa) =>
      walletAddressSet.has(sa.address.toLowerCase())
    )

    if (addressesThatAreWallets.length > 0) {
      console.log(
        `❌ Found ${addressesThatAreWallets.length} signer addresses that are also Safe wallets:\n`
      )
      addressesThatAreWallets.forEach((sa, index) => {
        console.log(
          `${index + 1}. ${sa.address} -> Signer: "${sa.signer.name}" (ID: ${sa.signer.id})`
        )
      })
    } else {
      console.log('✅ No signer addresses are Safe wallets\n')
    }

    console.log('\n✨ Diagnosis complete!')
  } catch (error) {
    console.error('❌ Error during diagnosis:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
