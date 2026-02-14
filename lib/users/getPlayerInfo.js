// Includes
const settings = require('../../settings.json')
const getFollowingCount = require('../friends/getFollowingCount.js').func
const getFollowerCount = require('../friends/getFollowerCount.js').func
const getFriendCount = require('../friends/getFriendCount.js').func
const getUserInfo = require('../users/getUserInfo.js').func

// Args
exports.required = ['userId']

// Docs
/**
 * ✅ Get a user's information.
 * @category User
 * @alias getPlayerInfo
 * @param { number } userId - The id of the user.
 * @returns {Promise<PlayerInfo>}
 * @deprecated `getPlayerInfo()` is deprecated; see `getUserInfo()`, `getFollowerCount()`, `getFollowingCount()`, `getFriendCount()`, `getUsernameHistory()`, `getUserFunds()`, `getPlayerThumbnail()` instead - high rate limits on endpoints such as username history and follower count have made this aggregate function not suitable for most users
 * @example const noblox = require("noblox.js")
 * let information = await noblox.getPlayerInfo({userId: 123456})
 **/

// Define
function getPlayerInfo (userId) {
  return new Promise((resolve, reject) => {
    const requests = [
      getUserInfo({ userId }),
      getFriendCount({ userId }),

      getFollowingCount({ userId }),
      getFollowerCount({ userId })
    ].map((promise) =>
      promise.then(
        (val) => ({ status: 'fulfilled', value: val }),
        (rej) => ({ status: 'rejected', reason: rej })
      )
    )

    Promise.all(requests).then((promiseResponses) => {
      const responses = promiseResponses.map((response) => response.value)
      const userBody = responses[0]
      const failedResponses = promiseResponses.filter(
        (presponse) => presponse.status === 'rejected'
      )

      if (userBody?.isBanned) {
        const joinDate = new Date(userBody.created)
        const blurb = userBody.description
        const isBanned = userBody.isBanned
        const username = userBody.name
        const displayName = userBody.displayName

        resolve({
          username,
          joinDate,
          blurb,
          isBanned,
          displayName
        })
      } else if (failedResponses.length) {
        const failureReason = failedResponses
          .map((response) => response.reason)
          .join('\n')

        const error = failedResponses.map((r) => r.reason).join('\n')
        reject(new Error(error))
      } else {
        const responseBodies = responses.map((res) => res.body ?? res)
        const friendCount = responseBodies[1]
        const followerCount = responseBodies[3]
        const followingCount = responseBodies[2]
        const joinDate = new Date(userBody.created)
        const blurb = userBody.description
        const isBanned = userBody.isBanned
        const username = userBody.name
        const displayName = userBody.displayName

        const currentTime = new Date()
        const age = Math.round(
          Math.abs(
            (joinDate.getTime() - currentTime.getTime()) / (24 * 60 * 60 * 1000)
          )
        )

        resolve({
          username,
          displayName,
          blurb,
          joinDate,
          age,
          friendCount,
          followerCount,
          followingCount,
          isBanned
        })
      }
    })
  })
}

exports.func = (args) => {
  return getPlayerInfo(args.userId)
}
