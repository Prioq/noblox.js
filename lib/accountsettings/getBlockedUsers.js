// Includes
const http = require('../util/http.js').func
const makeEventTracker = require('../util/makeEventTracker.js').func

// Args
exports.required = []
exports.optional = ['count', 'apiUrl', 'jar']

// Docs
/**
 * 🔐 Get the full list of users you have blocked.
 * Fetches pages until the API returns a null cursor.
 * @category AccountSettings
 * @alias getBlockedUsers
 * @param {number=} [count=50] - Page size per request.
 * @returns {Promise<{ blockedUserIds: number[], blockedUsers: Array<{ blockedUserId: number, blockManagerType: string }> }>}
 * @example const noblox = require("noblox.js")
 * // Login using your cookie
 * const all = await noblox.getBlockedUsers()
 * console.log(all.blockedUserIds.length)
 **/

// Define
async function getBlockedUsersAll (jar, apiUrl, count) {
  // Generate event tracker cookie for authentication
  let trackerCookie = ''
  try {
    const tracker = await makeEventTracker({ jar })
    if (tracker) {
      trackerCookie = tracker
    }
  } catch (error) {
    // Do nothing
  }

  const aggregate = {
    blockedUserIds: [],
    blockedUsers: []
  }

  let cursor = ''

  // Loop until cursor is null
  // Note: API returns wrapper { data: { blockedUserIds, blockedUsers, cursor }, error }
  // but may also return the fields at the top level; support both.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const httpOpt = {
      url: `//${apiUrl}/user-blocking-api/v1/users/get-blocked-users?cursor=${encodeURIComponent(cursor)}&count=${count}`,
      options: {
        method: 'GET',
        jar,
        resolveWithFullResponse: true
      }
    }

    if (trackerCookie) {
      httpOpt.options.eventTracker = trackerCookie
    }

    const res = await http(httpOpt)

    if (res.statusCode !== 200) {
      let message = `${res.statusCode} ${res.body}`
      try {
        const parsed = JSON.parse(res.body) || {}
        if (parsed.errors && parsed.errors.length > 0) {
          message = `${res.statusCode} ${parsed.errors.map(e => e.message).join(', ')}`
        }
      } catch (_) {
        // keep default message
      }
      throw new Error(message)
    }

    let body
    try {
      body = JSON.parse(res.body) || {}
    } catch (err) {
      throw new Error(`Failed to parse response: ${res.body}`)
    }

    const data = body.data || body

    const pageBlockedUserIds = Array.isArray(data.blockedUserIds) ? data.blockedUserIds : []
    const pageBlockedUsers = Array.isArray(data.blockedUsers) ? data.blockedUsers : []

    if (pageBlockedUserIds.length > 0) aggregate.blockedUserIds = aggregate.blockedUserIds.concat(pageBlockedUserIds)
    if (pageBlockedUsers.length > 0) aggregate.blockedUsers = aggregate.blockedUsers.concat(pageBlockedUsers)

    cursor = data.cursor === undefined ? null : data.cursor

    if (cursor === null) {
      break
    }
  }

  return aggregate
}

exports.func = async function (args) {
  const jar = args.jar
  const count = args.count || 50
  let apiUrl = 'apis.roblox.com'
  if (args.apiUrl) {
    apiUrl = args.apiUrl
  }
  return getBlockedUsersAll(jar, apiUrl, count)
}


