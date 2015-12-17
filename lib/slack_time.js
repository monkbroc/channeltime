// A Slack slash command to convert between timezones.
// Copyright 2015 Julien Vanier
// Released under the MIT license
// Adapted from https://github.com/forresto/slack-slash-time

var got = require('got');
var chrono = require('chrono-node');
var moment = require('moment');

module.exports = function SlackTime(args) {
    // Minimal webhook safety
    if (args.slashCommandToken !== args.expectedSlashCommandToken) {
        return Promise.reject("Not called from Slack");
    }

    var token = args.apiToken;
    var originalMessage = args.message;
    var currentUserId = args.currentUserId;
    var channelName = args.channelName;
    var channelId = args.channelId;
    var defaultChannel = args.defaultChannel;

    var userListPromise =
        getUserList(token)
        .then(parseUserList);

    var channelInfoPromise =
        getChannelInformation(channelIdForMembers(channelName, channelId, defaultChannel), token)
        .then(parseChannelInformation);

    return Promise.all([userListPromise, channelInfoPromise])
        .then(function(values) {
          console.log(new Date().toISOString() + " slack info received");
            var userList = values[0];
            var channelInfo = values[1];

            var userInfo = currentUserInfo(userList.members, currentUserId);
            if (!userInfo.timezoneOffset) {
                return 'You need to set your timezone in Slack setup (slack.com/account/settings).';
            }

            var channelMembers = channelInfo.channel.members;
            var zones = timezonesForChannelMembers(userList.members, channelMembers);
            var message = addTimezonesToSlackMessage(originalMessage, userInfo, zones);
            return postToSlack(channelId, userInfo, message, token);
        })
        .
    catch (function(err) {
        throw "Error fetching Slack info: " + err + "\n" + err.stack;
    });
}

function postToSlack(channel, userInfo, content, token) {
  console.log(new Date().toISOString() + " posting to slack");
    return got.post(
        'https://slack.com/api/chat.postMessage?' +
        'token=' + token +
        '&channel=' + channel +
        '&text=' + content +
        '&username=' + userInfo.name +
        '&icon_url=' + userInfo.image
    ).then(function() {
      console.log(new Date().toISOString() + " posting done");
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

function channelIdForMembers(channelName, channelId, defaultChannel) {
    if (channelName === "directmessage") {
        // Can't get DM user list...
        return defaultChannel;
    } else {
        return channelId;
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
        var hasTimezone = !! person.tz_offset;
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

var formatHoursMinutes = function(dateMoment) {
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
