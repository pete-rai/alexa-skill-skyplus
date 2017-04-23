/*
 * alexa-skill-boilerplate
 * https://github.com/pete-rai/alexa-skill-skyplus
 *
 * Copyright 2017 Pete Rai
 * Released under the MIT license
 * https://github.com/pete-rai/alexa-skill-skyplus/blob/master/LICENSE
 *
 * Released with the karmaware tag
 * https://pete-rai.github.io/karmaware
 *
 * Website  : http://www.rai.org.uk
 * GitHub   : https://github.com/pete-rai
 * LinkedIn : https://uk.linkedin.com/in/raipete
 *
 * === Some portions adapted from https://github.com/dalhundal/sky-remote ===
 *
 * Hey, like I know it should be split into different node modules
 * but tbh cba :) - feel free to do it yourself
 */

'use strict';

var http = require ('http');
var net  = require ('net' );
var fs   = require ('fs'  );

/* Note: You will need to find the public IP address that your SkyPlus box is
   behind. You can then hardcode it here, but for robustness you really should
   use a DNS service. After that, you will then need to punch a hole through
   your router on the SkyPlus port (which is normally as listed below). You can
   do this by setting up port-forwarding on the router. */

var stb      = {host: 'YOUR STBS PUBLIC IP ADDR HERE', port: 49160};    // see note above
var keys     = JSON.parse (fs.readFileSync ('keycodes.json', 'utf8'));  // enum to stb key code mapping
var channels = JSON.parse (fs.readFileSync ('channels.json', 'utf8'));  // channel data including genre - will change over time

// -- pick a random item from an array

Array.prototype.any = function ()
{
    return this [Math.floor (Math.random () * this.length)];
}

// --- simple zero padding method for numbers

Number.prototype.zeropad = function (size)
{
    var pad = this.toString ();
    while (pad.length < size) pad = '0' + pad;
    return pad;
}

// -- sends a single key to the stb - best leave those magic numbers alone ;)

function sendKey (key, callback)
{
    var code   = keys [key].code;
    var bytes  = [4, 1, 0, 0, 0, 0, Math.floor (224 + (code / 16)), code % 16];
    var client = net.connect (stb);
    var l      = 12;

    client.on ('data', function (data)
    {
        if (data.length < 24)
        {
            client.write (data.slice (0, l))
            l = 1;
        }
        else
        {
            client.write (new Buffer (bytes), function ()
            {
                bytes [1] = 0;

                client.write (new Buffer (bytes), function ()
                {
                    client.destroy ();
                    callback ();
                });
            });
        }
    });
}

// --- sends a series of keys to the stb with short delay between each

function sendKeys (keys, callback)
{
    const INTERKEY_DELAY = 50; // milliseconds

    sendKey (keys.shift (), function ()
    {
        if (keys.length)
        {
            setTimeout (function () { sendKeys (keys, callback) }, INTERKEY_DELAY);
        }
        else
        {
            callback ();
        }
    });
}

// --- tunes to a channel by sending the three number channel sequence

function tuneTo (epg, callback)
{
    sendKeys ([epg.toString ().substring (0,1),
               epg.toString ().substring (1,2),
               epg.toString ().substring (2,3)], callback);
}

// --- describes a time as human understandable hours and minutes

function descTime (time)
{
    var hour  = Math.floor (time / 3600);
    var min   = Math.floor ((time - hour * 3600) / 60);

    var hours = hour == 0 ? '' : hour == 1 ? '1 hour'   : hour + ' hours'
    var mins  = min  == 0 ? '' : min  == 1 ? '1 minute' : min  + ' minutes'

    return hours + (hours ? ' and ' : '') + mins;
}

// --- picks a random channel for a given genre

function randomChannel (genre)  // empty string as genre for all channels
{
    var candidates = [];

    for (var idx = 0; idx < channels.length; idx++)
    {
        var channel = channels [idx];

        if (channel.ignore == null)
        {
            if (!genre || channel.keywords.includes (genre))
            {
                candidates.push (channel);
            }
        }
    }

    return candidates.length ? candidates.any () : channels.any ();
}

// --- return channel object from a name

