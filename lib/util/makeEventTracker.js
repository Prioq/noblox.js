// Dependencies
const crypto = require('crypto')

// Includes
const getSession = require('./getSession.js').func
const getAuthenticatedUser = require('./getAuthenticatedUser.js').func

// Args
exports.optional = ['jar']

// Docs
/**
 * 🔐 Generate RBXEventTrackerV2 cookie for authentication.
 * @category Utility
 * @alias makeEventTracker
 * @param {CookieJar=} jar - The cookie jar containing the .ROBLOSECURITY cookie.
 * @returns {Promise<string|null>}
 * @example const noblox = require("noblox.js")
 * // Login using your cookie.
 * const tracker = await noblox.makeEventTracker()
**/

// Define
async function makeEventTracker(jar) {
  try {
    const cookie = getSession({ jar })

    // Get current user info to extract user ID
    const userInfo = await getAuthenticatedUser({ jar })
    const userId = userInfo.id

    // Generate browser ID (timestamp + random component)
    const timestamp = Date.now()
    const randomComponent = Math.floor(Math.random() * 1000)
    const browserId = `${timestamp}${randomComponent.toString().padStart(3, '0')}`

    // Format the date as MM/dd/yyyy HH:mm:ss
    const now = new Date()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const year = now.getFullYear()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const seconds = now.getSeconds().toString().padStart(2, '0')
    const createDate = `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`

    // Create the tracker value in the correct format
    const trackerValue = `CreateDate=${createDate}&rbxid=${userId}&browserid=${browserId}`

    return `RBXEventTrackerV2=${trackerValue}`
  } catch (error) {
    console.error('Failed to generate event tracker:', error)
    return null
  }
}

exports.func = function (args) {
  return makeEventTracker(args.jar)
}
