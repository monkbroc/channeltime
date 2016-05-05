# Channel Time

Automatic time zone conversion for Slack

## Usage

To simply use this for your Slack team, visit https://channeltime.info

## Installation

To work on this app you'll need to create a Slack app at https://api.slack.com/apps

Provide the Slack app client ID and secret.

Create a slash command and note the verification token.

Set these environment variables on your machine:
- `SLACK_CLIENT_ID`: Slack app client ID
- `SLACK_CLIENT_SECRET`: Slack app client secret
- `SLACK_SLASH_TOKEN`: slash command verification token
- `PORT`: HTTP server port

The database is MongoDB, so you'll need to install it for your machine.

Install dependencies `npm install`

Run the server `npm start`

The easiest way to test on your machine before pushing to production is
to use https://ngrok.com, a secure tunnel service.

`ngrok http 3000` will give you a tunnel from a public URL such as https://77ab8d40.ngrok.io to `http://localhost:3000`

You can then use the public HTTPS endpoint in your Slack app:
- Redirect URI: https://77ab8d40.ngrok.com/slack/oauth
- Slash command request URL: https://77ab8d40.ngrok.com/slack/receive

Start the process of adding a team by visiting https://77ab8d40.ngrok.com/slack/login

To run to production: Find a host, set your domain name, set the environment variables, deploy your code and run the app on boot.

## TODO

The static HTML part of Channel Time is actually served statically by
Nginx and generated through Middleman, a Ruby static site generator. It
would be best to just bite the bullet, figure out how Gulp works and put
everything in a single application.

Static portion of the site: https://github.com/monkbroc/channeltime-web

## License

Copyright 2015 Julien Vanier

[Licensed under the GNU Affero GPL](LICENSE.txt)
