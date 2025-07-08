// Includes
const settings = require('../../settings.json')

// Docs
/**
 * ✅ Proxy configuration utilities for rblxprxy.bloxboom.com service
 * @category Utility
 * @alias proxyConfig
 */

/**
 * Check if a URL should be proxied based on current configuration
 * @param {string} url - The URL to check
 * @returns {boolean} - Whether the URL should be proxied
 */
function shouldProxy(url) {
  const config = getProxyConfig()
  
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
 * Transform a Roblox URL to use the proxy service
 * @param {string} url - The original Roblox URL
 * @returns {string} - The transformed proxy URL
 */
function transformUrl(url) {
  const config = getProxyConfig()
  
  if (!shouldProxy(url)) {
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
  return `https://rblxprxy.bloxboom.com/v${path}`
}

/**
 * Get proxy headers for a request
 * @param {string} originalUrl - The original Roblox URL
 * @returns {object} - Headers to add to the request
 */
function getProxyHeaders(originalUrl) {
  const config = getProxyConfig()
  const headers = {}
  
  if (!shouldProxy(originalUrl)) {
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
 * Get current proxy configuration
 * @returns {object} - Current proxy configuration
 */
function getProxyConfig() {
  // Check for environment variables first
  const envConfig = {
    enabled: process.env.RBLXPRXY_ENABLED === 'true',
    key: process.env.RBLXPRXY_KEY || '',
    country: process.env.RBLXPRXY_COUNTRY || '',
    domains: settings.rblxprxy.domains,
    fallback: process.env.RBLXPRXY_FALLBACK !== 'false'
  }

  // If environment variables are set, use them
  if (envConfig.enabled && envConfig.key) {
    return envConfig
  }

  // Otherwise use settings.json configuration
  return {
    enabled: settings.rblxprxy.enabled,
    key: settings.rblxprxy.key,
    country: settings.rblxprxy.country,
    domains: settings.rblxprxy.domains,
    fallback: settings.rblxprxy.fallback
  }
}

/**
 * Validate proxy configuration
 * @param {object} config - Configuration to validate
 * @returns {object} - Validation result with isValid and errors
 */
function validateConfig(config) {
  const errors = []
  
  if (config.enabled) {
    if (!config.key || typeof config.key !== 'string' || config.key.trim() === '') {
      errors.push('Proxy key is required when proxy is enabled')
    }
    
    if (config.country && (typeof config.country !== 'string' || !/^[a-z]{2}$/i.test(config.country))) {
      errors.push('Country code must be a 2-letter ISO country code (e.g., "us", "uk", "ca")')
    }
    
    if (!Array.isArray(config.domains) || config.domains.length === 0) {
      errors.push('At least one domain must be configured for proxying')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Update proxy configuration at runtime
 * @param {object} newConfig - New configuration options
 * @returns {object} - Validation result
 */
function updateConfig(newConfig) {
  const validation = validateConfig(newConfig)
  
  if (!validation.isValid) {
    throw new Error('Invalid proxy configuration: ' + validation.errors.join(', '))
  }
  
  // Update settings object
  Object.assign(settings.rblxprxy, newConfig)
  
  return validation
}

module.exports = {
  shouldProxy,
  transformUrl,
  getProxyHeaders,
  getProxyConfig,
  validateConfig,
  updateConfig
}
