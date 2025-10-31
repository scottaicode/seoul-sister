#!/usr/bin/env node

/**
 * Generate secure secrets for environment variables
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Generate a secure random string
function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex')
}

// Generate API key with prefix
function generateApiKey(prefix = 'ss') {
  return `${prefix}_${generateSecret(32)}`
}

// Main function
function main() {
  console.log('🔐 Generating secure secrets for Seoul Sister...\n')

  const secrets = {
    CRON_SECRET: generateSecret(32),
    API_SECRET_KEY: generateApiKey('ss_api'),
    RATE_LIMIT_SECRET: generateSecret(24),
    WHATSAPP_WEBHOOK_SECRET: generateSecret(24),
    SESSION_SECRET: generateSecret(32),
  }

  console.log('Generated secrets (add these to your .env.local):\n')
  console.log('# Security Secrets (Generated)')

  Object.entries(secrets).forEach(([key, value]) => {
    console.log(`${key}=${value}`)
  })

  console.log('\n⚠️  IMPORTANT: Keep these secrets secure and never commit them to version control!')
  console.log('✅ You can regenerate these anytime by running: npm run generate-secrets')

  // Check if .env.local exists
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.log('\n📝 .env.local not found. Creating from .env.example...')

    const examplePath = path.join(__dirname, '..', '.env.example')
    if (fs.existsSync(examplePath)) {
      const exampleContent = fs.readFileSync(examplePath, 'utf8')

      // Replace placeholders with generated secrets
      let newContent = exampleContent
      Object.entries(secrets).forEach(([key, value]) => {
        const regex = new RegExp(`${key}=.*`, 'g')
        newContent = newContent.replace(regex, `${key}=${value}`)
      })

      fs.writeFileSync(envPath, newContent)
      console.log('✅ Created .env.local with generated secrets')
      console.log('📝 Please update the remaining values in .env.local')
    }
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = { generateSecret, generateApiKey }