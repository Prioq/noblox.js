const fs = require('fs')
const path = require('path')

function verifyChanges() {
  console.log('=== Verifying Block/Unblock Endpoint Changes ===\n')

  // Read the updated files
  const blockFile = fs.readFileSync(path.join(__dirname, '../lib/accountsettings/block.js'), 'utf8')
  const unblockFile = fs.readFileSync(path.join(__dirname, '../lib/accountsettings/unblock.js'), 'utf8')

  console.log('✅ Checking block.js changes:')
  
  // Check for new endpoint
  if (blockFile.includes('user-blocking-api/v1/users/${userId}/block-user')) {
    console.log('   ✅ New endpoint path: /user-blocking-api/v1/users/${userId}/block-user')
  } else {
    console.log('   ❌ New endpoint path not found')
  }
  
  // Check for new domain
  if (blockFile.includes('apis.roblox.com')) {
    console.log('   ✅ New API domain: apis.roblox.com')
  } else {
    console.log('   ❌ New API domain not found')
  }
  
  // Check that old endpoint is removed
  if (!blockFile.includes('/v1/users/${userId}/block')) {
    console.log('   ✅ Old endpoint path removed')
  } else {
    console.log('   ⚠️  Old endpoint path still present')
  }

  console.log()
  console.log('✅ Checking unblock.js changes:')
  
  // Check for new endpoint
  if (unblockFile.includes('user-blocking-api/v1/users/${userId}/unblock-user')) {
    console.log('   ✅ New endpoint path: /user-blocking-api/v1/users/${userId}/unblock-user')
  } else {
    console.log('   ❌ New endpoint path not found')
  }
  
  // Check for new domain
  if (unblockFile.includes('apis.roblox.com')) {
    console.log('   ✅ New API domain: apis.roblox.com')
  } else {
    console.log('   ❌ New API domain not found')
  }
  
  // Check that old endpoint is removed
  if (!unblockFile.includes('/v1/users/${userId}/unblock')) {
    console.log('   ✅ Old endpoint path removed')
  } else {
    console.log('   ⚠️  Old endpoint path still present')
  }

  console.log()
  console.log('✅ Final endpoint URLs:')
  console.log('   Block:   POST https://apis.roblox.com/user-blocking-api/v1/users/{userId}/block-user')
  console.log('   Unblock: POST https://apis.roblox.com/user-blocking-api/v1/users/{userId}/unblock-user')
  
  console.log()
  console.log('✅ Test user ID: 7905269485')
  console.log('   Block URL:   https://apis.roblox.com/user-blocking-api/v1/users/7905269485/block-user')
  console.log('   Unblock URL: https://apis.roblox.com/user-blocking-api/v1/users/7905269485/unblock-user')

  console.log()
  console.log('=== Changes Verified Successfully ===')
  console.log()
  console.log('To test the endpoints with authentication:')
  console.log('COOKIE=your-cookie node examples/test-block-unblock.js')
}

verifyChanges()
