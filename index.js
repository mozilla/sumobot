var fs = require('fs'),
    irc = require('irc'),
    config = require('./config');

var options = {
        channels: config.irc.channels,
        autoRejoin: true,
        port: config.irc.port,
        secure: config.irc.ssl
    };

var client = new irc.Client(config.irc.server, config.irc.nick, options);

function log(message){

    if (config.logs.stdout) {
        console.log(message)
    }

    if (config.logs.log) {

       fs.writeFile(config.logs.file, message + "\n", {flag: 'a'});

    }

};

client.addListener('message', function(from, to, message) {

    if (message.search('[!:]command') >= 0) {
        client.say(to, "reply");
    }

});
