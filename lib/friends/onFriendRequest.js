// Dependencies
const events = require("events");

// Includes
const onNotification = require("../client/onNotification.js").func;

// Args
exports.optional = ["jar"];

// Docs
/**
 * 🔐 An event for when a user sends you a friend request.
 * @category User
 * @alias onFriendRequest
 * @returns An EventEmitter that emits when a user sends you a friend request.
 * @example const noblox = require("noblox.js")
 * // Login using your cookie
 *
 * const friendRequestEvent = noblox.onFriendRequest()
 * friendRequestEvent.on("data", function(data) {
 *  // Handle friend request data
 * })
 * friendRequestEvent.on("error", function(err) {
 *  // Handle error as needed
 * })
 **/

// Define
exports.func = function (args) {
  let jar = args.jar;

  if (jar && typeof jar === "function") {
    jar = jar();
  }
  const onFriendRequest = new events.EventEmitter();
  try {
    const notifications = onNotification({ jar });

    notifications.on("data", function (name, message) {
      if (
        name === "FriendshipNotifications" &&
        message.Type === "FriendshipRequested"
      ) {
        onFriendRequest.emit("data", message.EventArgs.UserId1);
      }
    });

    notifications.on("error", function (err) {
      onFriendRequest.emit("error", err);
    });

    notifications.on("connect", function () {
      onFriendRequest.emit("connect");
    });

    notifications.on("close", function (internal) {
      if (internal) {
        return;
      }
    });

    notifications.on("closed", function () {
      onFriendRequest.emit("closed");
    });

    onFriendRequest.on("close", function (internal) {
      if (internal) {
        return;
      }
      notifications.emit("close", true);
    });

    onFriendRequest.close = function () {
      notifications.emit("close", false);
    };

    return onFriendRequest;
  } catch (err) {
    onFriendRequest.emit("error", err);
    return onFriendRequest;
  }
};
