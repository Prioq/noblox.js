// Includes
const http = require('../util/http.js').func
const makeEventTracker = require('../util/makeEventTracker.js').func

// Args
exports.required = ['userId']
exports.optional = ['apiUrl', 'jar']

// Docs
/**
 * 🔐 Check if a user is blocked.
 * @category AccountSettings
 * @alias isBlocked
 * @param {number} userId - The id of the user to check if blocked.
 * @returns {Promise<boolean>}
 * @example const noblox = require("noblox.js")
 * // Login using your cookie
 * const blocked = await noblox.isBlocked(123456)
 * console.log(blocked) // true or false
 **/

// Define
async function isBlocked (jar, userId, apiUrl) {
  // Generate event tracker cookie for authentication
  let trackerCookie = ''
  try {
    const tracker = await makeEventTracker({ jar })
    if (tracker) {
      trackerCookie = tracker
    }
  } catch (error) {
    console.error('Failed to generate event tracker, continuing without it:', error)
  }

  return new Promise((resolve, reject) => {
    const httpOpt = {
      url: `//${apiUrl}/user-blocking-api/v1/users/${userId}/is-blocked`,
      options: {
        method: 'GET',
        jar,
        resolveWithFullResponse: true
      }
    }

    // If we have a tracker cookie, add it to the eventTracker option for http.js to handle
    if (trackerCookie) {
      httpOpt.options.eventTracker = trackerCookie
    }

    return http(httpOpt)
      .then(function (res) {
        if (res.statusCode === 200) {
          const body = JSON.parse(res.body)
          // The API returns just a boolean value, not an object
          resolve(body === true)
        } else {
          const body = res.body || '{}'
          let json
          try {
            json = JSON.parse(body)
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${body}`))
            return
          }

          const known = json.errors && json.errors[0]
          const err = known && known.message || `HTTP ${res.statusCode}: Failed to check if user is blocked`
          reject(new Error(err))
        }
      })
      .catch(error => reject(error))
  })
}

exports.func = async function (args) {
  const jar = args.jar
  try {
    let apiUrl = 'apis.roblox.com'
    if (args.apiUrl) {
      apiUrl = args.apiUrl
    }
    return await isBlocked(jar, args.userId, apiUrl)
  } catch (error) {
    throw error
  }
}
