const WebSocket = require('ws');
const events = require('events');
const { HttpProxyAgent } = require('http-proxy-agent'); // For proxying the WebSocket connection

// Includes
const getSession = require('../util/getSession.js').func;
const settings = require('../../settings.json');

// Args
exports.optional = ['jar', 'proxyUrl']; // Add proxyUrl as an optional argument

// Docs
/**
 * 🔐 An event for when you get a notification.
 * @category Client
 * @alias onNotification
 * @returns An EventEmitter that emits when you get a notification.
 * @example const noblox = require("noblox.js")
 * // Login using your cookie
 * const notification = noblox.onNotification({ proxyUrl: 'http://your-proxy-server.com:8080' })
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
  const maxRetries = settings.event.maxRetries || 5;
  let retryCount = 0;
  const notifications = new events.EventEmitter();
  let ws;

  async function connect() {
    try {
      if (typeof args.jar === 'string') {
        args.jar = { session: args.jar };
      }
      const session = getSession({ jar: args.jar });

      const url = 'wss://realtime-signalr.roblox.com/userhub'; // WebSocket endpoint
      let options = {
        headers: {
          Cookie: `.ROBLOSECURITY=${session};`
        }
      };

      // If a proxy URL is provided, use it
      if (args.proxyUrl) {
        const proxyAgent = new HttpProxyAgent(args.proxyUrl);
        options.agent = proxyAgent;
      }

      ws = new WebSocket(url, [], options);

      ws.on('open', () => {
        retryCount = 0;
        notifications.emit('connect');

        // Send the protocol initialization message on connect, including the special character
        const initMessage = `{"protocol":"json","version":1}\u001e`; // Adding \u001e (0x1E) to indicate the end of the message
        ws.send(initMessage);
      });

      ws.on('message', (data) => {
        // Strip off control characters like \x1e before attempting to parse
        const cleanedData = data.toString().replace(/\u001e/g, ''); // Removes the 0x1E character

        try {
          const parsedData = JSON.parse(cleanedData);

          // Check if it's the expected type and target
          if (parsedData.type === 1 && parsedData.target === 'notification') {
            const [name, message] = parsedData.arguments;


            // parse the message

            const parsedMessage = JSON.parse(message);

            // Format the data into the desired structure


            // Emit the formatted data
            notifications.emit('data', name, parsedMessage);

          } else {
            // Handle other types of messages if needed
            notifications.emit('data', parsedData);
          }
        } catch (err) {
          notifications.emit('error', new Error('Failed to parse notification: ' + err.message));
        }
      });


      ws.on('close', () => {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(connect, 1000 * retryCount); // Exponential backoff for retries
        } else {
          notifications.emit('error', new Error('Max retries reached. Connection closed.'));
          notifications.emit('closed');
        }
      });

      ws.on('error', (err) => {
        notifications.emit('error', new Error('WebSocket error: ' + err.message));
        ws.close(); // Ensure connection is closed if there's an error
      });

      notifications.on('close', () => {
        if (ws) {
          ws.close();
          notifications.emit('closed');
        }
      });
    } catch (err) {
      notifications.emit('error', err);
    }
  }

  connect();
  return notifications;
};
