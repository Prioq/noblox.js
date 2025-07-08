// Dependencies
const util = require('util')
let request = util.promisify(require('postman-request'))

// Includes
const options = require('../options.js')
const settings = require('../../settings.json')
const cache = require('../cache')
const getHash = require('./getHash.js').func
const proxyConfig = require('./proxyConfig.js')

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
  // Store original URL for proxy header generation
  const originalUrl = url

  if (opt?.headers) {
    opt.headers = Object.fromEntries(
      Object.entries(opt.headers).map(([k, v]) => [k.toLowerCase(), v])
    )
  }
  if (opt && !opt.jar && Object.keys(opt).indexOf('jar') > -1) {
    opt.jar = options.jar
  }
  if (settings.session_only && opt && opt.jar) {
    if (!opt.headers) {
      opt.headers = {}
    }
    opt.headers.cookie = '.ROBLOSECURITY=' + opt.jar.session + ';'
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

  // Apply proxy transformation if enabled
  if (proxyConfig.shouldProxy(originalUrl)) {
    url = proxyConfig.transformUrl(url)

    // Add proxy headers
    const proxyHeaders = proxyConfig.getProxyHeaders(originalUrl)
    if (!opt) {
      opt = {}
    }
    if (!opt.headers) {
      opt.headers = {}
    }
    Object.assign(opt.headers, proxyHeaders)
  }

  return request(url, opt)
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
        cache.add(options.cache, 'XCSRF', getHash({ jar }), opt.headers['x-csrf-token'])
      }
    }
    if (res.statusCode === 302 && !args.ignoreLoginError && res.headers.location && (res.headers.location.startsWith('https://www.roblox.com/newlogin') || res.headers.location.startsWith('/Login/Default.aspx'))) {
      throw new Error('You are not logged in')
    }
    return full ? res : res.body
  }).catch(function (err) {
    // Check if this was a proxy request and fallback is enabled
    const config = proxyConfig.getProxyConfig()
    if (config.fallback && proxyConfig.shouldProxy(args.url) && !args._proxyFallbackAttempted) {
      // Mark that we've attempted fallback to prevent infinite loops
      args._proxyFallbackAttempted = true

      // Create new options without proxy headers
      const fallbackOpt = { ...opt }
      if (fallbackOpt.headers) {
        delete fallbackOpt.headers.proxykey
        delete fallbackOpt.headers.hostname
        delete fallbackOpt.headers['x-country']
      }

      // Make direct request to original URL
      let fallbackUrl = args.url
      if (fallbackUrl.indexOf('http') !== 0) {
        fallbackUrl = 'https:' + fallbackUrl
      }

      return request(fallbackUrl, fallbackOpt).then(function (res) {
        if (res.statusCode === 403 && res.headers['x-csrf-token'] && Object.hasOwn(fallbackOpt.headers ?? {}, 'x-csrf-token')) {
          if (depth >= 2) {
            throw new Error('Tried ' + (depth + 1) + ' times and could not refresh XCSRF token successfully')
          }

          const token = res.headers['x-csrf-token']

          if (token) {
            fallbackOpt.headers['x-csrf-token'] = token
            fallbackOpt.jar = jar
            args.depth = depth + 1
            return exports.func(args)
          } else {
            throw new Error('Could not refresh X-CSRF-TOKEN')
          }
        } else {
          if (depth > 0) {
            cache.add(options.cache, 'XCSRF', getHash({ jar }), fallbackOpt.headers['x-csrf-token'])
          }
        }
        if (res.statusCode === 302 && !args.ignoreLoginError && res.headers.location && (res.headers.location.startsWith('https://www.roblox.com/newlogin') || res.headers.location.startsWith('/Login/Default.aspx'))) {
          throw new Error('You are not logged in')
        }
        return full ? res : res.body
      })
    }

    // Re-throw the original error if no fallback or fallback not applicable
    throw err
  })
}