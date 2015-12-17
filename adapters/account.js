var mongoose = require('mongoose');
var url = process.env.MONGODB_URL || 'mongodb://localhost/slack_time';
mongoose.connect(url);

var accountSchema = mongoose.Schema({
    teamId: String,
    slashToken: String,
    apiToken: String,
    defaultChannel: String
});


var Account = mongoose.model("Account", accountSchema);

function find(msg, callback) {
  var query = Account.where({ teamId: msg.team_id });
  query.findOne(function (err, account) {
    callback(err, account ? account.toObject() : null);
  });
}

exports.find = find;