function channelFromName (name)
{
    var found = null;

    for (var idx = 0; idx < channels.length; idx++)
    {
        var channel = channels [idx];

        if (channel.ignore == null &&
            channel.name   == name.toLowerCase ())
        {
            found = channel;
        }
    }

    return found;
}

// --- gets information about the current programme on the supplied channel

function getProgramme (channel, callback)
{
    /* The data is (cheekily) obtained from tv.sky.com. The document we need to
       obtain from there is based on the current date and time of day. It is of
       the form:

          http://tv.sky.com/programme/channel/YYYY-MM-DD/P.json

       where P is the part of the day as follows:

          00:00 - 05:59 => P = 0
          06:00 - 10:59 => P = 1
          11:00 - 17:59 => P = 2
          18:00 - 23:59 => P = 3    */

    var now   = new Date ();
    var time  = now.getTime        () / 1000;
    var year  = now.getUTCFullYear ();
    var month = now.getUTCMonth    () + 1;
    var day   = now.getUTCDate     ();
    var hour  = now.getUTCHours    ();
    var part  = hour >= 18 ? 3 : hour >= 11 ? 2 : hour >= 6 ? 1 : 0;
    var doc   = year + '-' + month.zeropad (2) + '-' + day.zeropad (2) + '/' + part + '.json';

    var opt =
    {
        host    : 'tv.sky.com',
        path    : '/programme/channel/' + channel.id + '/' + doc,
        method  : 'GET',
        json    : true
    };

    http.get (opt, function (response)
    {
        var body = '';

        response.on ('data', function (chunk)
        {
            body += chunk;
        });

        response.on ('end', function ()
        {
            var data  = JSON.parse (body);
            var items = data.listings [channel.id];
            var curr  = {};

            for (var idx in items)
            {
                var item = items [idx];

                if (item.s <= time)  // started in the past
                {
                    var title = item.t;

                    title = title.replace ('New:'   , '' );  // don't want to say this
                    title = title.replace (/\s\s+/g , ' ');  // normalise whitespace

                    // remove all the things we dont want said from the synopsis

                    var synopsis = item.d;

                    synopsis = synopsis.replace (/ *\([^)]*\) */g  , '' );  // anything in round brackets
                    synopsis = synopsis.replace (/ *\[[^)]*\] */g  , '' );  // anything in square brackets
                    synopsis = synopsis.replace (/\d+\/\d+/g       , '' );  // season episode text
                    synopsis = synopsis.replace (/S\d+[,]? Ep\d+/g , '' );  // season episode text
                    synopsis = synopsis.replace ('Also in HD'      , '' );  // also in hd text
                    synopsis = synopsis.replace (/\s\s+/g          , ' ');  // normalise whitespace
                    synopsis = synopsis.replace ('/'               , ',');  // use comma as seperator

                    curr =
                    {
                        epg      : channel.epg,
                        channel  : channel.name,
                        age      : time - item.s,
                        title    : title.trim (),
                        synopsis : synopsis.trim ()
                    }
                }
            }

            callback (curr);
        });
    });
}

// --- produces a randomised sentence based on the programme info

function announceShow (title, channel, age, synopsis)
{
    var whichs = ['This is {title}', 'Your\'e watching {title}', 'Here is {title}', 'Now tuned to {title}'];
    var wheres = ['on the {channel} channel', 'on {channel}', 'from {channel}', 'from the folks at {channel}'];
    var whens  = ['It\'s been on for {age}', 'It started {age} go', 'It kicked off {age} ago'];

    var which = whichs.any ().replace ('{title}'   , '"' + title   + '"');
    var where = wheres.any ().replace ('{channel}' , '"' + channel + '"');
    var when  = whens.any  ().replace ('{age}'     , descTime (age));

    return which + ' ' + where + '. ' + when + '. ' + synopsis;
}

// --- landing point for our ShowMeSome skill

function showMeSome (intent, genre, callback)
{
    if (genre == 'any' || genre == 'anything') genre = '';  // empty string is any channel

    getProgramme (randomChannel (genre), function (prog)
    {
        var response = announceShow (prog.title, prog.channel, prog.age, prog.synopsis);

        tuneTo (prog.epg, function ()
        {
            callback ({}, buildResponse (intent, response));
        });
    });
}

// --- landing point for our TuneChannel skill

