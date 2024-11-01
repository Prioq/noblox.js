// Includes
const http = require('./http.js').func

// Args
exports.optional = ['jar']

// Docs
/**
 * 🔐 Get the current authenticated user.
 * @category Utility
 * @alias getAuthenticatedUser
 * @returns {AuthenticatedUserData}
 * @example const noblox = require("noblox.js")
 * // Login using your cookie.
 * const user = await noblox.getAuthenticatedUser()
**/

// Define
exports.func = async function (args) {
  const jar = args.jar
  const httpOpt = {
    url: `//users.${process.env['PROXY'] || "roblox.com"}/v1/users/authenticated`,
    options: {
      method: 'GET',
      followRedirect: false,
      jar,
      json: true,
      resolveWithFullResponse: true
    }
  }
  try {
    const res = await http(httpOpt)

    if (res.statusCode === 401) {
      throw new Error('You are not logged in.')
    } else if (res.statusCode !== 200) {
      throw new Error(JSON.stringify(res.body))
    } else if (!res) {
      throw new Error('Response is returned')
    }
  } catch (err) {
    throw new Error('Failed to get authenticated user: ' + err.message)
  }

  return res.body
}
