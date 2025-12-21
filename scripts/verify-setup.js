#!/usr/bin/env node

/**
 * Setup Verification Script
 * Run this to check if your environment is properly configured
 *
 * Usage: node scripts/verify-setup.js
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 Verifying Sprinkler Setup...\n')

let hasErrors = false

// Check 1: Environment variables
console.log('1️⃣  Checking environment variables...')
const envPath = path.join(__dirname, '..', '.env.local')

if (!fs.existsSync(envPath)) {
  console.log('   ❌ .env.local file not found')
  console.log('      Run: cp .env.example .env.local')
  hasErrors = true
} else {
  const envContent = fs.readFileSync(envPath, 'utf-8')

  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'BASE_URL'
  ]

  const missingVars = requiredVars.filter(v => !envContent.includes(v + '='))

  if (missingVars.length > 0) {
    console.log('   ❌ Missing environment variables:')
    missingVars.forEach(v => console.log(`      - ${v}`))
    hasErrors = true
  } else {
    console.log('   ✅ Environment variables configured')
  }
}

// Check 2: Dependencies
console.log('\n2️⃣  Checking dependencies...')
const packageJsonPath = path.join(__dirname, '..', 'package.json')

if (!fs.existsSync(packageJsonPath)) {
  console.log('   ❌ package.json not found')
  hasErrors = true
} else {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

  const requiredDeps = [
    '@supabase/supabase-js',
    'next',
    'react',
    'qrcode',
    'zustand',
    'nanoid'
  ]

  const installedDeps = Object.keys(packageJson.dependencies || {})
  const missingDeps = requiredDeps.filter(d => !installedDeps.includes(d))

  if (missingDeps.length > 0) {
    console.log('   ❌ Missing dependencies:')
    missingDeps.forEach(d => console.log(`      - ${d}`))
    console.log('      Run: npm install')
    hasErrors = true
  } else {
    console.log('   ✅ All dependencies installed')
  }
}

// Check 3: Required files
console.log('\n3️⃣  Checking project structure...')
const requiredFiles = [
  'app/workshop/create/page.tsx',
  'app/workshop/join/page.tsx',
  'app/workshop/[sessionId]/page.tsx',
  'components/ChatBox.tsx',
  'components/MilestoneList.tsx',
  'components/AttendeeList.tsx',
  'components/QRCodeDisplay.tsx',
  'lib/supabase.ts',
  'lib/types.ts',
  'lib/utils.ts'
]

const missingFiles = requiredFiles.filter(f => {
  const filePath = path.join(__dirname, '..', f)
  return !fs.existsSync(filePath)
})

if (missingFiles.length > 0) {
  console.log('   ❌ Missing files:')
  missingFiles.forEach(f => console.log(`      - ${f}`))
  hasErrors = true
} else {
  console.log('   ✅ All required files present')
}

// Check 4: Supabase schema
console.log('\n4️⃣  Database setup...')
const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql')

if (!fs.existsSync(schemaPath)) {
  console.log('   ❌ supabase/schema.sql not found')
  hasErrors = true
} else {
  console.log('   ✅ Schema file found')
  console.log("   ⚠️  Make sure you've run this in your Supabase SQL Editor!")
}

// Summary
console.log('\n' + '='.repeat(50))
if (hasErrors) {
  console.log('❌ Setup incomplete. Please fix the issues above.\n')
  process.exit(1)
} else {
  console.log('✅ Setup verification passed!\n')
  console.log('Next steps:')
  console.log("1. Make sure you've executed supabase/schema.sql in Supabase")
  console.log('2. Run: npm run dev')
  console.log('3. Open: http://localhost:3000')
  console.log('4. Test creating and joining a workshop!\n')
  process.exit(0)
}
