/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var tal = require("./tequilaAndLights");

var client_id = 'ad828589f1db40c38368c39fca586f6d'; // Your client id
var client_secret = 'ad678f85ce5c4615a3214a981aa7d916'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

let access_token;
let refresh_token;
let current_id = "";
let current_bpm = 0;
let current_context = "";
let refresher;

function changeSongDetails(id, name, artists, bpm, context) {
  current_bpm = bpm;
  current_id = id;
  current_context = context? context.uri : null;

  if (id != null)
    console.log("Currently playing: " + name + "\nBy: " + artists.join(", ") + "\nBPM: " + current_bpm + "\n");
}


/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.get('/login', function (req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email user-read-currently-playing user-read-playback-state user-modify-playback-state';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      show_dialog: true,
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function (req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {

        access_token = body.access_token;
        refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
          console.log("Currently logged in: " + body.display_name);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));

        //Start bpm updater
        clearInterval(refresher);
        tal.updateBPM(access_token, current_id, changeSongDetails);
        refresher = setInterval(function () {
          tal.updateBPM(access_token, current_id, changeSongDetails);
        }, 5000);

        //Start Tequila timer
        setTimeout(function() {
          tal.tequilaTime(access_token, current_id, current_context);
        }, 45*60*1000);
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function (req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

app.get("/logout", function (req, res) {
  clearInterval(refresher);
  access_token = null;
  refresh_token = null;

  console.log("Logging out...");

  changeSongDetails(null, null, null, null, null);

  res.redirect('/');
});


app.get('/tequila', function (req, res) {
  if(!current_context)
    return console.log("No context available");

  tal.tequilaTime(access_token, current_id, current_context);
});

console.log('Listening on 8888');
app.listen(8888);
