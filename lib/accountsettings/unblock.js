// Includes
const http = require('../util/http.js').func
const getGeneralToken = require('../util/getGeneralToken.js').func
const makeEventTracker = require('../util/makeEventTracker.js').func

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
async function unblock (jar, token, userId, apiUrl) {
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

  // If we have a tracker cookie, add it to the eventTracker option for http.js to handle
  if (trackerCookie) {
    httpOpt.options.eventTracker = trackerCookie
  }

  try {
    const res = await http(httpOpt)

    if (res.statusCode === 200) {
      return res
    } else {
      try {
        const body = JSON.parse(res.body) || {}
        if (body.errors && body.errors.length > 0) {
          const errors = body.errors.map((e) => {
            return e.message
          })
          throw new Error(`${res.statusCode} ${errors.join(', ')}`)
        } else {
          throw new Error(`${res.statusCode} ${res.body}`)
        }
      } catch (err) {
        throw new Error(`${res.statusCode} ${res.body}`)
      }
    }
  } catch (error) {
    throw error;
  }
}

exports.func = async function (args) {
  const jar = args.jar
  try {
    const xcsrf = await getGeneralToken({ jar })
    let apiUrl = 'apis.roblox.com'
    if (args.apiUrl) {
      apiUrl = args.apiUrl
    }
    return await unblock(jar, xcsrf, args.userId, apiUrl)
  } catch (error) {
    throw error;
  }
}
