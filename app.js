const SpotifyWebApi = require("spotify-web-api-node");
const express = require("express");
const cors = require('cors');
const cookieParser = require('cookie-parser');
const querystring = require('querystring');
const { client_id, client_secret, redirect_uri, state } = require("./config.json");
const tal = require("./tequilaAndLights.js");


const spotifyApi = new SpotifyWebApi({
  clientId: client_id,
  clientSecret: client_secret,
  redirectUri: redirect_uri
});

const app = express();
app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.get('/login', function (req, res) {
  const scopes = ["user-read-private", "user-read-email", "user-read-currently-playing", "user-read-playback-state",  "user-modify-playback-state"];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state, true);
  res.redirect(authorizeURL);
});

function refreshToken() {
  spotifyApi.refreshAccessToken().then(function(data) {
      console.log('The access token has been refreshed!');
      spotifyApi.setAccessToken(data.body['access_token']);
    }).catch(function(err) {
    console.log(err);
  });
}

app.get('/callback', function (req, res) {
  const code = req.query.code;
  spotifyApi.authorizationCodeGrant(code).then(function(data) {
      // Set the access token on the API object to use it in later calls
      spotifyApi.setAccessToken(data.body['access_token']);
      spotifyApi.setRefreshToken(data.body['refresh_token']);

      res.redirect('/#' +
        querystring.stringify({
          access_token: spotifyApi.getAccessToken(),
          refresh_token: spotifyApi.getRefreshToken()
        })
      );

      tal.run(spotifyApi);

      //Automatically refresh access token after 30 mins
      const refresh_time = 30 * 60 * 1000;
      setInterval(refreshToken, refresh_time);
    }).catch(function(err) {
    console.log(err);
  });
});

app.get('/refresh_token', function (req, res) {
  refreshToken();
});

app.get("/logout", function (req, res) {
  spotifyApi.resetAccessToken();
  spotifyApi.resetRefreshToken();

  console.log("Logging out...");
  res.redirect('/');
});

app.get("/setIntervals", function(req, res) {
  tal.setIntervalTimes(req.query.base, req.query.max);
});

console.log('Listening on 8888');
app.listen(8888);