// Includes
const http = require('../util/http.js').func
const getGeneralToken = require('../util/getGeneralToken.js').func

// Args
exports.required = ['userId']
exports.optional = ['jar']

// Docs
/**
 * 🔐 Decline a user's friend request.
 * @category User
 * @alias declineFriendRequest
 * @param {number} userId - The id of the user that sent the friend request that is being declined.
 * @returns {Promise<void>}
 * @example const noblox = require("noblox.js")
 * // Login using your cookie
 * noblox.declineFriendRequest(123456)
**/

// Define
function declineFriendRequest (jar, token, userId, apiUrl) {
  return new Promise((resolve, reject) => {
    const httpOpt = {
      url: `//${apiUrl}/v1/users/${userId}/decline-friend-request`,
      options: {
        method: 'POST',
        jar,
        headers: {
          'X-CSRF-TOKEN': token,
          'Content-Type': 'application/json'
        },
        resolveWithFullResponse: true
      }
    }
    return http(httpOpt)
      .then(function (res) {
        if (res.statusCode === 200) {
          resolve()
        } else {
          const body = JSON.parse(res.body) || {}
          if (body.errors && body.errors.length > 0) {
            const errors = body.errors.map((e) => {
              return e.message
            })
            reject(new Error(`${res.statusCode} ${errors.join(', ')}`))
          }
        }
      })
      .catch(error => {
        console.error('Failed to decline friend request:', error);
        throw error;
      });
  })
}

exports.func = function (args) {
  const jar = args.jar
  return getGeneralToken({ jar })
    .then(function (xcsrf) {
      let apiUrl = 'friends.roblox.com'
      if (args.apiUrl) {
        apiUrl = args.apiUrl
      }
      return declineFriendRequest(jar, xcsrf, args.userId, apiUrl)
    })
    .catch(error => {
      console.error('Failed to decline friend request:', error);
      throw error;
    });
}
