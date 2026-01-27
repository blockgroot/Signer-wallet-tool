#!/usr/bin/env tsx
/**
 * Post-build deployment script for Vercel
 * Runs migrations and imports data from JSON files
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

async function postbuildDeploy() {
  console.log('🚀 Starting post-build deployment tasks...\n')

  // Check if we're in a build environment
  if (!process.env.DATABASE_URL && !process.env.PRISMA_DATABASE_URL) {
    console.log('⚠️  No DATABASE_URL or PRISMA_DATABASE_URL found, skipping deployment tasks')
    return
  }

  // Step 1: Run migrations
  console.log('📦 Step 1: Running database migrations...\n')
  try {
    // Use PRISMA_DATABASE_URL for migrations if available, otherwise fall back to DATABASE_URL
    const migrationUrl = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL
    
    if (migrationUrl) {
      // Set DATABASE_URL temporarily for Prisma migrations
      process.env.DATABASE_URL = migrationUrl
      
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: migrationUrl },
      })
      console.log('✅ Migrations completed successfully\n')
    } else {
      console.log('⚠️  No database URL available for migrations\n')
    }
  } catch (error) {
    console.error('❌ Migration failed:', error)
    console.log('⚠️  Continuing with import (migrations may have already been run)\n')
  }

  // Step 2: Import data from JSON files
  console.log('📦 Step 2: Importing data from JSON files...\n')
  
  // Check if JSON files exist
  const walletsJson = join(process.cwd(), 'data', 'wallets.json')
  const signersJson = join(process.cwd(), 'data', 'signers.json')
  const signerJson = join(process.cwd(), 'data', 'signer.json') // Legacy file name
  
  console.log(`Checking for JSON files:`)
  console.log(`  wallets.json: ${existsSync(walletsJson) ? '✅ Found' : '❌ Not found'} at ${walletsJson}`)
  console.log(`  signers.json: ${existsSync(signersJson) ? '✅ Found' : '❌ Not found'} at ${signersJson}`)
  if (existsSync(signerJson)) {
    console.log(`  signer.json: ⚠️  Found (legacy file, will be used as fallback)`)
  }
  console.log(`  Current working directory: ${process.cwd()}\n`)
  
  if (!existsSync(walletsJson) && !existsSync(signersJson) && !existsSync(signerJson)) {
    console.error('❌ No JSON files found in data/ directory!')
    console.error('   Make sure data/ directory is included in your repository and build.')
    console.error('   Check .gitignore and vercel.json configuration.\n')
    // Don't return - let it try anyway in case files are in a different location
  }

  // Check if DATABASE_URL is set for import
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set for data import!')
    console.error('   Make sure DATABASE_URL is configured in Vercel environment variables.\n')
    return
  }

  try {
    console.log('🔄 Running import script...\n')
    // Import script will use DATABASE_URL (which should be set for runtime)
    execSync('tsx scripts/import-from-json.ts', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    })
    console.log('\n✅ Data import completed successfully\n')
  } catch (error: any) {
    console.error('\n❌ Import failed:', error)
    if (error.stdout) {
      console.error('STDOUT:', error.stdout.toString())
    }
    if (error.stderr) {
      console.error('STDERR:', error.stderr.toString())
    }
    console.error('\n⚠️  Import failed but build will continue (non-fatal)')
    console.error('   Check Vercel build logs for details.\n')
  }

  console.log('✅ Post-build deployment tasks completed!')
}

postbuildDeploy().catch((error) => {
  console.error('Fatal error in postbuild:', error)
  // Don't exit with error code - allow build to succeed even if postbuild fails
  process.exit(0)
})
