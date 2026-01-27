import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

/**
 * Clean up all signer addresses and reimport from signers.json
 */
async function cleanupAndReimportSigners() {
  console.log('🧹 Cleaning up and reimporting signers...\n')

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set')
    process.exit(1)
  }

  // Read signers.json
  const signersJsonFile = path.join(process.cwd(), 'data', 'signers.json')
  
  if (!fs.existsSync(signersJsonFile)) {
    console.error(`❌ signers.json not found at ${signersJsonFile}`)
    process.exit(1)
  }

  const signers = JSON.parse(fs.readFileSync(signersJsonFile, 'utf-8'))
  console.log(`📋 Found ${signers.length} signers in signers.json\n`)

  // Step 1: Delete all existing signer addresses and signers
  console.log('🗑️  Step 1: Deleting all existing signers and addresses...\n')
  
  try {
    // Delete all wallet-signer relationships first (due to foreign key constraints)
    const deletedWalletSigners = await prisma.walletSigner.deleteMany({})
    console.log(`   ✅ Deleted ${deletedWalletSigners.count} wallet-signer relationships`)
    
    // Delete all signer addresses
    const deletedAddresses = await prisma.signerAddress.deleteMany({})
    console.log(`   ✅ Deleted ${deletedAddresses.count} signer addresses`)
    
    // Delete all signers
    const deletedSigners = await prisma.signer.deleteMany({})
    console.log(`   ✅ Deleted ${deletedSigners.count} signers\n`)
  } catch (error) {
    console.error('❌ Error deleting existing data:', error)
    process.exit(1)
  }

  // Step 2: Import new signers
  console.log('📦 Step 2: Importing new signers from signers.json...\n')
  
  let signersAdded = 0
  let addressesAdded = 0
  let errors = 0

  for (const signerData of signers) {
    try {
      if (!signerData.name || !signerData.addresses || !Array.isArray(signerData.addresses) || signerData.addresses.length === 0) {
        console.warn(`⚠️  Skipping invalid signer entry: ${JSON.stringify(signerData)}`)
        continue
      }

      // Create signer
      const signer = await prisma.signer.create({
        data: {
          name: signerData.name,
          department: signerData.department || null,
        },
      })
      console.log(`✅ Created signer: ${signerData.name}`)
      signersAdded++

      // Add addresses
      for (const address of signerData.addresses) {
        const normalizedAddress = address.toLowerCase().trim()
        
        // Validate address format
        if (!normalizedAddress.match(/^0x[a-f0-9]{40}$/)) {
          console.warn(`   ⚠️  Skipping invalid address: ${address}`)
          continue
        }

        try {
          await prisma.signerAddress.create({
            data: {
              signerId: signer.id,
              address: normalizedAddress,
            },
          })
          console.log(`   ✅ Added address: ${normalizedAddress}`)
          addressesAdded++
        } catch (error: any) {
          if (error.code === 'P2002') {
            // Unique constraint violation - address already exists (shouldn't happen after cleanup, but handle it)
            console.warn(`   ⚠️  Address ${normalizedAddress} already exists, skipping`)
          } else {
            console.error(`   ❌ Error adding address ${normalizedAddress}:`, error)
            errors++
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error importing signer ${signerData.name}:`, error)
      errors++
    }
  }

  console.log('\n📊 Import Summary:')
  console.log(`   ✅ Signers added: ${signersAdded}`)
  console.log(`   ✅ Addresses added: ${addressesAdded}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log(`\n✅ Cleanup and reimport complete!`)
}

cleanupAndReimportSigners()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
