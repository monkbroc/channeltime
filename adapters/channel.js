var mongoose = require('mongoose');
var timestamps = require('mongoose-timestamp');

var ChannelSchema = mongoose.Schema({
    teamId: String,
    channelId: String,
    members: Array
});
ChannelSchema.plugin(timestamps);

var Channel = mongoose.model("Channel", ChannelSchema);

function find(teamId, channelId) {
  return Channel.findOne({
    teamId: teamId,
    channelId: channelId
  });
}

function findOrCreate(teamId, channelId, data) {
  return Channel.findOneAndUpdate({
    teamId: teamId,
    channelId: channelId
  },
  data,
  {
    new: true,
    upsert: true
  });
}

module.exports = {
  find: find,
  findOrCreate: findOrCreate
};

