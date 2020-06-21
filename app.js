require('dotenv').load();

var express = require('express');
var morgan = require('morgan');
var logger = require('./lib/logger');
var bodyParser = require('body-parser');

var slash = require('./routes/slash');
var auth = require('./routes/auth');

require('./adapters/_init');
var SlackTime = require('./lib/slack_time');

if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET || !process.env.SLACK_SLASH_TOKEN) {
  logger.error('Error: Specify SLACK_CLIENT_ID SLACK_CLIENT_SECRET SLACK_SLASH_TOKEN in environment');
  process.exit(1);
}

var app = express();

app.use(morgan('combined', { 'stream': logger.stream }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/slack/receive', slash({
  handler: SlackTime.getSlackMessageWithChannelTimezones,
  token: process.env.SLACK_SLASH_TOKEN
}));

app.use('/slack/receive_dt', slash({
  handler: SlackTime.getSlackMessageWithLocalTime,
  token: process.env.SLACK_SLASH_TOKEN
}));

app.use('/slack', auth({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  scopes: SlackTime.requiredOAuthScopes
}));

app.use(express.static('web/build'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  res.status(404).send("Not Found");
});

// error handlers

app.use(function(err, req, res, next) {
  logger.error("Error: " + err + "\n" + err.stack);
  res.status(err.status || 500).send("Channel Time crashed :boom:");
});

module.exports = app;
