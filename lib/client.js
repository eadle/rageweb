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
  self.health = 100;
  self.position = {x: 0, y: 0};
  self.velocity = {x: 0, y: 0};
  self.time = new Date().getTime();
  self.chat = '';
  
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
  self.connection.send(JSON.stringify({
    'type': 'worldstate',
    'players': self.game.names
  }));

  var filter = self.id;
  self.connection.on('message', function(data) {
    console.log('received message: ' + data);
    var message = JSON.parse(data),
        now = new Date().getTime();

    switch (message.type) {
      case 'move':
        var position = self._clampPosition(message.pos),
            velocity = self._clampVelocity(message.vel);
        self.game.broadcast(filter, JSON.stringify({
          'type': 'move',
          'id': self.id,
          'position': position,
          'velocity': velocity
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
        chat = self._applyRegex(chat);
        self.game.broadcast(filter, JSON.stringify({
          'type': 'chat',
          'id': self.id,
          'message': chat
        }));
        break;
      case 'name':
        // only let them set name once
        if (self.name) return;
        var name = message.name;
        console.log('received name: ' + name);
        if (self.game.validName(name)) {
          // send player their name
          self.name = name;
          self.game.names[name] = self.id;
          self.connection.send(JSON.stringify({
            'type': 'handle',
            'id': self.id,
            'name': self.name
          }));
          // broadcast new player arrival
          self.game.broadcast(filter, JSON.stringify({
            'type': 'player',
            'id': self.id,
            'name': self.name
          }));
        } else {
          // invalid name
          self.connection.send(JSON.stringify({
            'type': 'error',
            'error': 'name invalid'
          }));
        }
        break;
      default:
        //self.connection.send(JSON.stringify({'type': 'special'}));
    }

  });

  self.connection.on('close', function() {
    self._dispose();
    console.log('disconnected: ' + self.id);
  });

  self.connection.on('error', function(err) {
    self._dispose();
  });

};

const maxSpeed = 20;
const maxVelocity = {x: maxSpeed, y: maxSpeed};
const minVelocity = {x: 0, y: 0};
Client.prototype._clampVelocity = function(velocity) {
  var self = this;
  // TODO...
};

//const maxPosition 
//const minPosition
Client.prototype._clampPosition = function(position) {
  var self = this;
  // TODO...
};

Client.prototype._applyRegex = function(chat) {
  var self = this;
  // FIXME
  return chat;
};

module.exports = Client;
