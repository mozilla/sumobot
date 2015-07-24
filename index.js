var irc = require('irc'),
    config = require('./config');

var options = {
        channels: config.irc.channels,
        autoRejoin: true,
        port: config.irc.port,
        secure: config.irc.ssl
    };

var client = new irc.Client(config.irc.server, config.irc.nick, {channels: config.irc.channels});

client.addListener('message', function(from, to, message) {

    if (message.search('[!:]command') >= 0) {
        client.say(to, "reply");
    }

});
