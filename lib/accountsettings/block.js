// Includes
const http = require('../util/http.js').func
const getGeneralToken = require('../util/getGeneralToken.js').func
const makeEventTracker = require('../util/makeEventTracker.js').func

// Args
exports.required = ['userId']
exports.optional = ['apiUrl', 'jar']

// Docs
/**
 * 🔐 Block a user.
 * @category AccountSettings
 * @alias block
 * @param {number} userId - The id of the user that is being blocked.
 * @returns {Promise<void>}
 * @example const noblox = require("noblox.js")
 * // Login using your cookie
 * noblox.block(123456)
 **/

// Define
function block (jar, token, userId, apiUrl) {
  return new Promise((resolve, reject) => {
    // Generate event tracker cookie for authentication
    let trackerCookie = ''
    try {
      const tracker = makeEventTracker({ jar })
      if (tracker) {
        trackerCookie = tracker
      }
    } catch (error) {
      console.error('Failed to generate event tracker, continuing without it:', error)
    }

    const httpOpt = {
      url: `//${apiUrl}/user-blocking-api/v1/users/${userId}/block-user`,
      options: {
        method: 'POST',
        jar,
        headers: {
          'X-CSRF-TOKEN': token
        },
        resolveWithFullResponse: true
      }
    }

    // If we have a tracker cookie and we're using session_only mode, add it to the cookie header
    if (trackerCookie) {
      // We need to add the tracker to the verification property so it gets included in the cookie header
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
      console.error('Failed to block user:', error);
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
    return block(jar, xcsrf, args.userId, apiUrl)
  }).catch(error => {
    console.error('Failed to block user:', error);
    throw error;
  })
}
