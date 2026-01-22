import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

interface SignerData {
  name: string
  department: string | null
  addresses: string[]
}

function validateAddress(address: string): string | null {
  // Remove whitespace and convert to lowercase
  address = address.trim().toLowerCase()
  
  // Validate format: must be 0x + 40 hex characters
  if (!address.match(/^0x[a-f0-9]{40}$/)) {
    return null
  }
  
  return address
}

async function importSigners() {
  console.log('🚀 Starting signer import...\n')

  // Read signers from JSON file
  const signersFile = path.join(process.cwd(), 'data', 'signer.json')
  
  if (!fs.existsSync(signersFile)) {
    console.error(`❌ Signers file not found: ${signersFile}`)
    process.exit(1)
  }

  const signersData: SignerData[] = JSON.parse(fs.readFileSync(signersFile, 'utf-8'))

  console.log(`📋 Found ${signersData.length} signers to process\n`)

  let imported = 0
  let skipped = 0
  let failed = 0
  let addressesImported = 0
  let addressesSkipped = 0

  for (const signerData of signersData) {
    try {
      // Skip signers with no addresses
      if (!signerData.addresses || signerData.addresses.length === 0) {
        console.log(`⏭️  Skipping ${signerData.name} - no addresses`)
        skipped++
        continue
      }

      // Validate and normalize addresses
      const validAddresses: string[] = []
      for (const addr of signerData.addresses) {
        const validated = validateAddress(addr)
        if (validated) {
          validAddresses.push(validated)
        } else {
          console.warn(`⚠️  Invalid address format for ${signerData.name}: ${addr}`)
        }
      }

      if (validAddresses.length === 0) {
        console.warn(`⚠️  No valid addresses for ${signerData.name}, skipping...`)
        failed++
        continue
      }

      // Check if signer already exists by name
      let signer = await prisma.signer.findFirst({
        where: {
          name: signerData.name,
          department: signerData.department,
        },
        include: {
          addresses: true,
        },
      })

      // Create signer if doesn't exist
      if (!signer) {
        signer = await prisma.signer.create({
          data: {
            name: signerData.name,
            department: signerData.department || null,
          },
          include: {
            addresses: true,
          },
        })
        console.log(`✅ Created signer: ${signerData.name}${signerData.department ? ` (${signerData.department})` : ''}`)
      } else {
        console.log(`📝 Found existing signer: ${signerData.name}${signerData.department ? ` (${signerData.department})` : ''}`)
      }

      // Add addresses to signer
      for (const address of validAddresses) {
        try {
          // Check if address already exists
          const existingAddress = await prisma.signerAddress.findUnique({
            where: { address },
            include: {
              signer: true,
            },
          })

          if (existingAddress) {
            if (existingAddress.signerId === signer.id) {
              console.log(`  ⏭️  Address ${address} already linked to this signer`)
              addressesSkipped++
            } else {
              console.log(`  ⚠️  Address ${address} already linked to ${existingAddress.signer.name}, skipping...`)
              addressesSkipped++
            }
            continue
          }

          // Create new address
          await prisma.signerAddress.create({
            data: {
              signerId: signer.id,
              address,
            },
          })

          console.log(`  ✅ Added address: ${address}`)
          addressesImported++
        } catch (error) {
          console.error(`  ❌ Failed to add address ${address}:`, error)
          failed++
        }
      }

      imported++
    } catch (error) {
      console.error(`❌ Failed to import signer ${signerData.name}:`, error)
      failed++
    }
  }

  console.log('\n📊 Import Summary:')
  console.log(`  ✅ Signers processed: ${imported}`)
  console.log(`  ⏭️  Signers skipped: ${skipped}`)
  console.log(`  ❌ Signers failed: ${failed}`)
  console.log(`  📝 Total signers: ${signersData.length}`)
  console.log(`\n  ✅ Addresses imported: ${addressesImported}`)
  console.log(`  ⏭️  Addresses skipped: ${addressesSkipped}`)
}

importSigners()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
