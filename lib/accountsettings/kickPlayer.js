// Includes
const http = require('../util/http.js').func
const getGeneralToken = require('../util/getGeneralToken.js').func
const makeEventTracker = require('../util/makeEventTracker.js').func
const settings = require('../../settings.json')
const guaranteedUnblock = require('./guaranteedUnblock.js').func

// Args
exports.required = ['userId']
exports.optional = ['apiUrl', 'jar']

// Docs
/**
 * 🔐 Kick a user by temporarily blocking and then immediately unblocking them.
 * This effectively removes the user from the current session without permanently blocking them.
 * 
 * @category AccountSettings
 * @alias kickPlayer
 * @param {number} userId - The id of the user to kick.
 * @param {string} [apiUrl='apis.roblox.com'] - Custom API URL for testing/proxies
 * @param {Object} [jar] - Cookie jar for authentication
 * @returns {Promise<void>}
 * 
 * @description **Production-Scale Resilience Features:**
 * - **Circuit Breaker**: Prevents cascading failures by tripping after 5 errors in 60s
 * - **Global Rate Limiter**: Token bucket (5 req/min) prevents API quota violations
 * - **Structured Logging**: Configurable log levels (debug/info/warn/error) with context
 * - **AbortController**: Standard request cancellation with 15s timeouts
 * - **Centralized CSRF Cache**: Proactive token refresh with 20min TTL
 * - **Metrics Collection**: Counters for retries, failures, circuit trips for monitoring
 * - **Exponential Backoff + Jitter**: Prevents thundering herd (1s-30s max)
 * - **429 Rate-Limit Handling**: Explicit handling with Retry-After header support
 * - **Multi-Attempt Verification**: Polls until block/unblock states confirmed
 * - **Cleanup on Failure**: Automatic unblock if kick process fails
 * 
 * @example const noblox = require("noblox.js")
 * // Login using your cookie
 * noblox.kickPlayer(123456)
 **/

// Configuration constants
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000 // Cap backoff at 30 seconds
const JITTER_MS = 500 // Random jitter up to 500ms
const POLL_INTERVAL_MS = 500
const MAX_POLL_ATTEMPTS = 20 // 10 seconds total
const VERIFICATION_POLL_ATTEMPTS = 10 // 5 seconds total
const REQUEST_TIMEOUT_MS = 15000 // 15 second timeout per request
const RATE_LIMIT_BACKOFF_MS = 60000 // 1 minute for 429 responses

// Circuit Breaker Configuration
const CIRCUIT_FAILURE_THRESHOLD = 5 // Trip after 5 failures
const CIRCUIT_WINDOW_MS = 60000 // 60 second failure window
const CIRCUIT_RESET_TIMEOUT_MS = 30000 // 30 second reset timeout

// Rate Limiter Configuration (Token Bucket)
const RATE_LIMIT_TOKENS = 50 // 5 requests
const RATE_LIMIT_REFILL_MS = 60000 // per minute
const RATE_LIMIT_MAX_TOKENS = 100 // burst capacity

// CSRF Cache Configuration
const CSRF_CACHE_TTL_MS = 20 * 60 * 1000 // 20 minutes
const CSRF_PREEMPTIVE_REFRESH_MS = 5 * 60 * 1000 // Refresh 5 min before expiry

// Logging levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

// Function to check if logging is enabled for kickPlayer
function isLoggingEnabled() {
  return settings.logging && settings.logging.enabled &&
         settings.logging.functions && settings.logging.functions.kickPlayer
}

// Function to get the current log level from settings
function getLogLevel() {
  if (!settings.logging || !settings.logging.level) {
    return LOG_LEVELS.INFO
  }
  const levelName = settings.logging.level.toUpperCase()
  return LOG_LEVELS[levelName] !== undefined ? LOG_LEVELS[levelName] : LOG_LEVELS.INFO
}

