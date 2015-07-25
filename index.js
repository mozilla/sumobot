var fs = require('fs'),
    irc = require('irc'),
    http = require('http'),
    crypto = require('crypto'),
    sqlite3 = require('sqlite3'),
    config = require('./config'),
    parsexml = require('xml2js').parseString,
    db = new sqlite3.Database(config.bot.database);

var options = {
        channels: config.irc.channels,
        autoRejoin: true,
        port: config.irc.port,
        secure: config.irc.ssl
    };

// Setup database if not exists
if (!fs.existsSync(config.bot.database)) {
    db.run("CREATE TABLE notified (id INTEGER PRIMARY KEY AUTOINCREMENT, nick TEXT UNIQUE)");
    db.run("CREATE TABLE feed (id INTEGER PRIMARY KEY AUTOINCREMENT, post TEXT UNIQUE)");
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

        var request = http.request(feedurl, function (res) {

            var data = '';

            res.on('data', function (chunk) {

                data += chunk;

            });

            res.on('end', function () {

                parsexml(data, function (err, result) {

                    var feedname = result.rss.channel[0].title;

                    result.rss.channel[0].item.forEach(function(post){

                        var date = new Date(post.pubDate);

                        var md5 = crypto.createHash('md5').update(date + post.title).digest('hex');

                        db.get("SELECT id FROM feed WHERE feed.post = '" + md5 + "'", function (err, row) {

                            if (row == undefined) {

                                config.feeds.channels.forEach(function (channel) {

                                    client.say(channel, "New post on " + feedname + ": " + post.title + " <" + post.link + ">");

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

// Messages
client.addListener('message', function(from, to, message) {

    if (message.search('[!:]command') >= 0) {
        client.say(to, "reply");
    }

});

// Join
client.addListener('join', function(channel, nick, message) {

    if (nick != config.irc.nick) {

        db.get("SELECT id FROM notified WHERE notified.nick = '" + nick + "'", function (err, row) {

            if (row == undefined) {

                client.say(nick, config.bot.welcomemessage);
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

    console.log('Error: ', message);

});

// Update feeds
client.addListener('registered', function (message) {

    setInterval(checkFeed, 30 * 1000);

});
