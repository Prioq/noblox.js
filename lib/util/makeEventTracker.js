


// Args
exports.optional = []

// Docs
/**
 * 🔐 Generate RBXEventTrackerV2 cookie for authentication.
 * @category Utility
 * @alias makeEventTracker
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
async function makeEventTracker() {
  try {
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

    // Generate a fake Roblox user ID (7-10 digits, not a real one)
    // Roblox user IDs are currently in the 8-10 digit range, so let's use that
    function generateFakeUserId() {
      // Pick a length between 7 and 10 digits
      const length = Math.floor(Math.random() * 4) + 7
      // Ensure the first digit is not 0
      let id = Math.floor(Math.random() * 9 + 1).toString()
      for (let i = 1; i < length; i++) {
        id += Math.floor(Math.random() * 10).toString()
      }
      return id
    }
    const fakeUserId = generateFakeUserId()

    // Create the tracker value in the correct format using cached components
    const trackerValue = `CreateDate=${trackerCache.createDate}&rbxid=${fakeUserId}&browserid=${trackerCache.browserId}`

    return `RBXEventTrackerV2=${trackerValue}`
  } catch (error) {
    return null
  }
}

exports.func = function () {
  return makeEventTracker()
}
