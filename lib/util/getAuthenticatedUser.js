// Includes
const http = require('./http.js').func
const settings = require('../../settings.json')

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
    url: `//users.${process.env['PROXY'] || settings.proxyDomain || "roblox.com"}/v1/users/authenticated`,
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

    if (res) {
      if (res.statusCode === 401) {
        throw new Error('You are not logged in.')
      } else if (res.statusCode !== 200) {
        throw new Error(JSON.stringify(res.body))
      }
    } else {
      throw new Error('Failed to get authenticated user.')
    }
    return res.body
  } catch (err) {
    throw new Error('Failed to get authenticated user: ' + err.message)
  }

}
