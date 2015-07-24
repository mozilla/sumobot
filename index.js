var irc = require('irc');
var client = new irc.Client('irc.mozilla.org', 'botnick', {
    channels: ['#sumobotdev'],
});

