// Dependencies
const util = require('util')
let request = util.promisify(require('postman-request'))

// Includes
const options = require('../options.js')
const settings = require('../../settings.json')
const cache = require('../cache')
const getHash = require('./getHash.js').func
const middleware = require('./middleware')

// Args
exports.required = ['url']
exports.optional = ['options', 'ignoreLoginError']

// Define
request = request.defaults({
  forever: true,
  agentOptions: {
    maxSockets: Infinity
  },
  simple: false,
  gzip: true,
  timeout: settings.timeout
})

// Docs
/**
 * ✅ Send an http request to url with options.
 * @category Utility
 * @alias http
 * @param {string} url - The url to request to.
 * @param {object} options - The options to send with the request.
 * @param {boolean} ignoreLoginError - If any login errors should be ignored.
 * @returns {Promise<string>}
 * @example const noblox = require("noblox.js")
 * const body = await noblox.http("https://roblox.com/login", { method: "GET" })
**/

function http (url, opt) {
  if (opt?.headers) {
    opt.headers = Object.fromEntries(
      Object.entries(opt.headers).map(([k, v]) => [k.toLowerCase(), v])
    )
  }
  if (opt && !opt.jar && Object.keys(opt).indexOf('jar') > -1) {
    opt.jar = options.jar
  }
  // Use header-based cookies for both proxied and direct requests in session_only mode
  if (settings.session_only && opt && opt.jar) {
    if (!opt.headers) {
      opt.headers = {}
    }
    opt.headers.cookie = '.ROBLOSECURITY=' + opt.jar.session + ';'

    // Add event tracker cookie if provided
    if (opt.eventTracker) {
      opt.headers.cookie += ' ' + opt.eventTracker + ';'
    }

    opt.headers['x-api-key'] = opt.jar.apiKey
    opt.jar = null
  }
  if (opt && opt.verification) {
    if (!opt.headers) {
      opt.headers = {}
    }
    const verify = '__RequestVerificationToken=' + opt.verification + ';'
    if (opt.headers.cookie) {
      opt.headers.cookie += verify
    } else {
      opt.headers.cookie = verify
    }
  }
  if (url.indexOf('http') !== 0) {
    url = 'https:' + url
  }

  // Apply middleware chain (includes proxy transformation)
  const transformed = middleware.executeChain({ url, options: opt })

  return request(transformed.url, transformed.options)
}

exports.func = function (args) {
  const opt = args.options || {}
  if (typeof opt.jar === 'string') {
    opt.jar = { session: opt.jar }
  }
  const jar = opt.jar
  const depth = args.depth || 0
  const full = opt.resolveWithFullResponse || false
  opt.resolveWithFullResponse = true
  const follow = opt.followRedirect === undefined || opt.followRedirect
  opt.followRedirect = function (res) {
    if (!args.ignoreLoginError && res.headers.location && (res.headers.location.startsWith('https://www.roblox.com/newlogin') || res.headers.location.startsWith('/Login/Default.aspx'))) {
      return false
    }
    return follow
  }
  return http(args.url, opt).then(function (res) {
    if (res.statusCode === 403 && res.headers['x-csrf-token'] && Object.hasOwn(opt.headers ?? {}, 'x-csrf-token')) {
      console.log(`⚠ Got 403, refreshing XCSRF token (attempt ${depth + 1}/3)`)
      console.log(`  New token: ${res.headers['x-csrf-token'] ? 'present' : 'missing'}`)

      if (depth >= 2) {
        console.error('✗ CSRF refresh failed after 3 attempts')
        console.error(`  Status: ${res.statusCode}`)
        console.error(`  Response body: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`)
        console.error(`  Token received: ${res.headers['x-csrf-token']}`)
        throw new Error('Tried ' + (depth + 1) + ' times and could not refresh XCSRF token successfully')
      }

      const token = res.headers['x-csrf-token']

      if (token) {
        console.log(`✓ Refreshing with new token, retrying request...`)
        opt.headers['x-csrf-token'] = token
        opt.jar = jar
        args.depth = depth + 1
        return exports.func(args)
      } else {
        throw new Error('Could not refresh X-CSRF-TOKEN')
      }
    } else {
      if (depth > 0) {
        cache.add(options.cache, 'XCSRF', getHash({ jar }), opt.headers['x-csrf-token'])
      }
    }
    if (res.statusCode === 302 && !args.ignoreLoginError && res.headers.location && (res.headers.location.startsWith('https://www.roblox.com/newlogin') || res.headers.location.startsWith('/Login/Default.aspx'))) {
      throw new Error('You are not logged in')
    }
    return full ? res : res.body
  }).catch(function (err) {
    // Get the transformed context from middleware for fallback handling
    const transformed = middleware.executeChain({ url: args.url, options: opt })

    // Only attempt fallback if proxy was applied and fallback is enabled
    if (transformed.proxyApplied && !args._proxyFallbackAttempted) {
      // Mark that we've attempted fallback to prevent infinite loops
      args._proxyFallbackAttempted = true

      // Use middleware to handle proxy error and get fallback args
      return middleware.proxyMiddleware.handleProxyError(err, {
        originalUrl: transformed.originalUrl,
        options: opt,
        attempt: 0,
        effectiveConfig: transformed.effectiveConfig
      }).then(function (fallbackArgs) {
        // Make direct request using fallback args
        return http(fallbackArgs.url, fallbackArgs.options).then(function (res) {
          // Standard CSRF and login error handling (same as main path)
          if (res.statusCode === 403 && res.headers['x-csrf-token'] && Object.hasOwn(fallbackArgs.options.headers ?? {}, 'x-csrf-token')) {
            if (depth >= 2) {
              throw new Error('Tried ' + (depth + 1) + ' times and could not refresh XCSRF token successfully')
            }

            const token = res.headers['x-csrf-token']

            if (token) {
              opt.headers['x-csrf-token'] = token
              opt.jar = jar
              args.depth = depth + 1
              return exports.func(args)
            } else {
              throw new Error('Could not refresh X-CSRF-TOKEN')
            }
          } else {
            if (depth > 0) {
              cache.add(options.cache, 'XCSRF', getHash({ jar }), fallbackArgs.options.headers?.['x-csrf-token'])
            }
          }
          if (res.statusCode === 302 && !args.ignoreLoginError && res.headers.location && (res.headers.location.startsWith('https://www.roblox.com/newlogin') || res.headers.location.startsWith('/Login/Default.aspx'))) {
            throw new Error('You are not logged in')
          }
          return full ? res : res.body
        })
      }).catch(function () {
        // If fallback handling fails, throw original error
        throw err
      })
    }

    // Re-throw the original error if no fallback or fallback not applicable
    throw err
  })
}