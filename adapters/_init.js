var mongoose = require('mongoose');

mongoose.Promise = global.Promise;

var url = process.env.MONGODB_URL || 'mongodb://localhost/slack_time';
mongoose.connect(url);