function tuneChannel (intent, name, callback)
{
    var channel = channelFromName (name);

    if (channel)
    {
        tuneTo (channel.epg, function ()
        {
            getProgramme (channel, function (prog)
            {
                callback ({}, buildResponse (intent, 'You are tuned to ' + name + ' showing "' + prog.title + '"'));
            });
        });
    }
    else
    {
        callback ({}, buildResponse (intent, 'Sorry, I couldn\'t find ' + name));
    }
}

// --- landing point for our Restart skill

function restart (intent, callback)
{
    sendKeys (['select', 'green'], function (prog)
    {
        callback ({}, buildResponse (intent, 'Restart requested'));
    });
}

// --- landing point for our Record skill

function record (intent, callback)
{
    sendKeys (['select', 'record'], function (prog)
    {
        callback ({}, buildResponse (intent, 'Your show is now recording'));
    });
}

// --- helper to build a simple one-off response object

function buildResponse (title, output)
{
    return buildFullResponse (title, output, null, true)
}

// --- helper to build a full response object with session (conversation) support

function buildFullResponse (title, output, reprompt, endit)
{
    return {
        outputSpeech :
        {
            type : 'PlainText',
            text :  output
        },
        card :
        {
            type    : 'Simple',
            title   :  title,
            content :  output
        },
        reprompt :
        {
            outputSpeech:
            {
                type : 'PlainText',
                text :  reprompt
            },
        },
        endit
    };
}

// --- helper to build the return package

function returnPackage (attributes, response)
{
    return {
        version : '1.0',
        attributes,
        response : response
    };
}

// --- event handlers

function onSessionStarted (request, session)
{
    console.log ('START - request: ' + request.requestId + ' - session: ' + session.sessionId);
}

function onLaunch (request, session)
{
    console.log ('LAUNCH - request: ' + request.requestId + ' - session: ' + session.sessionId);
}

function onSessionEnded (request, session)
{
    console.log ('END - request: ' + request.requestId + ' - session: ' + session.sessionId);
}

function onIntent (request, session, callback)
{
    console.log ('INTENT - request: ' + request.requestId + ' - session: ' + session.sessionId + ' - intent: ' + request.intent.name);

    switch (request.intent.name)
    {
        case 'ShowMeSome':
        {
            showMeSome (request.intent.name, request.intent.slots.Genre.value, callback);
        }
        break;

        case 'TuneChannel':
        {
            tuneChannel (request.intent.name, request.intent.slots.Channel.value, callback);
        }
        break;

        case 'Restart':
        {
            restart (request.intent.name, callback);
        }
        break;

        case 'Record':
        {
            record (request.intent.name, callback);
        }
        break;

        default:
        {
            throw new Error ('Invalid intent');
        }
    }
}

// --- main handler

exports.handler = (event, context, callback) =>
{
    try
    {
        console.log ('HANDLER - app: ' + event.session.application.applicationId);

    /*  if (event.session.application.applicationId !== 'amzn1.echo-sdk-ams.app.[unique-value-here]')
        {
             callback ('Invalid Application ID');
        }  */

        if (event.session.new)
        {
            onSessionStarted (event.request, event.session);
        }

        if (event.request.type === 'LaunchRequest')
        {
            onLaunch (event.request, event.session);
        }
        else if (event.request.type === 'IntentRequest')
        {
            onIntent (event.request, event.session, (attributes, response) => { callback (null, returnPackage (attributes, response)); });
        }
        else if (event.request.type === 'SessionEndedRequest')
        {
            onSessionEnded (event.request, event.session);
            callback ();
        }
    }
    catch (error)
    {
        callback (error);
    }
};

/* --- TESTING FUNCTIONS ---

    Comment out the functions you want to test outside of AWS and just call
    like a normal node function - node index.js param1 param2 . REMEMBER to
    comment them back out before you deploy to AWS lambda */

//  function sayIt (attributes, response) { console.log ("\n\n" + response.outputSpeech.text + "\n\n") }

//  process.argv.shift (); // shift off first two args - not user parameters
//  process.argv.shift ();

//  showMeSome  ('test', process.argv.shift (), sayIt);
//  tuneChannel ('test', process.argv.shift (), sayIt);
//  restart     ('test', sayIt);
//  record      ('test', sayIt);
