const http = require('../util/http.js').func
const getGeneralToken = require('../util/getGeneralToken.js').func

exports.required = ['conversationId', 'message']
exports.optional = ['jar']

// Docs
/**
 * 🔐 Send a message in a chat.
 * @category Chat
 * @alias sendChatMessage
 * @param {number} conversationId - The id of the conversation.
 * @param {string} message - The message to send.
 * @returns {Promise<SendChatResponse>}
 * @example const noblox = require("noblox.js")
 * // Login using your cookie
 * noblox.sendChatMessage(1, "Hello world!")
**/

function sendChatMessage (conversationId, messageText, apiUrl, jar, token) {
  return new Promise((resolve, reject) => {
    const httpOpt = {
      url: `//${apiUrl}/v2/send-message`,
      options: {
        method: 'POST',
        jar,
        headers: {
          'X-CSRF-TOKEN': token
        },
        json: {
          conversationId,
          message: messageText
        },
        resolveWithFullResponse: true
      }
    }
    return http(httpOpt).then((res) => {
      if (res.statusCode === 200) {
        if (!res.body.resultType === 'Success') {
          reject(new Error(res.body.statusMessage))
        } else {
          resolve(res.body)
        }
      } else {
        throw new Error('Send chat message failed')
      }
    }).catch(error => reject(error))
  })
}

exports.func = (args) => {
  const jar = args.jar
  apiUrl = 'chat.roblox.com'
  if (args.apiUrl) {
    apiUrl = args.apiUrl
  }

  return getGeneralToken({ jar }).then((xcsrf) => {
    return sendChatMessage(args.conversationId, args.message,  apiUrl, jar, xcsrf)
  })
}
