var mongoose = require('mongoose');
var timestamps = require('mongoose-timestamp');

mongoose.Promise = global.Promise;

var url = process.env.MONGODB_URL || 'mongodb://localhost/slack_time';
mongoose.connect(url);

var AccountSchema = mongoose.Schema({
    teamId: String,
    createdBy: String,
    name: String,
    defaultChannel: String,
    apiToken: String,
    actionsPerformed: Number
});
AccountSchema.plugin(timestamps);
AccountSchema.methods.actionPerformed = actionPerformed;

var Account = mongoose.model("Account", AccountSchema);

function find(teamId) {
  return Account.findOne({ teamId: teamId });
}

function findOrCreate(teamId, data) {
  return Account.findOneAndUpdate({
    teamId: teamId
  },
  data,
  {
    new: true,
    upsert: true
  });
}

function actionPerformed() {
  var update = { $inc: { actionsPerformed: 1 } };
  return this.update(update);
}

module.exports = {
  find: find,
  findOrCreate: findOrCreate
};
