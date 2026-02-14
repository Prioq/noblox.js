// Includes
const proxyMiddleware = require('./proxyMiddleware.js')

// Docs
/**
 * ✅ Middleware chain orchestrator for request processing
 * @category Utility
 * @alias middleware
 */

/**
 * Execute middleware chain on request arguments
 * This applies registered middleware in order, allowing each to transform the request
 *
 * @param {object} requestArgs - Object containing {url, options}
 * @returns {object} - Transformed request arguments
 */
function executeChain(requestArgs) {
  const { url, options } = requestArgs

  // Apply proxy middleware
  // Future: Additional middleware can be added here (logging, metrics, etc.)
  const result = proxyMiddleware.applyProxy({ url, options }, options)

  return result
}

module.exports = {
  executeChain,
  proxyMiddleware  // Export for error handling
}
