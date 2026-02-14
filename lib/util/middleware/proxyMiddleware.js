// Includes
const proxyConfig = require('../proxyConfig.js')

// Docs
/**
 * ✅ Proxy middleware for request transformation and fallback handling
 * @category Utility
 * @alias proxyMiddleware
 */

/**
 * Determine effective proxy configuration by merging global config with per-request override
 * @param {object} requestOptions - Request-level options that may include proxy override
 * @returns {object|null} - Effective proxy config or null if proxy should be disabled
 */
function getEffectiveConfig(requestOptions = {}) {
  const globalConfig = proxyConfig.getProxyConfig()

  // If no per-request proxy override, use global config
  if (!requestOptions.proxy) {
    return globalConfig.enabled && globalConfig.key ? globalConfig : null
  }

  // Explicit disable at request level
  if (requestOptions.proxy.enabled === false) {
    return null
  }

  // Merge with priority to request-level override
  const effectiveConfig = {
    enabled: requestOptions.proxy.enabled ?? globalConfig.enabled,
    key: requestOptions.proxy.key ?? globalConfig.key,
    country: requestOptions.proxy.country ?? globalConfig.country,
    url: requestOptions.proxy.url ?? globalConfig.url,
    domains: requestOptions.proxy.domains ?? globalConfig.domains,
    fallback: requestOptions.proxy.fallback ?? globalConfig.fallback
  }

  // Only return config if enabled and has required fields
  return effectiveConfig.enabled && effectiveConfig.key ? effectiveConfig : null
}

/**
 * Apply proxy transformation to request arguments
 * @param {object} requestArgs - Object containing {url, options}
 * @param {object} options - Request options (may include proxy override)
 * @returns {object} - Transformed request arguments with originalUrl preserved
 */
function applyProxy(requestArgs, options = {}) {
  const { url } = requestArgs
  const opt = requestArgs.options || {}

  // Store original URL for fallback and header generation
  const originalUrl = url

  // Get effective proxy configuration (global + per-request override)
  const effectiveConfig = getEffectiveConfig(opt)

  // If proxy is not enabled or not configured, return unchanged
  if (!effectiveConfig) {
    return {
      url,
      options: opt,
      originalUrl,
      proxyApplied: false
    }
  }

  // Temporarily override proxyConfig to use effective config for this request
  const shouldUseProxy = shouldProxyWithConfig(originalUrl, effectiveConfig)

  if (!shouldUseProxy) {
    return {
      url,
      options: opt,
      originalUrl,
      proxyApplied: false
    }
  }

  // Transform URL
  const transformedUrl = transformUrlWithConfig(url, effectiveConfig)

  // Generate proxy headers
  const proxyHeaders = getProxyHeadersWithConfig(originalUrl, effectiveConfig)

  // Merge headers into options
  const transformedOpt = { ...opt }
  if (!transformedOpt.headers) {
    transformedOpt.headers = {}
  }
  Object.assign(transformedOpt.headers, proxyHeaders)

  return {
    url: transformedUrl,
    options: transformedOpt,
    originalUrl,
    proxyApplied: true,
    effectiveConfig
  }
}

/**
 * Check if URL should be proxied using a specific config
 * @param {string} url - The URL to check
 * @param {object} config - The proxy configuration to use
 * @returns {boolean} - Whether the URL should be proxied
 */
function shouldProxyWithConfig(url, config) {
  if (!config.enabled || !config.key) {
    return false
  }

  // Extract hostname from URL
  let hostname
  try {
    if (url.startsWith('//')) {
      hostname = url.substring(2).split('/')[0]
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      hostname = new URL(url).hostname
    } else {
      return false
    }
  } catch (error) {
    return false
  }

  // Check if hostname is in the configured domains list
  return config.domains.includes(hostname)
}

/**
 * Transform URL using a specific config
 * @param {string} url - The original URL
 * @param {object} config - The proxy configuration to use
 * @returns {string} - The transformed proxy URL
 */
function transformUrlWithConfig(url, config) {
  if (!shouldProxyWithConfig(url, config)) {
    return url
  }

  let originalHostname
  let path = ''

  try {
    if (url.startsWith('//')) {
      const parts = url.substring(2).split('/')
      originalHostname = parts[0]
      path = '/' + parts.slice(1).join('/')
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url)
      originalHostname = urlObj.hostname
      path = urlObj.pathname + urlObj.search + urlObj.hash
    } else {
      return url
    }
  } catch (error) {
    return url
  }

  // Transform to proxy URL
  const proxyBaseUrl = config.url || ''
  if (!proxyBaseUrl) {
    throw new Error('Proxy URL is required when proxy is enabled')
  }
  return `${proxyBaseUrl}${path}`
}

/**
 * Get proxy headers using a specific config
 * @param {string} originalUrl - The original URL
 * @param {object} config - The proxy configuration to use
 * @returns {object} - Headers to add to the request
 */
function getProxyHeadersWithConfig(originalUrl, config) {
  const headers = {}

  if (!shouldProxyWithConfig(originalUrl, config)) {
    return headers
  }

  // Extract original hostname
  let originalHostname
  try {
    if (originalUrl.startsWith('//')) {
      originalHostname = originalUrl.substring(2).split('/')[0]
    } else if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
      originalHostname = new URL(originalUrl).hostname
    }
  } catch (error) {
    return headers
  }

  if (originalHostname) {
    headers.proxykey = config.key
    headers.hostname = originalHostname

    if (config.country) {
      headers['x-country'] = config.country
    }
  }

  return headers
}

/**
 * Remove proxy headers from request options
 * @param {object} options - Request options
 * @returns {object} - Options with proxy headers removed
 */
function removeProxyHeaders(options) {
  const cleanedOptions = { ...options }

  if (cleanedOptions.headers) {
    delete cleanedOptions.headers.proxykey
    delete cleanedOptions.headers.hostname
    delete cleanedOptions.headers['x-country']
  }

  return cleanedOptions
}

/**
 * Handle proxy request failure with fallback to direct request
 * @param {Error} error - The error from the proxy request
 * @param {object} context - Context object with {originalUrl, options, attempt, effectiveConfig}
 * @returns {Promise<object>} - Retry request args or null if no fallback
 */
function handleProxyError(error, context) {
  const { originalUrl, options, attempt = 0, effectiveConfig } = context

  // Only attempt fallback if:
  // 1. This is the first attempt (prevent infinite loops)
  // 2. Fallback is enabled in config
  // 3. The original request was proxied
  if (attempt > 0 || !effectiveConfig || !effectiveConfig.fallback) {
    return Promise.reject(error)
  }

  // Create fallback options without proxy headers
  const fallbackOptions = removeProxyHeaders(options)

  // Prepare fallback URL (original URL, ensuring https protocol)
  let fallbackUrl = originalUrl
  if (fallbackUrl.indexOf('http') !== 0) {
    fallbackUrl = 'https:' + fallbackUrl
  }

  // Return fallback request arguments
  return Promise.resolve({
    url: fallbackUrl,
    options: fallbackOptions,
    attempt: attempt + 1
  })
}

module.exports = {
  applyProxy,
  handleProxyError,
  getEffectiveConfig,
  removeProxyHeaders,
  // Internal functions exposed for testing
  shouldProxyWithConfig,
  transformUrlWithConfig,
  getProxyHeadersWithConfig
}
