var express = require('express');
var Account = require('../adapters/account');
var Channel = require('../adapters/channel');
var scmp = require('scmp');
var logger = require('../lib/logger');

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
    channelId: msg.channel_id
  };
}

function addChannelHelpersToPayload(payload) {
  payload.getChannelMembers = function (teamId, channelId) {
    return Channel.find(teamId, channelId)
    .then(function (channel) {
      return channel.members;
    });
  };
  payload.updateChannelMembers = function (teamId, channelId, members) {
    return Channel.findOrCreate(teamId, channelId, { members: members });
  };
  return payload;
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
  return "Channel Time was not added to your team. Add it at https://" + host;
}

module.exports = function (config) {
  var handler = config.handler;
  var slash = express();

  /* Inbound slash command */
  slash.post('/', function(req, res, next) {
    if(!verifyAuthentic(req.body, config.token)) {
      logger.error("Called with wrong verification token");
      res.status(403).send("Not called by Slack");
      return;
    }

    var payload = mapSlackMessage(req.body);
    payload = addChannelHelpersToPayload(payload);

    addTeamToPayload(payload)
    .then(function (payload) {
      if(!payload.account) {
        logger.error("Called for non-existent team");
        return res.send(teamNotFoundError(req.hostname));
      }

      if(handler) {
        return handler(payload)
        .then(function (reply) {
          res.send(reply);

          payload.account.actionPerformed();
        });
      } else {
        res.send("OK");
      }
    })
    .catch(function (err) {
      next(err);
    });
  });

  slash.on('mount', function (parent) {
    logger.debug('** Waiting for commands on URL: http://MY_HOST:PORT' + slash.mountpath + '/');
  });

  return slash;
};
