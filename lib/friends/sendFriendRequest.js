// Includes
const http = require('../util/http.js').func
const getGeneralToken = require('../util/getGeneralToken.js').func

// Args
exports.required = ['userId']
exports.optional = ['apiUrl', 'jar']

// Docs
/**
 * 🔐 Send a friend request to a user.
 * @category User
 * @alias sendFriendRequest
 * @param {number} userId - The id of the user.
 * @returns {Promise<void>}
 * @example const noblox = require("noblox.js")
 * // Login using your cookie
 * noblox.sendFriendRequest(123456)
 **/

// Define
function sendFriendRequest (jar, token, userId, apiUrl) {
  return new Promise((resolve, reject) => {
    const httpOpt = {
      url: `//${apiUrl}/v1/users/${userId}/request-friendship`,
      options: {
        method: 'POST',
        jar,
        headers: {
          'X-CSRF-TOKEN': token,
          'Content-Type': 'application/json',
          'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br, zstd'
        },
        resolveWithFullResponse: true
      }
    }
    return http(httpOpt).then(function (res) {
      if (res.statusCode === 200) {
        resolve()
      } else {
        try {
          if (res.body.includes('error code')) {
            return reject(new Error(res.body))
          }
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
    })
  })
}

exports.func = function (args) {
  const jar = args.jar
  return getGeneralToken({ jar }).then(function (xcsrf) {
    let apiUrl = 'friends.roblox.com'
    if (args.apiUrl) {
      apiUrl = args.apiUrl
    }
    return sendFriendRequest(jar, xcsrf, args.userId, apiUrl)
  })
}
