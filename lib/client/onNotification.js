// Dependencies
const { HubConnectionBuilder, HttpTransportType } = require('@microsoft/signalr')
const events = require('events')

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

  async function connect (retries) {
    if (typeof args.jar === 'string') {
      args.jar = { session: args.jar }
    }
    const session = getSession({ jar: args.jar })
    const headers = {
      Cookie: '.ROBLOSECURITY=' + session + ';'
      // Add other headers if needed
    }

    let client
    try {
      client = new HubConnectionBuilder()
        .withUrl('https://realtime-signalr.roblox.com/userhub', {
          skipNegotiation: true,
          transport: HttpTransportType.WebSockets,
          headers
        })
        .build()
    } catch (err) {
      console.error('Error creating HubConnection:', err)
      throw err
    }

    if (!client) {
      console.error('Failed to create HubConnection')
      return
    }

    client.on('notification', function (name, message) {
      notifications.emit('data', name, JSON.parse(message))
    })

    notifications.on('close', async function (err) {
      try {
        client.stop()
        console.error('Connection closed:', err)
      } catch (err) {
        console.error('Error while closing connection:', err)
      }
    })

    client.serviceHandlers = client.serviceHandlers || {}
    client.serviceHandlers.connectFailed = function (err) {
      console.error('Connection failed:', err)
      notifications.emit('error', new Error('Connection failed: ' + err.message))
      if (retries !== -1) {
        if (retries > max) {
          notifications.emit('close', new Error('Max retries reached'))
        } else {
          setTimeout(() => connect(retries + 1), 5000)
        }
      }
    }
    client.serviceHandlers.onerror = function (err) {
      console.error('Connection error:', err)
      notifications.emit('error', err)
    }
    client.serviceHandlers.connected = function (connection) {
      notifications.emit('connect', connection)
    }
    client.serviceHandlers.reconnecting = function () {
      notifications.emit('error', new Error('Lost connection, reconnecting'))
      return true // Abort reconnection
    }

    try {
      await client.start()
      return client
    } catch (err) {
      console.error('Error while starting connection:', err)
      throw err
    }
  }

  connect(-1)
  return notifications
}
