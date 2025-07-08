const noblox = require('../lib')

async function testBlockUnblock() {
  console.log('=== Testing Block/Unblock Endpoints ===\n')

  // Check if cookie is provided
  const cookie = process.env.COOKIE
  if (!cookie) {
    console.log('❌ No cookie provided. Set COOKIE environment variable to test.')
    console.log('   Example: COOKIE=your-cookie node examples/test-block-unblock.js')
    return
  }

  try {
    // Login with cookie
    console.log('1. Logging in...')
    const currentUser = await noblox.setCookie(cookie)
    console.log(`✅ Logged in as ${currentUser.name} [${currentUser.id}]`)
    console.log()

    // Test user ID (as provided)
    const testUserId = 7905269485
    console.log(`2. Testing with user ID: ${testUserId}`)
    console.log()

    // Test blocking
    console.log('3. Testing block endpoint...')
    try {
      await noblox.block(testUserId)
      console.log('✅ Block request successful!')
    } catch (error) {
      console.log('❌ Block request failed:', error.message)
      console.log('   This might be expected if the user is already blocked or doesn\'t exist')
    }
    console.log()

    // Wait a moment
    console.log('4. Waiting 2 seconds...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log()

    // Test unblocking
    console.log('5. Testing unblock endpoint...')
    try {
      await noblox.unblock(testUserId)
      console.log('✅ Unblock request successful!')
    } catch (error) {
      console.log('❌ Unblock request failed:', error.message)
      console.log('   This might be expected if the user is not blocked')
    }
    console.log()

    console.log('=== Test Complete ===')
    console.log()
    console.log('Updated endpoints:')
    console.log('- Block: POST https://apis.roblox.com/user-blocking-api/v1/users/{userId}/block-user')
    console.log('- Unblock: POST https://apis.roblox.com/user-blocking-api/v1/users/{userId}/unblock-user')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testBlockUnblock().catch(console.error)
