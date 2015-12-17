var express = require('express');
var account = require('../adapters/account');

module.exports = function (config) {
  var handler = config.handler;
  var slash = express();

  function parseSlackMessage(msg) {
    return new Promise(function (fulfill, reject) {
      var payload = {
        ok: true,
        raw: msg,
        apiToken: '',
        expectedSlashCommandToken: config.token,
        slashCommandToken: msg.token,
        message: msg.text,
        currentUserId: msg.user_id,
        channelName: msg.channel_name,
        channelId: msg.channel_id,
        defaultChannel: ''
      }

      // lookup the account in the db
      account.find(msg.team_id)
      .then(function (account) {
        if (!account) {
          payload.ok = true
          payload.text = 'no account for this slack team'
        }
        else {
          payload.ok = true
          payload.text = 'account found'
          payload.account = account
          payload.apiToken = account.apiToken
          payload.defaultChannel = account.defaultChannel
        }
        fulfill(payload);
      })
      .catch(function (err) {
        payload.ok = false
        payload.text = 'find method returned an error'
        reject(err, payload);
      });
    });
  }

  /* Inbound slash command */
  slash.post('/', function(req, res, next) {
    console.log(new Date().toISOString() + " request start");
    console.log(req.body);
    parseSlackMessage(req.body)
    .then(function (payload) {
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
    })
    .catch(function (error) {
      console.log(error);
      next();
    });
  });

  slash.on('mount', function (parent) {
    console.log('** Waiting for commands on URL: http://MY_HOST:PORT' + slash.mountpath + '/');
  });

  return slash;
};