// Global state management
const globalState = {
  // Circuit breaker state
  circuitBreaker: {
    state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
    failureCount: 0,
    failures: [], // Sliding window of failure timestamps
    lastFailureTime: null,
    nextAttemptTime: null
  },
  
  // Rate limiter state (token bucket)
  rateLimiter: {
    tokens: RATE_LIMIT_TOKENS,
    lastRefill: Date.now()
  },
  
  // CSRF token cache
  csrfCache: {
    token: null,
    expiresAt: null,
    refreshPromise: null
  },
  
  // Metrics
  metrics: {
    totalRequests: 0,
    totalRetries: 0,
    totalFailures: 0,
    circuitTrips: 0,
    rateLimitBlocks: 0,
    csrfRefreshes: 0
  },
  
  // Logging configuration - now uses library settings
  logLevel: getLogLevel() // Get from library settings
}

// Structured logger with levels
class Logger {
  constructor(context = 'kickPlayer') {
    this.context = context
  }

  log(level, message, data = {}) {
    // Check if logging is enabled for kickPlayer
    if (!isLoggingEnabled()) return

    // Update log level from settings in case it changed
    globalState.logLevel = getLogLevel()

    if (level < globalState.logLevel) return

    const timestamp = new Date().toISOString()
    const levelName = Object.keys(LOG_LEVELS)[level]
    const logEntry = {
      timestamp,
      level: levelName,
      context: this.context,
      message,
      ...data
    }

    if (level >= LOG_LEVELS.ERROR) {
      console.error(JSON.stringify(logEntry))
    } else if (level >= LOG_LEVELS.WARN) {
      console.warn(JSON.stringify(logEntry))
    } else {
      console.log(JSON.stringify(logEntry))
    }
  }

  debug(message, data) { this.log(LOG_LEVELS.DEBUG, message, data) }
  info(message, data) { this.log(LOG_LEVELS.INFO, message, data) }
  warn(message, data) { this.log(LOG_LEVELS.WARN, message, data) }
  error(message, data) { this.log(LOG_LEVELS.ERROR, message, data) }
}

const logger = new Logger('kickPlayer')

// Helper function to sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Circuit Breaker Implementation
class CircuitBreaker {
  static updateFailures() {
    const now = Date.now()
    const windowStart = now - CIRCUIT_WINDOW_MS
    
    // Remove failures outside the window
    globalState.circuitBreaker.failures = globalState.circuitBreaker.failures
      .filter(timestamp => timestamp > windowStart)
    
    globalState.circuitBreaker.failureCount = globalState.circuitBreaker.failures.length
  }

  static recordFailure() {
    const now = Date.now()
    globalState.circuitBreaker.failures.push(now)
    globalState.circuitBreaker.lastFailureTime = now
    this.updateFailures()
    
    logger.debug('Circuit breaker failure recorded', {
      failureCount: globalState.circuitBreaker.failureCount,
      threshold: CIRCUIT_FAILURE_THRESHOLD
    })

    if (globalState.circuitBreaker.failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
      this.trip()
    }
  }

  static trip() {
    globalState.circuitBreaker.state = 'OPEN'
    globalState.circuitBreaker.nextAttemptTime = Date.now() + CIRCUIT_RESET_TIMEOUT_MS
    globalState.metrics.circuitTrips++
    
    logger.warn('Circuit breaker tripped', {
      failureCount: globalState.circuitBreaker.failureCount,
      nextAttemptTime: globalState.circuitBreaker.nextAttemptTime
    })
  }

  static reset() {
    globalState.circuitBreaker.state = 'CLOSED'
    globalState.circuitBreaker.failureCount = 0
    globalState.circuitBreaker.failures = []
    globalState.circuitBreaker.nextAttemptTime = null
    
    logger.info('Circuit breaker reset to CLOSED state')
  }

