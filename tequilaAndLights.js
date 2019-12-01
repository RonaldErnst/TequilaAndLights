
var request = require('request'); // "Request" library
var querystring = require('querystring');

let minGap = 30 * 1000 * 60; //30min
let randomTime = 60 * 1000 * 60; //60min
let waitTime = 5000;//115000;

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
    
    tequilaTime: function (access_token, current_id, current_playlist) {
        if (access_token != null) {
            if (current_playlist) {
                getPosition(access_token, current_id, current_playlist, 0, playTequila);
            }
        }

        const newTime = minGap + Math.random() * randomTime;
        //setTimeout(tequilaTime, newTime);
        console.log("Next Tequila time in: " + Math.floor(newTime / 60000) + "min");
    }
}

function getPosition(access_token, current_id, current_playlist, offset, callback) {
    let options = {
        url: "https://api.spotify.com/v1/playlists/" + current_playlist + "/tracks?fields=total,next,offset,limit,items(track(id))&offset=" + offset,
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
    };

    request.get(options, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            let tracks = body.items.map(i => i.track.id);
            let position = tracks.indexOf(current_id);

            if (position >= 0) 
                callback(access_token, current_playlist, position);

            if (position < 0 && body.next != null)
                getPosition(access_token, current_id, current_playlist, offset + tracks.length, callback);

        } else {
            console.log("Couldnt get tracks of playlist", error);
        }
    });
}

function playTequila(access_token, current_playlist, position) {
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
        if (error || response.statusCode !== 204) {
            console.log("Error playing Tequila");
        }
    });

    //Playlist von vorher wiedergeben oder fallback playlist abspielen
    setTimeout(function () {
        if (current_playlist) {
            console.log("Back to playing " + current_playlist + " at position " + position);
        } else {
            console.log("Playing random song");
        }
    }, waitTime); //Warten bis Tequila vorbei
}