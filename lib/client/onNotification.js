// Dependencies
const signalR = require('@microsoft/signalr')
const events = require('events')
const WebSocket = require('ws')
const { HttpsProxyAgent } = require('https-proxy-agent')
const crypto = require('crypto') // For shuffling cipher list

// Includes
const getSession = require('../util/getSession.js').func
const settings = require('../../settings.json')

// Args
exports.optional = ['jar']

// Docs
/**
 * 🔐 An event for when you get a notification.
 * @category Client
 * @alias onNotification
 * @returns An EventEmitter that emits when you get a notification.
 * @example const noblox = require("noblox.js")
 * // Login using your cookie
 * const notification = noblox.onNotification()
 * notification.on("data", function(data) {
 *  console.log("New notification! ", data)
 * })
 * notification.on("error", function(err) {
 *  console.error("Something went wrong: ", err)
 *  // Handle error as needed
 * })
 **/

// Define
exports.func = function (args) {
  const max = settings.event.maxRetries
  const notifications = new events.EventEmitter()

  async function connect () {
    try {
      if (typeof args.jar === 'string') {
        args.jar = { session: args.jar }
      }
      const session = getSession({ jar: args.jar })

      // ** Proxy Configuration **
      // Replace with your actual proxy URL. You can also retrieve this from settings.json
      const proxyUrl = settings.event.proxyUrl
      const proxyAgent = proxyUrl && new HttpsProxyAgent(proxyUrl)

      if (proxyUrl) {
        console.log('Using proxy agent:', proxyAgent)
      }

      // ** TLS Fingerprint Modification **
      // Define a list of cipher suites
      const cipherList = [
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-CHACHA20-POLY1305',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256'
      ]

      // Shuffle the cipher list to randomize the order
      function shuffleArray (array) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]]
        }
        return array
      }

      const shuffledCiphers = shuffleArray([...cipherList]).join(':')

      // Create a custom WebSocket factory
      function webSocketFactory (url) {
        return new WebSocket(url, {
          // if the proxy agent is defined, use it
          agent: proxyAgent,
          // TLS options to modify the fingerprint
          ciphers: shuffledCiphers,
          ecdhCurve: 'auto',
          honorCipherOrder: true,
          secureOptions:
            crypto.constants.SSL_OP_NO_TLSv1 |
            crypto.constants.SSL_OP_NO_TLSv1_1
          // Optional: You can add more TLS options here as needed
        })
      }

      // ** SignalR Connection Setup **
      const userNotificationConnection = new signalR.HubConnectionBuilder()
        .withUrl('https://realtime-signalr.roblox.com/userhub', {
          transport: signalR.HttpTransportType.WebSockets,
          skipNegotiation: true,
          headers: {
            Cookie: '.ROBLOSECURITY=' + session + ';'
          },
          webSocketFactory // Use the custom WebSocket factory
        })
        // .withAutomaticReconnect()
        .build()

      // ** Event Handling **
      notifications.on('close', async (internal) => {
        if (internal) {
          return
        }
        await userNotificationConnection.stop()
        notifications.emit('closed')
      })

      // Handle incoming notifications
      userNotificationConnection.on('notification', (name, message) => {
        try {
          const parsedMessage = JSON.parse(message)
          notifications.emit('data', name, parsedMessage)
        } catch (parseError) {
          notifications.emit(
            'error',
            new Error(
              'Failed to parse notification message: ' + parseError.message
            )
          )
        }
      })

      // Handle connection events
      userNotificationConnection.onreconnecting((error) => {
        notifications.emit('reconnecting', error)
      })

      userNotificationConnection.onreconnected((connectionId) => {
        notifications.emit('reconnected', connectionId)
      })

      userNotificationConnection.onclose((error) => {
        notifications.emit('close', false)
        if (error) {
          notifications.emit(
            'error',
            new Error('Connection closed with error: ' + error.message)
          )
        } else {
          notifications.emit('closed')
        }
      })

      // ** Start the connection **
      try {
        await userNotificationConnection.start()
        notifications.emit('connect')
      } catch (err) {
        notifications.emit(
          'error',
          new Error('Failed to start connection: ' + err.message)
        )
      }
    } catch (err) {
      notifications.emit('error', err)
    }
  }

  // ** Initiate Connection **
  connect()

  return notifications
}
