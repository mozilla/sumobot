var fs = require('fs'),
    irc = require('irc'),
    https = require('https'),
    crypto = require('crypto'),
    twitter = require('twitter'),
    sqlite3 = require('sqlite3'),
    config = require('./config'),
    parsexml = require('xml2js').parseString,
    db = new sqlite3.Database(config.bot.database);

// Default Timezone
process.env.TZ = 'GMT'

var options = {
        channels: config.irc.channels,
        autoRejoin: true,
        autoConnect: true,
        sasl: true,
        password: config.irc.password,
        stripColors: true,
        port: config.irc.port,
        secure: config.irc.ssl,
        userName: config.irc.nick,
        realName: config.irc.realname,
        floodProtection: false
    };

// Setup database if not exists
if (!fs.existsSync(config.bot.database)) {

    db.run("CREATE TABLE notified (id INTEGER PRIMARY KEY AUTOINCREMENT, nick TEXT UNIQUE)");
    db.run("CREATE TABLE feed (id INTEGER PRIMARY KEY AUTOINCREMENT, post TEXT UNIQUE)");
    db.run("CREATE TABLE twitter (id INTEGER PRIMARY KEY AUTOINCREMENT, post TEXT UNIQUE)");

}

// Connect to IRC Server
var client = new irc.Client(config.irc.server, config.irc.nick, options);

// Logs function
function log(message) {

    if (config.logs.stdout) {
        console.log(message)
    }

    if (config.logs.log) {

       fs.writeFile(config.logs.file, message + "\n", {flag: 'a'});

    }

};

// Add nick to notifieds table function
function addNick(nick) {

    db.run("INSERT INTO notified (id, nick) VALUES (NULL, '" + nick + "')");

}

// Add post to the table
function addPost(hash, table) {

    db.run("INSERT INTO " + table + " (id, post) VALUES (NULL, '" + hash + "')");

}

// Update Feed
function checkFeed() {

    config.feeds.watch.forEach(function (feedurl) {

        var request = https.request(feedurl, function (res) {

            var data = '';

            res.on('data', function (chunk) {

                data += chunk;

            });

            res.on('end', function () {

                parsexml(data, function (err, result) {

                    if (result.rss != undefined) {

                        var feedname = result.rss.channel[0].title[0];

                        var items = result.rss.channel[0].item;

                        var atom = false;

                    } else if (result.feed != undefined) {

                        var feedname = result.feed.title[0];

                        var items = result.feed.entry;

                        var atom = true;

                    }

                    items.forEach(function(post){

                        if (atom) {

                            var date = new Date(post.published[0])

                            var link = result.feed.entry[0].link[0].$.href;

                        } else {

                            var date = new Date(post.pubDate[0]);

                            var link = post.link[0];

                        }

                        var md5 = crypto.createHash('md5').update(date + post.title[0]).digest('hex');

                        db.get("SELECT id FROM feed WHERE feed.post = '" + md5 + "'", function (err, row) {

                            if (row == undefined) {

                                config.feeds.channels.forEach(function (channel) {

                                    client.say(channel, "New post on " + feedname + ": " + post.title[0] + " <" + link + ">");

                                });

                                addPost(md5, "feed");

                            }

                        });

                    });

                });

            });

        });

        request.end();

    })

}

var twitterclient = new twitter({
        consumer_key: config.twitter.consumerkey,
        consumer_secret: config.twitter.consumersecret,
        access_token_key: config.twitter.accesstokenkey,
        access_token_secret: config.twitter.accesstokensecret
    });

// Update Twitter
function checkTwitter() {

    twitterclient.get('statuses/user_timeline', {count: 10, screen_name: "sumo_mozilla"}, function(error, tweets, response){

        if (error) {

            log(error);

        }

        tweets.forEach(function(tweet){

            db.get("SELECT id FROM twitter WHERE twitter.post = '" + tweet.id + "'", function (err, row) {

                if (row == undefined) {

                    config.twitter.channels.forEach(function (channel) {

                        client.say(channel, tweet.user.screen_name + ": " + tweet.text);

                    });

                    addPost(tweet.id, "twitter");

                }

            });

        });

    });

}

// Messages
client.addListener('message', function(from, to, message) {

    if (from != "firebot") {

        if (message.search('[!:]command') >= 0) {
            client.say(to, "reply");
        }

        if (message.search('[!:]dev') >= 0){
            client.say(to, from + ": You can reach the SuMo developers at #sumodev or by filling a bug at http://mzl.la/1SVRbVQ");
        }

        if (message.search('[!:]kbdashboard') >= 0){
            client.say(to, from + ": help us improve the knowledge base. visit https://support.mozilla.org/en-US/contributors/kb-overview for a list of articles that need updates");
        }

        if (message.search('[!:]yahoo') >= 0){
            var command = message.split(" ");
            command.shift()
            client.say(to, from + ": https://yahoo.com/search?p=" + encodeURIComponent(command.join(" ")))
        }

        if (message.search('[!:]help') >= 0) {
            client.say(to, "Available commands: !command")
            client.say(to, "!command: return \"reply\'")
        }

    }

});

// Join
client.addListener('join', function(channel, nick, message) {

    var today = new Date();

    if ((nick != config.irc.nick) && (today.getDay() == 4)) {

        db.get("SELECT id FROM notified WHERE notified.nick = '" + nick + "'", function (err, row) {

            if (row == undefined) {

                var sumoday = false;
                var staticSumoDate = new Date(config.bot.staticSumoDate);

                while (staticSumoDate < today) {

                    staticSumoDate.setDate(staticSumoDate.getDate() + 14);

                }

                if (staticSumoDate.toDateString() == today.toDateString()) {

                    sumoday = true;

                }

                if (sumoday) {

                    client.say(nick, config.bot.welcomemessagesumoday);

                } else {

                    client.say(nick, config.bot.welcomemessagekb);

                }

                addNick(nick);

            }

        });

    }

});

// Nick change
client.addListener('nick', function(oldnick, newnick, channels, message) {

    db.get("SELECT id FROM notified WHERE notified.nick = '" + newnick + "'", function (err, row) {

        if (row == undefined) {

            addNick(newnick);

        }

    });

});

// Errors
client.addListener('error', function(message) {

    log('Error: ', message);

});

// Update feeds
client.addListener('registered', function (message) {

    // Check every 15 minutes
    setInterval(checkFeed, 900 * 1000);
    setInterval(checkTwitter, 900 * 1000);

});
