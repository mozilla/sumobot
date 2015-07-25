var fs = require('fs'),
    irc = require('irc'),
    sqlite3 = require('sqlite3'),
    config = require('./config'),
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