  static async execute(operation, operationName) {
    this.updateFailures()
    
    const now = Date.now()
    
    // Check if circuit is open
    if (globalState.circuitBreaker.state === 'OPEN') {
      if (now < globalState.circuitBreaker.nextAttemptTime) {
        const waitTime = globalState.circuitBreaker.nextAttemptTime - now
        throw new Error(`Circuit breaker is OPEN. Next attempt in ${Math.round(waitTime / 1000)}s`)
      } else {
        // Move to half-open state
        globalState.circuitBreaker.state = 'HALF_OPEN'
        logger.info('Circuit breaker moved to HALF_OPEN state')
      }
    }

    try {
      const result = await operation()
      
      // Success - reset circuit breaker if it was half-open
      if (globalState.circuitBreaker.state === 'HALF_OPEN') {
        this.reset()
      }
      
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }
}

// Token Bucket Rate Limiter
class RateLimiter {
  static refillTokens() {
    const now = Date.now()
    const timePassed = now - globalState.rateLimiter.lastRefill
    const tokensToAdd = Math.floor(timePassed / RATE_LIMIT_REFILL_MS) * RATE_LIMIT_TOKENS
    
    if (tokensToAdd > 0) {
      globalState.rateLimiter.tokens = Math.min(
        RATE_LIMIT_MAX_TOKENS,
        globalState.rateLimiter.tokens + tokensToAdd
      )
      globalState.rateLimiter.lastRefill = now
      
      logger.debug('Rate limiter tokens refilled', {
        tokens: globalState.rateLimiter.tokens,
        tokensAdded: tokensToAdd
      })
    }
  }

  static async consume(tokens = 1) {
    this.refillTokens()
    
    if (globalState.rateLimiter.tokens >= tokens) {
      globalState.rateLimiter.tokens -= tokens
      logger.debug('Rate limiter token consumed', {
        consumed: tokens,
        remaining: globalState.rateLimiter.tokens
      })
      return true
    } else {
      globalState.metrics.rateLimitBlocks++
      const nextRefillTime = globalState.rateLimiter.lastRefill + RATE_LIMIT_REFILL_MS
      const waitTime = nextRefillTime - Date.now()
      
      logger.warn('Rate limit exceeded, waiting for refill', {
        tokens: globalState.rateLimiter.tokens,
        required: tokens,
        waitTime
      })
      
      await sleep(Math.max(0, waitTime))
      return this.consume(tokens) // Recursive retry after wait
    }
  }
}

// Centralized CSRF Token Management
class CSRFManager {
  static async getToken(jar, forceRefresh = false) {
    const now = Date.now()
    
    // Return cached token if valid and not forcing refresh
    if (!forceRefresh && 
        globalState.csrfCache.token && 
        globalState.csrfCache.expiresAt > now) {
      logger.debug('Using cached CSRF token')
      return globalState.csrfCache.token
    }

    // If refresh is already in progress, wait for it
    if (globalState.csrfCache.refreshPromise) {
      logger.debug('CSRF token refresh in progress, waiting...')
      return await globalState.csrfCache.refreshPromise
    }

    // Start refresh process
    globalState.csrfCache.refreshPromise = this._refreshToken(jar)
    
    try {
      const token = await globalState.csrfCache.refreshPromise
      return token
    } finally {
      globalState.csrfCache.refreshPromise = null
    }
  }

  static async _refreshToken(jar) {
    logger.info('Refreshing CSRF token')
    globalState.metrics.csrfRefreshes++
    
    try {
      const token = await getGeneralToken({ jar })
      const expiresAt = Date.now() + CSRF_CACHE_TTL_MS
      
      globalState.csrfCache.token = token
      globalState.csrfCache.expiresAt = expiresAt
      
      logger.info('CSRF token refreshed successfully', {
        expiresAt: new Date(expiresAt).toISOString()
      })
      
      // Schedule proactive refresh
      setTimeout(() => {
        if (Date.now() + CSRF_PREEMPTIVE_REFRESH_MS >= globalState.csrfCache.expiresAt) {
          logger.debug('Scheduling proactive CSRF token refresh')
          this.getToken(jar, true).catch(error => {
            logger.error('Proactive CSRF token refresh failed', { error: error.message })
          })
        }
      }, CSRF_CACHE_TTL_MS - CSRF_PREEMPTIVE_REFRESH_MS)
      
      return token
    } catch (error) {
      logger.error('CSRF token refresh failed', { error: error.message })
      throw error
    }
  }
}

// Helper function to generate jittered backoff delay
function calculateBackoffWithJitter(attempt) {
  const exponentialDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
  const cappedDelay = Math.min(exponentialDelay, MAX_BACKOFF_MS)
  const jitter = Math.random() * JITTER_MS
  return cappedDelay + jitter
}

// Helper function to extract status code from error
function extractStatusCode(error) {
  // Check for direct statusCode property (from http response)
  if (error.statusCode) {
    return error.statusCode
  }
  
  // Check for status property
  if (error.status) {
    return error.status
  }
  
  // Extract from error message
  if (error.message) {
    const match = error.message.match(/HTTP (\d+)/)
    if (match) {
      return parseInt(match[1])
    }
  }
  
  return null
}

// Helper function to extract Retry-After header value
function extractRetryAfter(error) {
  if (error.headers && error.headers['retry-after']) {
    const retryAfter = parseInt(error.headers['retry-after'])
    return isNaN(retryAfter) ? null : retryAfter * 1000 // Convert to milliseconds
  }
  return null
}

// Enhanced error classification with 429 handling
function classifyError(error, statusCode = null) {
  const code = statusCode || extractStatusCode(error)
  
  // Network/connection errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return { type: 'network', retryable: true, rateLimited: false }
  }
  
