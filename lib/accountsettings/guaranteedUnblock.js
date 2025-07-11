// Includes
const http = require('../util/http.js').func
const getGeneralToken = require('../util/getGeneralToken.js').func

// Args
exports.required = ['userId']
exports.optional = ['jar', 'apiUrl', 'token', 'retries']

// Docs
/**
 * 🔐 Unblocks a user with retry capability to ensure success.
 * @category AccountSettings
 * @alias guaranteedUnblock
 * @param {number} userId - The id of the user to unblock.
 * @param {CookieJar=} jar - The jar containing the .ROBLOSECURITY cookie.
 * @param {string=} [apiUrl='apis.roblox.com'] - The API URL to use.
 * @param {string=} token - The X-CSRF-TOKEN to use.
 * @param {number=} [retries=3] - Number of retry attempts if unblock fails.
 * @returns {Promise<boolean>} Whether the unblock was successful
 * @example const noblox = require("noblox.js")
 * // Login using your cookie.
 * const success = await noblox.guaranteedUnblock(123456)
**/

// Define
exports.func = async function (args) {
  const jar = args.jar
  const userId = args.userId
  const apiUrl = args.apiUrl || 'apis.roblox.com'
  const maxRetries = args.retries || 3
  let token = args.token
  
  if (!token) {
    token = await getGeneralToken({ jar })
  }
  
  let lastError = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const httpOpt = {
        url: `//${apiUrl}/user-blocking-api/v1/users/${userId}/unblock-user`,
        options: {
          method: 'POST',
          jar,
          headers: {
            'X-CSRF-TOKEN': token
          }
        }
      }
      
      await http(httpOpt)
      return true // Success
    } catch (error) {
      lastError = error
      
      // If not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Refresh token if that might be the issue
        if (error.statusCode === 403) {
          try {
            token = await getGeneralToken({ jar })
          } catch (e) {
            // Continue with old token if refresh fails
          }
        }
      }
    }
  }
  
  // All attempts failed
  throw new Error(`Failed to unblock user after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`)
}