// Dependencies
const crypto = require('crypto')

// Includes
const getSession = require('./getSession.js').func

// Args
exports.optional = ['jar']

// Docs
/**
 * 🔐 Generate RBXEventTrackerV2 cookie for authentication.
 * @category Utility
 * @alias makeEventTracker
 * @param {CookieJar=} jar - The cookie jar containing the .ROBLOSECURITY cookie.
 * @returns {string|null}
 * @example const noblox = require("noblox.js")
 * // Login using your cookie.
 * const tracker = noblox.makeEventTracker()
**/

// Define
function makeEventTracker(jar) {
  try {
    const cookie = getSession({ jar })
    
    // Generate a unique tracking ID based on timestamp and random values
    const timestamp = Date.now()
    const randomValue = Math.random().toString(36).substring(2, 15)
    const sessionHash = crypto.createHash('md5').update(cookie).digest('hex').substring(0, 8)

    // Create the tracker value in a format similar to what Roblox expects
    const trackerValue = `${timestamp}-${randomValue}-${sessionHash}`

    return `RBXEventTrackerV2=${trackerValue}`
  } catch (error) {
    console.error('Failed to generate event tracker:', error)
    return null
  }
}

exports.func = function (args) {
  return makeEventTracker(args.jar)
}
