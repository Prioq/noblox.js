/**
 * Example: Using kickPlayer with logging enabled
 * 
 * This example demonstrates how to enable logging for the kickPlayer function
 * and configure different log levels.
 */

const noblox = require('../lib')

async function demonstrateKickPlayerLogging() {
  try {
    // First, login with your cookie
    // await noblox.setCookie('YOUR_COOKIE_HERE')
    
    console.log('=== KickPlayer Logging Configuration Demo ===\n')
    
    // 1. Enable logging for kickPlayer function
    console.log('1. Enabling kickPlayer logging...')
    noblox.setKickPlayerLogging(true)
    console.log('   ✓ KickPlayer logging enabled')
    
    // 2. Set log level to DEBUG to see all logs
    console.log('\n2. Setting log level to DEBUG...')
    noblox.setLogLevel('DEBUG')
    console.log('   ✓ Log level set to DEBUG')
    
    // 3. Check current settings
    console.log('\n3. Current logging settings:')
    console.log('   General logging enabled:', noblox.settings.logging.enabled)
    console.log('   Log level:', noblox.settings.logging.level)
    console.log('   KickPlayer logging:', noblox.settings.logging.functions.kickPlayer)
    
    // 4. Example of using kickPlayer with logging (commented out for safety)
    console.log('\n4. Example kickPlayer usage (commented out for safety):')
    console.log('   // await noblox.kickPlayer(USER_ID_TO_KICK)')
    console.log('   // This would show detailed logs of the kick operation')
    
    // 5. Demonstrate different log levels
    console.log('\n5. Testing different log levels:')
    
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR']
    for (const level of levels) {
      console.log(`\n   Setting log level to ${level}:`)
      noblox.setLogLevel(level)
      console.log(`   ✓ Log level is now: ${noblox.settings.logging.level}`)
    }
    
    // 6. Disable logging
    console.log('\n6. Disabling kickPlayer logging...')
    noblox.setKickPlayerLogging(false)
    console.log('   ✓ KickPlayer logging disabled')
    console.log('   KickPlayer logging:', noblox.settings.logging.functions.kickPlayer)
    
    console.log('\n=== Demo Complete ===')
    console.log('\nTo use kickPlayer with logging in your application:')
    console.log('1. noblox.setKickPlayerLogging(true)  // Enable logging')
    console.log('2. noblox.setLogLevel("DEBUG")        // Set desired level')
    console.log('3. await noblox.kickPlayer(userId)    // Use with detailed logs')
    
  } catch (error) {
    console.error('Error in demo:', error.message)
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateKickPlayerLogging()
}

module.exports = { demonstrateKickPlayerLogging }
