// Dependencies
const signalR = require('@microsoft/signalr');
const events = require('events');

// Includes
const getSession = require('../util/getSession.js').func;
const settings = require('../../settings.json');

// Args
exports.optional = ['jar'];

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
  const max = settings.event.maxRetries;
  const notifications = new events.EventEmitter();

  async function connect() {
    try {
      if (typeof args.jar === 'string') {
        args.jar = { session: args.jar };
      }
      const session = getSession({ jar: args.jar });

      // Create a SignalR HubConnectionBuilder instance
      const userNotificationConnection = new signalR.HubConnectionBuilder()
        .withUrl('https://realtime-signalr.roblox.com/userhub', {
            transport: signalR.HttpTransportType.WebSockets,
            skipNegotiation: true,
            headers: {
              Cookie: '.ROBLOSECURITY=' + session + ';'
            }
        })
        .withAutomaticReconnect()
        .build();

      notifications.on('close', async (internal) => {
        if (internal) {
          return;
        }
        await userNotificationConnection.stop();
        notifications.emit('closed');
      });

      // Handle incoming notifications
      userNotificationConnection.on('notification', (name, message) => {
        notifications.emit('data', name, JSON.parse(message));
      });


      // Start the connection
      if (!userNotificationConnection) {
        return;
      }
      try {
        await userNotificationConnection.start();
        notifications.emit('connect');
      } catch (err) {
        notifications.emit('error', new Error('Failed to start connection: ' + err.message));
      }
    } catch (err) {
      notifications.emit('error', err);
    }
  }

  connect();
  return notifications;
};
