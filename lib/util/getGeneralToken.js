// Includes
const getHash = require('./getHash.js').func
const http = require('./http.js').func
const cache = require('../cache')
const options = require('../options.js')
const settings = require('../../settings.json')

// Args
exports.optional = ['jar']

// Docs
/**
 * 🔐 Generate an X-CSRF-Token.
 * @category Utility
 * @alias getGeneralToken
 * @param {CookieJar=} jar - The jar containing the .ROBLOSECURITY token.
 * @returns {Promise<string>}
 * @example const noblox = require("noblox.js")
 * // Login using your cookie.
 * const XCSRF = await noblox.getGeneralToken()
**/

// CSRF token endpoints ordered by preference: safest/lightest first
const CSRF_ENDPOINTS = [
  { url: '//auth.roblox.com/v2/logout', method: 'POST', name: 'auth/logout' },
  { url: '//groups.roblox.com/v1/groups/0/users', method: 'POST', name: 'groups/users' },
  { url: '//friends.roblox.com/v1/users/1/unfriend', method: 'POST', name: 'friends/unfriend' },
  { url: '//avatar.roblox.com/v1/avatar/assets/0/wear', method: 'POST', name: 'avatar/wear' }
]

/**
 * Try to get CSRF token from a specific endpoint
 * @private
 * @param {object} endpoint - The endpoint configuration
 * @param {CookieJar} jar - The cookie jar
 * @returns {Promise<string|null>} - The CSRF token or null if not found
 */
async function tryGetTokenFromEndpoint (endpoint, jar) {
  try {
    const httpOpt = {
      url: endpoint.url,
      options: {
        resolveWithFullResponse: true,
        method: endpoint.method,
        jar,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    }

    const res = await http(httpOpt)
    const token = res.headers['x-csrf-token']

    if (token) {
      if (settings.verbose || process.env.NOBLOX_VERBOSE) {
        console.log(`✓ Got CSRF token from: ${endpoint.name}`)
      }
      return token
    }

    return null
  } catch (error) {
    // Silently continue to next endpoint on error
    if (settings.verbose || process.env.NOBLOX_VERBOSE) {
      console.warn(`Failed to get token from ${endpoint.name}:`, error.message)
    }
    return null
  }
}

/**
 * Get CSRF token by trying multiple endpoints in order
 * @private
 * @param {CookieJar} jar - The cookie jar
 * @returns {Promise<string>} - The CSRF token
 */
async function getGeneralToken (jar) {
  if (!jar && !options.jar.session) {
    throw new Error('Cannot get CSRF: You are not logged in.')
  }

  // Try each endpoint in order until one returns a token
  for (const endpoint of CSRF_ENDPOINTS) {
    const token = await tryGetTokenFromEndpoint(endpoint, jar)
    if (token) {
      return token
    }
  }

  // If all endpoints failed, throw error
  throw new Error('Failed to obtain X-CSRF-TOKEN from all endpoints. Please verify your cookie is valid.')
}

exports.func = function (args) {
  const jar = args.jar
  return cache.wrap('XCSRF', getHash({ jar }), function () {
    return getGeneralToken(jar)
  })
}