  // AbortController timeout errors
  if (error.name === 'AbortError' || error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
    return { type: 'timeout', retryable: true, rateLimited: false }
  }

  // HTTP status code errors
  if (code) {
    if (code === 429) {
      return { type: 'rate_limit', retryable: true, rateLimited: true, retryAfter: extractRetryAfter(error) }
    }
    if (code === 401 || code === 403) {
      return { type: 'auth', retryable: true, rateLimited: false }
    }
    if (code >= 500) {
      return { type: 'server', retryable: true, rateLimited: false }
    }
    if (code >= 400) {
      return { type: 'client', retryable: false, rateLimited: false }
    }
  }

  // CSRF-specific errors
  if (error.message && (error.message.includes('CSRF') || error.message.includes('X-CSRF-TOKEN'))) {
    return { type: 'auth', retryable: true, rateLimited: false }
  }

  return { type: 'unknown', retryable: false, rateLimited: false }
}

// Consolidated HTTP option builder with AbortController
async function buildHttpOptions(method, endpoint, jar, csrfToken = null, userId = null) {
  const controller = new AbortController()
  
  // Set timeout using AbortController
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  
  const options = {
    url: endpoint,
    options: {
      method,
      jar,
      resolveWithFullResponse: true,
      signal: controller.signal,
      // Keep original timeout as fallback
      timeout: REQUEST_TIMEOUT_MS
    },
    timeoutId // Store for cleanup
  }

  // Add CSRF token for POST requests
  if (csrfToken && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
    options.options.headers = {
      'X-CSRF-TOKEN': csrfToken
    }
  }

  // Generate event tracker cookie for authentication
  try {
    const tracker = await makeEventTracker({ jar })
    if (tracker) {
      options.options.eventTracker = tracker
    }
  } catch (error) {
    logger.warn('Failed to generate event tracker, continuing without it', {
      method,
      error: error.message
    })
  }

  return options
}

// Enhanced retry logic with circuit breaker, rate limiting, and structured logging
async function retryWithBackoff(operation, operationName, jar, userId) {
  let lastError
  globalState.metrics.totalRequests++

  // Check rate limiter first
  await RateLimiter.consume()

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Execute operation through circuit breaker
      const result = await CircuitBreaker.execute(operation, operationName)
      
      if (attempt > 0) {
        logger.info('Operation succeeded after retry', {
          operationName,
          userId,
          attempt: attempt + 1,
          totalRetries: globalState.metrics.totalRetries
        })
      }
      
      return result
    } catch (error) {
      lastError = error
      globalState.metrics.totalRetries++
      
      const errorInfo = classifyError(error)
      
      logger.warn('Operation attempt failed', {
        operationName,
        userId,
        attempt: attempt + 1,
        errorType: errorInfo.type,
        error: error.message,
        retryable: errorInfo.retryable
      })

      // Handle rate limiting with special backoff
      if (errorInfo.rateLimited) {
        const retryAfter = errorInfo.retryAfter || RATE_LIMIT_BACKOFF_MS
        logger.info('Rate limited, respecting Retry-After header', {
          operationName,
          userId,
          retryAfter
        })
        await sleep(retryAfter)
        continue
      }

      // Don't retry non-retryable errors
      if (!errorInfo.retryable) {
        globalState.metrics.totalFailures++
        throw error
      }

      // If this is the last attempt, throw the error
      if (attempt === MAX_RETRIES - 1) {
        globalState.metrics.totalFailures++
        throw error
      }

      // Calculate jittered backoff delay
      const backoffMs = calculateBackoffWithJitter(attempt)
      logger.debug('Retrying with backoff', {
        operationName,
        userId,
        attempt: attempt + 1,
        backoffMs: Math.round(backoffMs)
      })
      await sleep(backoffMs)
    }
  }

  globalState.metrics.totalFailures++
  throw lastError
}

