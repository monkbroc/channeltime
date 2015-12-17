var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var url = process.env.MONGODB_URL || 'mongodb://localhost/slack_time';
mongoose.connect(url);

var accountSchema = mongoose.Schema({
    teamId: String,
    slashToken: String,
    apiToken: String,
    defaultChannel: String
});

var Account = mongoose.model("Account", accountSchema);

function find(teamId) {
  var query = Account.where({ teamId: teamId });
  return query.findOne();
}

function findOrCreate(teamId, data) {
  return find(teamId)
  .then(function (account) {
    if(!account) {
      account = new Account(data);
    }
    return account;
  });
}

module.exports = {
  find: find,
  findOrCreate: findOrCreate
};
