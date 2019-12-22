/**
//Start bpm updater
clearInterval(refresher);
tal.updateBPM(access_token, track_id, changeSongDetails);
refresher = setInterval(function () {
    tal.updateBPM(access_token, track_id, changeSongDetails);
}, 5000);
*/

const tequila_uri = "spotify:track:5gJKsGij5oGt5H5RSFYXPa";
const bpmIntervalTime = 5000;

let tequilaIntervalBase = 45 * 60 * 1000;
let tequilaIntervalMax = 45 * 60 * 1000;

let bpmInterval;
let tequilaInterval;

let beats, track;
let context, track_id, track_uri, name, artists;

module.exports = {
    run: run,
    reset: function() {
        clearInterval(bpmInterval);
        clearInterval(tequilaInterval);
    },
    setIntervalTimes: function(base, max) {
        tequilaIntervalBase = base * 60 * 1000;
        tequilaIntervalMax = max * 60 * 1000;

        console.log("Base: ", base);
        console.log("Max: ", max);
    }
}

function run(spotifyApi) {
    module.exports.reset();

    bpmInterval = setInterval(function() {
        getSongDetails(spotifyApi);
    }, bpmIntervalTime);

    let newTime = tequilaIntervalBase + Math.random() * tequilaIntervalMax;
    console.log("First Tequila time in " + Math.floor(newTime / 60000) + " mins");
    setTimeout(function() {
        tequilaTime(spotifyApi);
    }, newTime);
}

function getSongDetails(spotifyApi) {
    let progress_ms;

    spotifyApi.getMyCurrentPlaybackState()
    .then(function(data) {
        if(Object.keys(data.body).length == 0) {
            //console.log("No song currently playing");
            return null;
        }
        
        if(track_id == data.body.item.id && track_uri == data.body.item.uri) 
            return null;

        track_id = data.body.item.id;
        track_uri = data.body.item.uri;
        context = data.body.context;
        name = data.body.item.name;
        artists = data.body.item.artists.map(a => a.name);
        progress_ms = data.body.progress_ms;

        return spotifyApi.getAudioAnalysisForTrack(track_id);
    }).then(function(data) {
        if(data == null)
            return;

        beats = data.body.beats;
        track = data.body.track;
        console.log("Currently playing: \"" + name + "\" by " + artists.join(", "));
    }).catch(function(err) {
        console.log(err);
    });
}

function tequilaTime(spotifyApi) {
    //play the tequila song
    let position_ms;
    const previous_uri = track_uri;

    spotifyApi.getMyCurrentPlaybackState()
    .then(function(data) {
        if(Object.keys(data.body).length == 0)
            return Promise.reject("No Playback device available");

        position_ms = data.body.progress_ms;

        return spotifyApi.play({
            uris: [tequila_uri]
        });
    }).then(function() {
        return spotifyApi.seek(20000);
    }).then(function() {
        //Wait until Tequila is done
        setTimeout(function(){
            //Continue previous track
            const options = context ? {
                context_uri: context.uri,
                offset: { "uri": previous_uri }
            } : {
                uris: [previous_uri]//context_uri: "spotify:playlist:37i9dQZF1DX9EM98aZosoy" //Fallback playlist
            };

            spotifyApi.play(options)
            .then(function() {
                return spotifyApi.seek(position_ms);
            }).catch(function(err) {
                console.log(err);
            });
        }, 115000);
    }).catch(function(err) {
        console.log(err);
    });
    
    let newTime = tequilaIntervalBase + Math.random() * tequilaIntervalMax;
    setTimeout(function() {
        tequilaTime(spotifyApi);
    }, newTime);
    console.log("Next Tequila time in " + Math.floor(newTime / 60000) + " mins");
}

