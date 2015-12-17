var express = require('express');
var Account = require('../adapters/account');
var scmp = require('scmp');

function verifyAuthentic(msg, token) {
  // Safe constant-time comparison of token
  return scmp(msg.token, token);
}

function mapSlackMessage(msg) {
  return {
    raw: msg,
    apiToken: null,
    message: msg.text,
    teamId: msg.team_id,
    currentUserId: msg.user_id,
    channelName: msg.channel_name,
    channelId: msg.channel_id,
    defaultChannel: null
  };
}

function addTeamToPayload(payload) {
  return Account.find(payload.teamId)
  .then(function (account) {
    if (account) {
      payload.account = account
      payload.apiToken = account.apiToken
      payload.defaultChannel = account.defaultChannel
    }
    return payload;
  });
}

function teamNotFoundError(host) {
  return "Time to Slack was not added to your team. Add it at https://" + host;
}

module.exports = function (config) {
  var handler = config.handler;
  var slash = express();

  /* Inbound slash command */
  slash.post('/', function(req, res, next) {
    console.log(new Date().toISOString() + " request start");
    console.log(req.body);

    if(!verifyAuthentic(req.body, config.token)) {
      res.status(403).send("Not called by Slack");
      return;
    }

    var payload = mapSlackMessage(req.body);

    addTeamToPayload(payload)
    .then(function (payload) {
      if(!payload.account) {
        return res.send(teamNotFoundError(req.hostname));
      }

      if(handler) {
        handler(payload)
        .then(function (reply) {
          console.log(new Date().toISOString() + " request end");
          res.send(reply);

          payload.account.actionPerformed();
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
