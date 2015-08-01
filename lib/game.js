var ws = require('ws'),
    Client = require('./client.js');

function Game(options) {
  var self = this;
  options = options || {};
  self.port = options.port || 8188;
  if (typeof self.port !== 'number' || self.port < 1000) {
    throw new Error('invalid port: ' + self.port);
  }
  self.clients = {};
  self.names = {};
  self.server = new ws.Server({port: self.port});
  self.server.on('connection', function(connection) {
    var id = self._generateId();
    self.clients[id] = new Client({game: self, id: id, connection: connection});
  });
  console.log('Listening on ' + self.port + '...');
}

Game.prototype.validName = function(name) {
  var self = this;
  var validity = false;
  if (typeof name !== 'string') return false;
  if (!(name in self.names)) {
    if (name.length < 10) {
      if (name.match(/^[a-zA-Z0-9_-]*$/g)) {
        validity = true;
      }
    }
  }
  return validity;
};

Game.prototype.broadcast = function(filter, data) {
  var self = this;
  console.log('broadcasting: filter=' + filter + ', data=' + data);
  Object.keys(self.clients).forEach(function(key) {
    if (key !== filter) {
      console.log('sending data to ' + key);
      var client = self.clients[key];
      if (client) {
        client.send(data);
      } else {
        delete clients[key];
      }
    }
  });
};

Game.prototype._generateId = function() {
  var self = this;
  var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    +'abcdefghijklmnopqrstuvwxyz0123456789';
  var id = ''; 
  for (var i = 0; i < 12; i++) {
    var randomPoz = Math.floor(Math.random()*charSet.length);
    id += charSet.substring(randomPoz, randomPoz+1);
  }   
  return (id in self.clients) ? self._generateId : id; 
};

module.exports = Game;
