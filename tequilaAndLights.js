
var request = require('request'); // "Request" library
var querystring = require('querystring');

let minGap = 45 * 1000 * 60; //45min
let randomTime = 45 * 1000 * 60; //45min
let waitTime = 115000;

module.exports = {
    updateBPM: function (access_token, current_id, callback) {
        var options = {
            url: 'https://api.spotify.com/v1/me/player/currently-playing',
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                let changed_id = body.item.id;
                let changed_context = body.context;
                let changed_name = body.item.name;
                let changed_artists = body.item.artists.map(a => a.name);

                if (changed_id == current_id)
                    return;

                var options = {
                    url: "https://api.spotify.com/v1/audio-features/" + changed_id,
                    headers: { 'Authorization': 'Bearer ' + access_token },
                    json: true
                };

                request.get(options, function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                        callback(changed_id, changed_name, changed_artists, body.tempo, changed_context);
                    } else {
                        console.log("Couldnt fetch song");
                        return;
                    }
                });
            } else {
                console.log("No song currently playing");
                return;
            }
        });
    },
    
    tequilaTime: function (access_token, previous_id, playlist_uri) {
        if (access_token != null && previous_id) {
            playTequila(access_token, playlist_uri, previous_id);
        }

        const newTime = minGap + Math.random() * randomTime;
        //setTimeout(tequilaTime, newTime);
        console.log("Next Tequila time in: " + Math.floor(newTime / 60000) + "min");
    }
}

function playTequila(access_token, playlist_uri, previous_id) {
    //Tequila abspielen
    let tequila_uri = "spotify:track:5gJKsGij5oGt5H5RSFYXPa";
    let options = {
        url: "https://api.spotify.com/v1/me/player/play",
        headers: { 'Authorization': 'Bearer ' + access_token },
        body: {
            uris: [tequila_uri],
            position_ms: 20000
        },
        json: true
    };

    request.put(options, function (error, response, body) {
        if (!error && response.statusCode === 204) {
            setTimeout(function () {
                let options;

                if(playlist_uri) {
                    //Playlist fortsetzen
                    options = {
                        url: "https://api.spotify.com/v1/me/player/play",
                        headers: { 'Authorization': 'Bearer ' + access_token },
                        body: {
                            context_uri: playlist_uri,
                            offset: { "uri": "spotify:track:" + previous_id }
                        },
                        json: true
                    };
                } else {
                    //Fallback playlist
                    options = {
                        url: "https://api.spotify.com/v1/me/player/play",
                        headers: { 'Authorization': 'Bearer ' + access_token },
                        body: {
                            context_uri: "spotify:playlist:37i9dQZF1DX9EM98aZosoy"
                        },
                        json: true
                    };
                }

                request.put(options, function (error, response, body) {
                    if(error || response.statusCode !== 204)
                        console.log("Error playing track on playlist");
                });
            }, waitTime); //Warten bis Tequila vorbei
        } else {
            console.log("Error playing Tequila");
        }
    });
}