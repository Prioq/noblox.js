// Includes
const http = require('../util/http.js').func
const getGeneralToken = require('../util/getGeneralToken.js').func
const getSession = require('../util/getSession.js').func

// Function to generate RBXEventTrackerV2 cookie for authentication
function makeEventTracker(cookie) {
  try {
    // Generate a unique tracking ID based on timestamp and random values
    const timestamp = Date.now()
    const randomValue = Math.random().toString(36).substring(2, 15)
    const sessionHash = require('crypto').createHash('md5').update(cookie).digest('hex').substring(0, 8)

    // Create the tracker value in a format similar to what Roblox expects
    const trackerValue = `${timestamp}-${randomValue}-${sessionHash}`

    return `RBXEventTrackerV2=${trackerValue}`
  } catch (error) {
    console.error('Failed to generate event tracker:', error)
    return null
  }
}

// Args
exports.required = ['userId']
exports.optional = ['apiUrl', 'jar']

// Docs
/**
 * 🔐 Unblock a user.
 * @category AccountSettings
 * @alias unblock
 * @param {number} userId - The id of the user.
 * @returns {Promise<void>}
 * @example const noblox = require("noblox.js")
 * // Login using your cookie
 * noblox.unblock(123456)
 **/

// Define
function unblock (jar, token, userId, apiUrl) {
  return new Promise((resolve, reject) => {
    // Generate event tracker cookie for authentication
    let trackerCookie = ''
    try {
      const cookie = getSession({ jar })
      const tracker = makeEventTracker(cookie)
      if (tracker) {
        trackerCookie = tracker
      }
    } catch (error) {
      console.error('Failed to generate event tracker, continuing without it:', error)
    }

    const httpOpt = {
      url: `//${apiUrl}/user-blocking-api/v1/users/${userId}/unblock-user`,
      options: {
        method: 'POST',
        jar,
        headers: {
          'X-CSRF-TOKEN': token
        },
        resolveWithFullResponse: true
      }
    }

    // If we have a tracker cookie, add it to the options
    if (trackerCookie) {
      httpOpt.options.eventTracker = trackerCookie
    }
    return http(httpOpt).then(function (res) {
      if (res.statusCode === 200) {
        resolve()
      } else {
        try {
          const body = JSON.parse(res.body) || {}
          if (body.errors && body.errors.length > 0) {
            const errors = body.errors.map((e) => {
              return e.message
            })
            reject(new Error(`${res.statusCode} ${errors.join(', ')}`))
          }
        } catch (err) {
          reject(new Error(`${res.statusCode} ${res.body}`))
        }
      }
    }).catch(error => {
      console.error('Failed to unblock user:', error);
      throw error;
    })
  })
}

exports.func = function (args) {
  const jar = args.jar
  return getGeneralToken({ jar }).then(function (xcsrf) {
    let apiUrl = 'apis.roblox.com'
    if (args.apiUrl) {
      apiUrl = args.apiUrl
    }
    return unblock(jar, xcsrf, args.userId, apiUrl)
  }).catch(error => {
    console.error('Failed to unblock user:', error);
    throw error;
  })
}
