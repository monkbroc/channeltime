// A Slack slash command to convert between timezones.
// Copyright 2015 Julien Vanier
// Released under the MIT license
// Adapted from https://github.com/forresto/slack-slash-time

var got = require('got');
var chrono = require('chrono-node');
var moment = require('moment');
var querystring = require('querystring');
var logger = require('../lib/logger');

module.exports = SlackTime = function (args) {
  var token = args.apiToken;
  var originalMessage = args.message;
  var currentUserId = args.currentUserId;
  var channelId = args.channelId;
  var defaultChannel = args.defaultChannel;

  var helpPattern = /^\s*help\s*$/i;
  if(!originalMessage || originalMessage.match(helpPattern)) {
    return Promise.resolve(helpMessage());
  }

  var userListPromise =
    getUserList(token)
    .then(parseUserList);

  var channelInfoPromise =
    getChannelInformation(channelIdForMembers(channelId, defaultChannel), token)
    .then(parseChannelInformation);

  return Promise.all([userListPromise, channelInfoPromise])
  .then(function(values) {
    logger.debug("Slack info received");
    var userList = values[0];
    var channelInfo = values[1];

    var userInfo = currentUserInfo(userList.members, currentUserId);
    if (typeof userInfo.timezoneOffset === "undefined") {
      return 'You need to set your timezone in Slack setup (my.slack.com/account/settings).';
    }

    var channelMembers = channelInfo.channel.members;
    var zones = timezonesForChannelMembers(userList.members, channelMembers);
    var message = addTimezonesToSlackMessage(originalMessage, userInfo, zones);
    return postToSlack(channelId, userInfo, message, token);
  });
}

SlackTime.requiredOAuthScopes = "users:read,chat:write:bot,channels:read,commands";

function postToSlack(channel, userInfo, content, token) {
  logger.debug("Posting to Slack");
  var query = querystring.stringify({
    token: token,
    channel: channel,
    text: content,
    username: userInfo.name,
    icon_url: userInfo.image
  });
  return got.post('https://slack.com/api/chat.postMessage?' + query)
    .then(function() {
    logger.debug("Posting done");
    return;
  });
}

function getUserList(token) {
  return got('https://slack.com/api/users.list?token=' + token);
}

function getChannelInformation(channelId, token) {
  return got('https://slack.com/api/channels.info?' +
    'channel=' + channelId +
    '&token=' + token);
}

function helpMessage() {
  return "Hi! Type /time followed by a message containing a time and it will be shown in the timezone of everybody in the channel.\nTry these: 3pm, in 45 minutes, tomorrow from 1pm to 2pm.\nIf somebody's time zone is missing, you can let them know that they can set their time zone at https://my.slack.com/account/settings";
}

function channelIdForMembers(channelId, defaultChannel) {
  if (channelId[0] === "C") {
    return channelId;
  } else {
    // Can't get DM or private channel user list...
    return defaultChannel;
  }
}

function parseUserList(response) {
  var info = JSON.parse(response.body);
  if (!info.members) {
    throw response.body;
  }
  return info;
}

function parseChannelInformation(response) {
  var info = JSON.parse(response.body);
  if (!info.channel) {
    throw response.body;
  }
  return info;
}

function timezonesForChannelMembers(everybody, members) {
  var zoneHash = {};
  everybody.forEach(function(person) {
    var inChannel = members.indexOf(person.id) >= 0;
    var hasTimezone = typeof person.tz_offset !== 'undefined';
    if (inChannel && hasTimezone) {
      zoneHash[person.tz_offset] = {
        offset: person.tz_offset / 60,
        label: person.tz_label
      };
    }
  });

  return sortObjectToArray(zoneHash);
}

function currentUserInfo(everybody, userId) {
  for (var person of everybody) {
    if (person.id === userId) {
      var currentUser = person;
    }
  }

  if (currentUser) {
    return {
      id: userId,
      name: currentUser.name,
      timezoneOffset: currentUser.tz_offset / 60,
      image: currentUser.profile.image_72
    };
  } else {
    return {};
  }
}

function formatMonthDay(dateMoment) {
  return dateMoment.format("MM-DD");
}

function formatDayOfWeek(dateMoment) {
  return dateMoment.format("ddd");
}

function formatHoursMinutes(dateMoment) {
  return dateMoment.format("hh:mma");
}

function abbreviate(string) {
  abbr = '';
  string.split(' ').forEach(function(word) {
    abbr += word.charAt(0);
  });
  return abbr;
}

function formatSlackDate(dateMoment) {
  return '_' + formatDayOfWeek(dateMoment) + ' ' + formatMonthDay(dateMoment) + '_ ';
}

function formatSlackTime(dateMoment) {
  return '*' + formatHoursMinutes(dateMoment) + '* ';
}

function formatChannelLocalTimes(startMoment, endMoment, userInfo, zones) {
  var times = [];
  var lastDateString = formatSlackDate(moment());

  zones.forEach(function(zone) {
    var localStart = moment(startMoment).add(zone.offset, 'minutes');
    var dateStartString = formatSlackDate(localStart);
    var timeStartString = formatSlackTime(localStart);

    if (endMoment) {
      var localEnd = moment(endMoment).add(zone.offset, 'minutes');
      var dateEndString = formatSlackDate(localEnd);
      var timeEndString = formatSlackTime(localEnd, zone);
    }
    var includeEndDate = endMoment && dateEndString !== dateStartString;
    var includeStartDate = dateStartString !== lastDateString || includeEndDate;

    var formatted = (includeStartDate ? dateStartString : '') + timeStartString +
      (endMoment ? 'to ' + (includeEndDate ? dateEndString : '') + timeEndString : '') +
      abbreviate(zone.label);

    times.push(formatted);

    lastDateString = includeEndDate ? '' : dateStartString;
  });
  return times.join(", ");
}

function chronoResultToUtcMoment(result, userInfo) {
  if (!result) {
    return;
  }
  var dateMoment = result.moment();
  if (result.isCertain('timezoneOffset')) {
    dateMoment.add(-moment().utcOffset(), 'minutes');
  } else {
    dateMoment.add(-userInfo.timezoneOffset, 'minutes');
  }
  return dateMoment;
}

function addTimezonesToSlackMessage(message, userInfo, zones) {
  var ref = moment().add(-moment().utcOffset() + userInfo.timezoneOffset, 'minutes');
  var results = chrono.parse(message, ref);

  results.forEach(function(result) {
    var startMoment = chronoResultToUtcMoment(result.start, userInfo);
    var endMoment = chronoResultToUtcMoment(result.end, userInfo);
    var channelLocalTimes = formatChannelLocalTimes(startMoment, endMoment, userInfo, zones);
    message = message.replace(result.text, result.text + ' (' + channelLocalTimes + ')');
  });

  return message;
}

function sortObjectToArray(obj) {
  out = [];
  Object
    .keys(obj)
    .sort(
      function(a, b) {
        return parseInt(a) - parseInt(b);
      }
  )
    .forEach(
      function(key) {
        out.push(obj[key]);
      }
  );
  return out;
}