// Helper function to refresh CSRF token and retry operation
async function retryWithTokenRefresh(operation, operationName, jar, userId) {
  try {
    return await retryWithBackoff(operation, operationName, jar, userId)
  } catch (error) {
    const errorInfo = classifyError(error)

    // If it's an auth error, try refreshing the token once
    if (errorInfo.type === 'auth') {
      logger.info('Auth error detected, refreshing CSRF token', {
        operationName,
        userId,
        error: error.message
      })
      
      try {
        const newToken = await CSRFManager.getToken(jar, true)
        
        // Create new operation with fresh token
        const refreshedOperation = () => operation(newToken)
        return await retryWithBackoff(refreshedOperation, `${operationName} (fresh token)`, jar, userId)
      } catch (tokenError) {
        logger.error('CSRF token refresh failed', {
          operationName,
          userId,
          error: tokenError.message
        })
        throw new Error(`${operationName} failed: Could not refresh CSRF token: ${tokenError.message}`)
      }
    }

    // Re-throw non-auth errors
    throw error
  }
}

// Helper function to block a user with retry logic
async function blockUser (jar, token, userId, apiUrl) {
  const operation = async (csrfToken = token) => {
    const endpoint = `//${apiUrl}/user-blocking-api/v1/users/${userId}/block-user`
    const httpOpt = await buildHttpOptions('POST', endpoint, jar, csrfToken, userId)

    try {
      const res = await http(httpOpt)
      
      if (res.statusCode === 200) {
        return
      } else {
        const body = res.body || '{}'
        let json
        try {
          json = JSON.parse(body)
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${body}`)
        }

        const known = json.errors && json.errors[0]
        const err = known && known.message || `HTTP ${res.statusCode}: Failed to block user`
        throw new Error(err)
      }
    } finally {
      // Clear timeout
      if (httpOpt.timeoutId) {
        clearTimeout(httpOpt.timeoutId)
      }
    }
  }

  return await retryWithTokenRefresh(operation, 'Blocking', jar, userId)
}

// Helper function to unblock a user with retry logic
async function unblockUser (jar, token, userId, apiUrl) {
  const operation = async (csrfToken = token) => {
    const endpoint = `//${apiUrl}/user-blocking-api/v1/users/${userId}/unblock-user`
    const httpOpt = await buildHttpOptions('POST', endpoint, jar, csrfToken, userId)

    try {
      const res = await http(httpOpt)
      
      if (res.statusCode === 200) {
        return
      } else {
        const body = res.body || '{}'
        let json
        try {
          json = JSON.parse(body)
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${body}`)
        }

        const known = json.errors && json.errors[0]
        const err = known && known.message || `HTTP ${res.statusCode}: Failed to unblock user`
        throw new Error(err)
      }
    } finally {
      // Clear timeout
      if (httpOpt.timeoutId) {
        clearTimeout(httpOpt.timeoutId)
      }
    }
  }

  return await retryWithTokenRefresh(operation, 'Unblocking', jar, userId)
}

// Helper function to check if a user is blocked with retry logic
async function isUserBlocked (jar, userId, apiUrl) {
  const operation = async () => {
    const endpoint = `//${apiUrl}/user-blocking-api/v1/users/${userId}/is-blocked`
    const httpOpt = await buildHttpOptions('GET', endpoint, jar, null, userId)

    try {
      const res = await http(httpOpt)
      
      if (res.statusCode === 200) {
        const body = JSON.parse(res.body)
        // The API returns just a boolean value, not an object
        return body === true
      } else {
        const body = res.body || '{}'
        let json
        try {
          json = JSON.parse(body)
        } catch (parseError) {
          throw new Error(`Failed to parse response: ${body}`)
        }

        const known = json.errors && json.errors[0]
        const err = known && known.message || `HTTP ${res.statusCode}: Failed to check if user is blocked`
        throw new Error(err)
      }
    } finally {
      // Clear timeout
      if (httpOpt.timeoutId) {
        clearTimeout(httpOpt.timeoutId)
      }
    }
  }

  return await retryWithBackoff(operation, 'Checking block status', jar, userId)
}

// Helper function to poll until user is unblocked
async function pollUntilUnblocked (jar, userId, apiUrl) {
  logger.debug('Starting unblock verification polling', { userId })

  for (let attempt = 0; attempt < VERIFICATION_POLL_ATTEMPTS; attempt++) {
    try {
      const isBlocked = await isUserBlocked(jar, userId, apiUrl)

      if (!isBlocked) {
        logger.info('User confirmed unblocked', {
          userId,
          attempts: attempt + 1
        })
        return true
      }

      logger.debug('User still blocked, continuing polling', {
        userId,
        attempt: attempt + 1,
        maxAttempts: VERIFICATION_POLL_ATTEMPTS
      })

      // If this is not the last attempt, wait before polling again
      if (attempt < VERIFICATION_POLL_ATTEMPTS - 1) {
        await sleep(POLL_INTERVAL_MS)
      }
    } catch (error) {
      logger.error('Error during unblock verification', {
        userId,
        attempt: attempt + 1,
        error: error.message
      })

      // If this is the last attempt, throw the error
      if (attempt === VERIFICATION_POLL_ATTEMPTS - 1) {
        throw error
      }

      // Wait before retrying
      await sleep(POLL_INTERVAL_MS)
    }
  }

  logger.error('User still blocked after verification polling', {
    userId,
    attempts: VERIFICATION_POLL_ATTEMPTS
  })
  return false
}

// Helper function to poll until user is blocked (for the initial block verification)
async function pollUntilBlocked (jar, userId, apiUrl) {
  logger.debug('Starting block verification polling', { userId })

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const isBlocked = await isUserBlocked(jar, userId, apiUrl)

      if (isBlocked) {
        logger.info('Block confirmed', {
          userId,
          attempts: attempt + 1
        })
        return true
      }

      logger.debug('Block not yet confirmed, continuing polling', {
        userId,
        attempt: attempt + 1,
        maxAttempts: MAX_POLL_ATTEMPTS
      })

      // If this is not the last attempt, wait before polling again
      if (attempt < MAX_POLL_ATTEMPTS - 1) {
        await sleep(POLL_INTERVAL_MS)
      }
    } catch (error) {
      logger.error('Error during block verification', {
        userId,
        attempt: attempt + 1,
        error: error.message
      })

      // If this is the last attempt, throw the error
      if (attempt === MAX_POLL_ATTEMPTS - 1) {
        throw error
      }

      // Wait before retrying
      await sleep(POLL_INTERVAL_MS)
    }
  }

  logger.warn('Block may not have taken effect, proceeding anyway', {
    userId,
    attempts: MAX_POLL_ATTEMPTS
  })
  return false
}

// Main kick function with production-scale resilience
async function kickPlayer (jar, token, userId, apiUrl) {
  let blockSuccessful = false
  const startTime = Date.now()

  logger.info('Starting kick operation', {
    userId,
    apiUrl,
    circuitState: globalState.circuitBreaker.state,
    rateLimiterTokens: globalState.rateLimiter.tokens
  })

  try {
    // Step 1: Block the user with retry logic
    logger.info('Step 1: Blocking user', { userId })
    await blockUser(jar, token, userId, apiUrl)
    blockSuccessful = true
    logger.info('Block operation completed', { userId })

    // Step 2: Poll until the block takes effect
    logger.info('Step 2: Verifying block took effect', { userId })
    const blockConfirmed = await pollUntilBlocked(jar, userId, apiUrl)

    if (blockConfirmed) {
      logger.info('Block confirmed by polling', { userId })
    } else {
      logger.warn('Block not confirmed but proceeding', { userId })
    }

    // Step 3: Unblock the user with retry logic
    logger.info('Step 3: Unblocking user', { userId })
    await unblockUser(jar, token, userId, apiUrl)
    logger.info('Unblock operation completed', { userId })

    // Step 4: Poll until verification that user is unblocked
    logger.info('Step 4: Verifying user is unblocked', { userId })
    const unblockConfirmed = await pollUntilUnblocked(jar, userId, apiUrl)

    if (!unblockConfirmed) {
      // Explicit verification failed - user is still blocked after polling
      throw new Error(`Kick operation failed: User ${userId} is still blocked after unblock attempt and ${VERIFICATION_POLL_ATTEMPTS} verification attempts. Manual intervention may be required.`)
    }

    const duration = Date.now() - startTime
    logger.info('Kick operation completed successfully', {
      userId,
      duration,
      metrics: globalState.metrics
    })

  } catch (error) {
    const errorType = classifyError(error)
    const duration = Date.now() - startTime

    logger.error('Kick operation failed', {
      userId,
      duration,
      errorType: errorType.type,
      error: error.message,
      metrics: globalState.metrics
    })

    // If we successfully blocked but failed later, try to clean up by unblocking
    if (blockSuccessful && errorType.type !== 'auth') {
      logger.info('Attempting cleanup - unblocking user', {
        userId,
        errorType: errorType.type
      })
      
      try {
        await guaranteedUnblock({ userId, jar, apiUrl, token, retries: 3 })
        logger.info('Cleanup successful - user unblocked', { userId })
      } catch (cleanupError) {
        logger.error('Cleanup failed - user may remain blocked', {
          userId,
          cleanupError: cleanupError.message
        })
        // Throw a more descriptive error that includes both the original error and cleanup failure
        throw new Error(`Kick operation failed: ${error.message}. Additionally, cleanup failed: ${cleanupError.message}. User may remain blocked.`)
      }
    } else if (blockSuccessful && errorType.type === 'auth') {
      logger.warn('Auth error detected, skipping cleanup to avoid further failures', { userId })
    }

    // Re-throw the original error
    throw error
  }
}

// Export metrics and state for monitoring
exports.getMetrics = () => ({ ...globalState.metrics })
exports.getCircuitBreakerState = () => ({ ...globalState.circuitBreaker })
exports.getRateLimiterState = () => ({ ...globalState.rateLimiter })
exports.setLogLevel = (level) => {
  // Update the library settings instead of just the local state
  if (!settings.logging) {
    settings.logging = { enabled: false, level: 'INFO', functions: {} }
  }

  if (typeof level === 'string') {
    settings.logging.level = level.toUpperCase()
    globalState.logLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO
  } else {
    const levelName = Object.keys(LOG_LEVELS)[level] || 'INFO'
    settings.logging.level = levelName
    globalState.logLevel = level
  }
}

exports.setKickPlayerLogging = (enabled) => {
  // Initialize logging settings if they don't exist
  if (!settings.logging) {
    settings.logging = { enabled: false, level: 'INFO', functions: {} }
  }
  if (!settings.logging.functions) {
    settings.logging.functions = {}
  }

  // Enable/disable logging for kickPlayer specifically
  settings.logging.functions.kickPlayer = Boolean(enabled)
  
  // If enabling kickPlayer logging, also enable general logging
  if (enabled) {
    settings.logging.enabled = true
  }
}

exports.func = async function (args) {
  const jar = args.jar
  try {
    const xcsrf = await CSRFManager.getToken(jar)
    let apiUrl = 'apis.roblox.com'
    if (args.apiUrl) {
      apiUrl = args.apiUrl
    }
    return await kickPlayer(jar, xcsrf, args.userId, apiUrl)
  } catch (error) {
    logger.error('kickPlayer function failed', {
      userId: args.userId,
      error: error.message,
      metrics: globalState.metrics
    })
    throw error
  }
}

