const noblox = require('../lib')

// Test the URL construction without making actual requests
function verifyEndpoints() {
  console.log('=== Verifying Block/Unblock Endpoint URLs ===\n')

  const testUserId = 7905269485
  
  console.log('Expected URLs:')
  console.log(`Block:   https://apis.roblox.com/user-blocking-api/v1/users/${testUserId}/block-user`)
  console.log(`Unblock: https://apis.roblox.com/user-blocking-api/v1/users/${testUserId}/unblock-user`)
  console.log()

  // Test URL construction by examining the internal functions
  console.log('Testing URL construction...')
  
  // We can't easily test the internal URL construction without mocking,
  // but we can verify the files have been updated correctly
  const fs = require('fs')
  const path = require('path')
  
  const blockFile = fs.readFileSync(path.join(__dirname, '../lib/accountsettings/block.js'), 'utf8')
  const unblockFile = fs.readFileSync(path.join(__dirname, '../lib/accountsettings/unblock.js'), 'utf8')
  
  console.log('✅ Checking block.js...')
  if (blockFile.includes('user-blocking-api/v1/users/${userId}/block-user')) {
    console.log('   ✅ Block endpoint URL updated correctly')
  } else {
    console.log('   ❌ Block endpoint URL not found')
  }
  
  if (blockFile.includes('apis.roblox.com')) {
    console.log('   ✅ Block API domain updated correctly')
  } else {
    console.log('   ❌ Block API domain not updated')
  }
  
  console.log('✅ Checking unblock.js...')
  if (unblockFile.includes('user-blocking-api/v1/users/${userId}/unblock-user')) {
    console.log('   ✅ Unblock endpoint URL updated correctly')
  } else {
    console.log('   ❌ Unblock endpoint URL not found')
  }
  
  if (unblockFile.includes('apis.roblox.com')) {
    console.log('   ✅ Unblock API domain updated correctly')
  } else {
    console.log('   ❌ Unblock API domain not updated')
  }
  
  console.log()
  console.log('=== Verification Complete ===')
  console.log()
  console.log('To test with actual requests, run:')
  console.log('COOKIE=your-cookie node examples/test-block-unblock.js')
}

verifyEndpoints()
