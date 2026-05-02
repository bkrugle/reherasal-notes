#!/usr/bin/env node

/**
 * Generate bcrypt hash for a PIN
 *
 * Usage:
 *   node scripts/generate-pin-hash.js <pin>
 *   node scripts/generate-pin-hash.js              # Interactive mode
 *
 * Examples:
 *   node scripts/generate-pin-hash.js mySecretPin
 *   node scripts/generate-pin-hash.js 1234
 */

import bcrypt from 'bcryptjs'
import { createInterface } from 'readline'

const SALT_ROUNDS = 10

async function hashPin(pin) {
  return bcrypt.hash(pin, SALT_ROUNDS)
}

async function main() {
  const pin = process.argv[2]

  if (pin) {
    // Command line argument provided
    const hash = await hashPin(pin)
    console.log('\nGenerated bcrypt hash:')
    console.log(hash)
    console.log('\nUse this hash in your PLATFORM_ADMINS environment variable:')
    console.log(`[{"name": "AdminName", "pin": "${hash}"}]`)
  } else {
    // Interactive mode
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    })

    console.log('\n=== PIN Hash Generator ===\n')

    rl.question('Enter PIN to hash: ', async (inputPin) => {
      if (!inputPin.trim()) {
        console.log('Error: PIN cannot be empty')
        rl.close()
        process.exit(1)
      }

      const hash = await hashPin(inputPin.trim())

      console.log('\n--- Result ---')
      console.log(`PIN: ${inputPin}`)
      console.log(`Hash: ${hash}`)
      console.log('\nExample PLATFORM_ADMINS entry:')
      console.log(`[{"name": "AdminName", "pin": "${hash}"}]`)
      console.log('')

      rl.close()
    })
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
