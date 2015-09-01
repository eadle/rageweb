'use strict';

function Client(options) {
  var self = this;
  options = options || {};

  self.game = options.game || null;
  if (typeof self.game !== 'object') {
    throw new Error('expects valid game object');
  }

  self.id = options.id;
  if (typeof self.id !== 'string') {
    throw new Error('expects valid id');
  }

  self.connection = options.connection;
  if (typeof self.connection !== 'object') {
    throw new Error('expects valid connection');
  }
  self._setupConnectionCallbacks();

  self.name = null;
  self.position = {x: -10000, y: -10000};
  self.state = 0;

  // randomly select character
  self.character = (Math.floor(Math.random() * 100)%2) ? 'max' : 'vice';
  
}

Client.prototype._dispose = function() {
  var self = this;
  delete self.game.names[self.name];
  delete self.game.clients[self.id];
};

Client.prototype._setupConnectionCallbacks = function() {
  var self = this;
  console.log('connected: ' + self.id);



  // send list of all players
  self.send(JSON.stringify({
    'type': 'worldstate',
    'players': self.game.names
  }));

  var filter = self.id;
  self.connection.on('message', function(data) {
    console.log('received message: ' + data);
    var message = JSON.parse(data),
        now = new Date().getTime();

    switch (message.type) {
      case 'state':

        // FIXME
        self.position = message.position;
        self.state = message.state;

        self.game.names[self.name].state = self.state;
        self.game.names[self.name].position = self.position;

        self.game.broadcast(filter, JSON.stringify({
          'type': 'state',
          'id': self.id,
          'position': self.position,
          'state': self.state
        }));
        break;
      case 'jump':
        self.game.broadcast(filter, JSON.stringify({
          'type': 'jump',
          'id': self.id,
        }));
        break;
      case 'chat':
        var chat = message.message;
        chat = self._sanitizeMessage(chat);
        if (chat !== '') {
          self.game.broadcast(filter, JSON.stringify({
            'type': 'chat',
            'id': self.id,
            'message': chat
          }));
        }
        break;
      case 'name':
        // only let them set name once
        if (self.name) return;
        var name = message.name;
        console.log('received name: ' + name);
        if (self.game.validName(name)) {
          // send player their name
          self.name = name;
          //self.game.names[name] = self.id;
          self.game.names[name] = {
            'id': self.id,
            'character': self.character,
            'position': self.position,
            'state': self.state
          };
          self.send(JSON.stringify({
            'type': 'handle',
            'id': self.id,
            'name': self.name,
            'character': self.character
          }));
          // broadcast new player arrival
          self.game.broadcast(filter, JSON.stringify({
            'type': 'player',
            'id': self.id,
            'name': self.name,
            'character': self.character,
            'position': self.position,
            'state': self.state
          }));
        } else {
          // invalid name
          self.send(JSON.stringify({
            'type': 'error',
            'error': 'invalid name'
          }));
        }
        break;
      default:
        //self.send(JSON.stringify({'type': 'special'}));
    }

  });

  self.connection.on('close', function() {
    self._dispose();
    console.log('disconnected: ' + self.id);
    self.game.broadcast(self.id, JSON.stringify({
      'type': 'disconnect',
      'id': self.id
    }));
  });

  self.connection.on('error', function(err) {
    self._dispose();
  });

};

Client.prototype.send = function(data) {
  var self = this;
  var OPEN = 1; // FIXME
  if (OPEN === self.connection.readyState) {
    self.connection.send(data);
  }
};

Client.prototype._clampPosition = function(position) {
  var self = this;
  // TODO
  return position;
};

Client.prototype._sanitizeState = function(state) {
  var self = this;
  // TODO
  return state;
};

Client.prototype._sanitizeMessage = function(message) {
  var self = this;
  // 300 character limit followed by '...'
  if (message.length > 303) {
    message = message.substring(0, 300) + '...';
  }
  // remove whitespace
  message = message.replace(/^\s*|^\s$/gm, '');
  return message;
};

module.exports = Client;
