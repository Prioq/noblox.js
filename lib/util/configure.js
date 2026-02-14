// Includes
const setOptions = require('./setOptions.js')
const proxyConfig = require('./proxyConfig.js')

// Args
exports.optional = ['options']

// Docs
/**
 * ✅ Configure noblox.js with advanced options including proxy settings.
 * This is an enhanced version of setOptions that provides additional validation
 * and configuration capabilities, particularly for proxy settings.
 * @category Utility
 * @alias configure
 * @param {object} options - Configuration options
 * @param {object} [options.proxy] - Proxy configuration
 * @param {boolean} [options.proxy.enabled] - Enable proxy service
 * @param {string} [options.proxy.key] - Proxy authentication key
 * @param {string} [options.proxy.country] - Country code for IP routing
 * @param {string} [options.proxy.url] - Proxy service base URL
 * @param {string[]} [options.proxy.domains] - Domains to proxy
 * @param {boolean} [options.proxy.fallback] - Enable fallback to direct requests
 * @returns {object} Configuration result with validation info
 * @example const noblox = require("noblox.js")
 * // Configure with proxy settings
 * noblox.configure({
 *   proxy: {
 *     enabled: true,
 *     key: 'your-proxy-key',
 *     country: 'us',
 *     url: 'https://your-proxy-service.com/api'
 *   }
 * })
 */

exports.func = function (args) {
  const options = args.options || {}
  const result = {
    success: true,
    warnings: [],
    errors: []
  }

  // Handle proxy configuration separately for enhanced validation
  if (options.proxy) {
    try {
      // Map user-friendly proxy config to internal format
      const proxyOptions = {
        proxy: {
          enabled: options.proxy.enabled !== undefined ? options.proxy.enabled : false,
          key: options.proxy.key || '',
          country: options.proxy.country || '',
          url: options.proxy.url || '',
          domains: options.proxy.domains || [
            'accountinformation.roblox.com',
            'accountsettings.roblox.com',
            'api.roblox.com',
            'apis.roblox.com',
            'auth.roblox.com',
            'avatar.roblox.com',
            'badges.roblox.com',
            'catalog.roblox.com',
            'chat.roblox.com',
            'data.roblox.com',
            'develop.roblox.com',
            'economy.roblox.com',
            'friends.roblox.com',
            'games.roblox.com',
            'groups.roblox.com',
            'inventory.roblox.com',
            'itemconfiguration.roblox.com',
            'presence.roblox.com',
            'privatemessages.roblox.com',
            'realtime-signalr.roblox.com',
            'thumbnails.roblox.com',
            'trades.roblox.com',
            'users.roblox.com',
            'www.roblox.com'
          ],
          fallback: options.proxy.fallback !== undefined ? options.proxy.fallback : true
        }
      }

      // Validate proxy configuration
      const validation = proxyConfig.validateConfig(proxyOptions.proxy)

      if (!validation.isValid) {
        result.success = false
        result.errors.push(...validation.errors)
        return result
      }

      // Update proxy configuration
      proxyConfig.updateConfig(proxyOptions.proxy)
      
      // Remove proxy from options to avoid passing it to setOptions
      const optionsWithoutProxy = { ...options }
      delete optionsWithoutProxy.proxy
      
      // Apply other options using existing setOptions
      if (Object.keys(optionsWithoutProxy).length > 0) {
        setOptions(optionsWithoutProxy)
      }

      result.warnings.push('Proxy configuration updated successfully')
      
    } catch (error) {
      result.success = false
      result.errors.push('Proxy configuration error: ' + error.message)
      return result
    }
  } else {
    // No proxy configuration, just use regular setOptions
    setOptions(options)
  }

  return result
}

/**
 * ✅ Get current configuration including proxy settings
 * @category Utility
 * @alias getConfiguration
 * @returns {object} Current configuration
 * @example const noblox = require("noblox.js")
 * const config = noblox.getConfiguration()
 * // Check proxy configuration
 */
function getConfiguration() {
  const proxyConf = proxyConfig.getProxyConfig()

  return {
    proxy: {
      enabled: proxyConf.enabled,
      key: proxyConf.key ? '***' : '', // Mask the key for security
      url: proxyConf.url,
      country: proxyConf.country,
      domains: proxyConf.domains,
      fallback: proxyConf.fallback
    }
  }
}

/**
 * ✅ Test proxy configuration by making a test request
 * @category Utility
 * @alias testProxyConfiguration
 * @returns {Promise<object>} Test result
 * @example const noblox = require("noblox.js")
 * const testResult = await noblox.testProxyConfiguration()
 * // Check testResult.success for test status
 */
async function testProxyConfiguration() {
  const http = require('./http.js').func
  const config = proxyConfig.getProxyConfig()
  
  if (!config.enabled) {
    return {
      success: false,
      message: 'Proxy is not enabled'
    }
  }

  if (!config.key) {
    return {
      success: false,
      message: 'Proxy key is not configured'
    }
  }

  try {
    // Test with a simple API endpoint
    const testUrl = '//users.roblox.com/v1/users/1'
    const startTime = Date.now()
    
    const response = await http({
      url: testUrl,
      options: {
        method: 'GET',
        resolveWithFullResponse: true
      }
    })
    
    const endTime = Date.now()
    const responseTime = endTime - startTime

    if (response.statusCode === 200) {
      return {
        success: true,
        message: 'Proxy test successful',
        responseTime: responseTime,
        statusCode: response.statusCode
      }
    } else {
      return {
        success: false,
        message: `Proxy test failed with status ${response.statusCode}`,
        responseTime: responseTime,
        statusCode: response.statusCode
      }
    }
  } catch (error) {
    return {
      success: false,
      message: 'Proxy test failed: ' + error.message,
      error: error.message
    }
  }
}

// Export additional functions
exports.getConfiguration = getConfiguration
exports.testProxyConfiguration = testProxyConfiguration
