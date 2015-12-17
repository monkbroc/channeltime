var express = require('express');
var got = require('got');
var Account = require('../adapters/account');
var querystring = require('querystring');

module.exports = function (config) {
  var auth = express();

  /* Redirect to Slack OAuth login page */
  auth.get('/login', function(req, res, next) {
    res.redirect(getAuthorizeURL());
  });

  /* Save new team */
  auth.get('/oauth', function (req, res, next) {
    console.log(res.query);
    var code = req.query.code;

    oauth_access({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code
    })
    .then(function (auth) {
      console.log(auth);

      return auth_test({ token: auth.access_token })
      .then(function (identity) {
        console.log(identity);

        return Account.findOrCreate(identity.team_id, {
          teamId: identity.team_id,
          createdBy: identity.user_id,
          name: identity.team,
          apiToken: auth.access_token,
        })
        .then(function (account) {
          res.redirect(getSuccessUrl());
        });
      });
    })
    .catch(function (err) {
      console.log(err);
      res.redirect(getFailureUrl());
    });
  });

  auth.on('mount', function (parent) {
    console.log('** Serving login URL: http://MY_HOST:PORT' + auth.mountpath + '/login');
    console.log('** Waiting for OAuth callback on URL: http://MY_HOST:PORT' + auth.mountpath + '/oauth');
  });

  function call_api(command, options) {
    console.log('** API CALL: ' + 'https://slack.com/api/'+command);
    return got.post('https://slack.com/api/' + command, {
      body: options
    })
    .then(function (response) {
      if(response.statusCode == 200) {
        var json = JSON.parse(response.body);
        if(json.ok) {
          return json;
        } else {
          throw json.error;
        }
      } else {
        throw error;
      }
    });
  }

  // get a team url to redirect the user through oauth process
  function getAuthorizeURL() {
    var query = querystring.stringify({
      client_id: config.clientId,
      scope: config.scopes
    });
    return 'https://slack.com/oauth/authorize?' + query;
  }

  function getSuccessUrl() {
    return "/added";
  }

  function getFailureUrl() {
    return "/failed";
  }

  function oauth_access(options) {
    return call_api('oauth.access', options);
  }

  function auth_test(options) {
    return call_api('auth.test', options);
  }

  return auth;
};
