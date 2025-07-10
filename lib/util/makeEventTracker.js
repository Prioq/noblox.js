

// Includes
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

// Cache for stable tracker components to avoid suspicion
const trackerCache = {
  browserId: null,
  createDate: null,
  lastGenerated: 0,
  // Cache duration: 15-30 minutes to appear more natural
  cacheDuration: 15 * 60 * 1000 + Math.floor(Math.random() * 15 * 60 * 1000)
}

// Define
async function makeEventTracker(jar) {
  try {
    // Get current user info to extract user ID
    const userInfo = await getAuthenticatedUser({ jar })
    const userId = userInfo.id

    const now = Date.now()

    // Check if we need to regenerate cached components
    if (!trackerCache.browserId || !trackerCache.createDate ||
        (now - trackerCache.lastGenerated) > trackerCache.cacheDuration) {

      // Generate a more stable browser ID that looks realistic
      // Use a timestamp rounded to the nearest 5 minutes to appear more natural
      const roundedTimestamp = Math.floor(now / (5 * 60 * 1000)) * (5 * 60 * 1000)
      const randomComponent = Math.floor(Math.random() * 1000)
      trackerCache.browserId = `${roundedTimestamp}${randomComponent.toString().padStart(3, '0')}`

      // Format the date as MM/dd/yyyy HH:mm:ss using the rounded timestamp
      const createDateTime = new Date(roundedTimestamp)
      const month = (createDateTime.getMonth() + 1).toString().padStart(2, '0')
      const day = createDateTime.getDate().toString().padStart(2, '0')
      const year = createDateTime.getFullYear()
      const hours = createDateTime.getHours().toString().padStart(2, '0')
      const minutes = createDateTime.getMinutes().toString().padStart(2, '0')
      const seconds = createDateTime.getSeconds().toString().padStart(2, '0')
      trackerCache.createDate = `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`

      trackerCache.lastGenerated = now

      // Randomize next cache duration (15-30 minutes)
      trackerCache.cacheDuration = 15 * 60 * 1000 + Math.floor(Math.random() * 15 * 60 * 1000)
    }

    // Create the tracker value in the correct format using cached components
    const trackerValue = `CreateDate=${trackerCache.createDate}&rbxid=${userId}&browserid=${trackerCache.browserId}`

    return `RBXEventTrackerV2=${trackerValue}`
  } catch (error) {
    console.error('Failed to generate event tracker:', error)
    return null
  }
}

exports.func = function (args) {
  return makeEventTracker(args.jar)
}
