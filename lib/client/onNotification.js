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

    // Handle the 'close' event
    notifications.on('close', function (err) {
      console.error('Connection closed:', err)
    })

    client.serviceHandlers = client.serviceHandlers || {}
    client.serviceHandlers.connectFailed = function (err) {
      notifications.emit('error', new Error('Connection failed: ' + err.message))
      if (retries !== -1) {
        if (retries > max) {
          notifications.emit('close', new Error('Max retries reached'))
        } else {
          setTimeout(connect, 5000, retries + 1)
        }
      }
    }

    notifications.error = function (err) {
      notifications.emit('error', err)
    }

    notifications.connected = function (connection) {
      notifications.emit('connect', connection)
    }

    notifications.reconnecting = function () {
      setTimeout(connect, 5000, 0)
      notifications.emit('error', new Error('Lost connection, reconnecting'))
      return true // Abort reconnection
    }
    try {
      await client.start()
      console.log('Connection started')
      return client
    } catch (err) {
      console.error('Error while starting connection:', err)
      throw err
    }
  }
  connect(-1)
  return notifications
}
