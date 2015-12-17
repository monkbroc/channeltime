var express = require('express');
var find = require('../adapters/account').find;

function parseSlackMessage(msg, callback) {
  var payload = {
    ok: true,
    raw: msg,
    apiToken: '',
    expectedSlashCommandToken: '',
    slashCommandToken: msg.token,
    message: msg.text,
    currentUserId: msg.user_id,
    channelName: msg.channel_name,
    channelId: msg.channel_id,
    defaultChannel: ''
  }

  // lookup the account in the db
  find(msg, function (err, account) {
    if (err) {
      payload.ok = false
      payload.text = 'find method returned an error'
    }
    else if (!account) {
      payload.ok = true
      payload.text = 'no account for this slack team'
    }
    else {
      payload.ok = true
      payload.text = 'account found'
      payload.account = account
      payload.apiToken = account.apiToken
      payload.expectedSlashCommandToken = account.slashToken
      payload.defaultChannel = account.defaultChannel
    }
    // end of find
    callback(err, payload)
  })
}

module.exports = function (options) {
  var handler = options.handler;
  var router = express.Router();

  /* GET home page. */
  router.post('/', function(req, res, next) {
    console.log(new Date().toISOString() + " request start");
    parseSlackMessage(req.body, function (err, payload) {
      if(handler) {
        handler(payload)
        .then(function (message) {
          console.log(new Date().toISOString() + " request end");
          res.send(message);
        })
        .catch(function (err) {
          res.send(err);
        });
      } else {
        res.send("OK");
      }
    });
  });

  return router;
};
