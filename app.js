require('dotenv').load();

var express = require('express');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');

var slash = require('./routes/slash');
var auth = require('./routes/auth');

var SlackTime = require('./lib/slack_time');

if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET || !process.env.SLACK_SLASH_TOKEN) {
  console.log('Error: Specify SLACK_CLIENT_ID SLACK_CLIENT_SECRET SLACK_SLASH_TOKEN in environment');
  process.exit(1);
}

var app = express();

// uncomment after placing your favicon in /public
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/slack/receive', slash({
  handler: SlackTime,
  token: process.env.SLACK_SLASH_TOKEN
}));
app.use('/slack', auth({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  scopes: SlackTime.requiredOAuthScopes
}));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500).send(
      JSON.stringify({
        message: err.message,
        error: err
      })
    );
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500).send("Time to Slack crashed :boom:");
});

module.exports = app;
