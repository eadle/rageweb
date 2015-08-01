'use strict';

function World(options) {
  // TODO...
};


function Player(id, name) {
  var self = this;

  self.id = id;
  self.name = name;
  self.position = {x: 0, y: 0};
  self.velocity = {x: 0, y: 0};

  console.log('created player: id='+id + ', name=' + name);
}

Player.prototype.update = function(t) {

};

Player.prototype.setPosition = function(position) {

};

Player.prototype.setVelocity = function(velocity) {

};

Player.prototype.setChatMessage = function(chat) {

};


function Game(options) {
  var self = this;
  options = options || {};

  self.players = {};
  self.name = null;
  self.id = '';
  self.ws = null;

  // connect to server
  var server = 'ws://' + window.location.hostname + ':8188';
  if (typeof server !== 'string') {
    throw new Error('expects valid server');
  }
  self._setupServerConnection(server);

  // setup chat 
  self.log = document.getElementById('chat-log'),
  self.input = document.getElementById('chat-input'),
  self.form = document.getElementById('chat-form'),
  self.messages = document.getElementById('chat-messages'),
  self.handle = document.getElementById('handle');
  self._setupInputEvents();

  // setup game
  var game = new Phaser.Game(512, 300, Phaser.CANVAS, 'phaser-example', {
    preload: preload, create: create, update: update, render: render
  });
  function preload() {
	  game.stage.backgroundColor = '#007236';
	  game.load.image('mushroom', 'assets/sprites/mushroom.png');
  }
  var cursors;
  function create() {
	  game.world.setBounds(0, 0, 512, 300);
	  cursors = game.input.keyboard.createCursorKeys();
  }
  function update() {

  }
  function render() {
	  game.debug.cameraInfo(game.camera, 32, 32);
  }

}

Game.prototype._setupInputEvents = function() {
  var self = this;

  // disables pasta
  self.input.onpaste = function(e) {
    // e.preventDefault(); // >:D
  };
  
  self.requestingHandle = true;
  self.form.addEventListener("submit", function(event) {
    // don't refresh the page
    event.preventDefault();

    var message = self.input.value;
    if (self.input.value !== '') {
      if (!self.requestingHandle) {
        var li = document.createElement("li");
        var textnode = document.createTextNode(message);
        li.innerHTML = '<a class="user" onclick=\'alert("clicked")\'>&lt'+self.name+'&gt&nbsp</a>';
        li.appendChild(textnode);
        self.messages.appendChild(li);
        // lock scroller to last message
        self.log.scrollTop = self.log.scrollHeight;
        // send message to server
        self.ws.send(JSON.stringify({
          'type': 'chat',
          'message': message
        }));
      } else {
        // send name to server
        self.ws.send(JSON.stringify({
          'type': 'name',
          'name': message
        }));
      }
      self.input.value = '';
    }

  }, false);

};

Game.prototype._setupServerConnection = function(server) {
  var self = this;

  self.ws = new WebSocket(server);

  self.ws.onmessage = function(event) {
    console.log('received: ' + event.data);
    var message = JSON.parse(event.data);
    switch (message.type) {
      case 'handle':
          self.id = message.id;
          self.name// FIXME
          console.log('Alright ' + message.name + '. If you say so.');
          self.requestingHandle = false;
          console.log(self.handle.innerHTML);
          self.handle.innerHTML = message.name;
          self.name = message.name;
        break;
      case 'player':
        self.players[message.id] = new Player(message.id, message.name);
        break;
      case 'move':
        var position = message.pos,
            velocity = message.vel,
            pid = message.id;
        self.applyMove(pid, position, velocity);
      case 'jump':
        var pid = message.id;
        self.applyJump(pid);
        break;
      case 'chat':
        var pid = message.id;
        console.log('received message: ' + message.message);
        self.appendChatMessage(pid, message.message);
        break;
      case 'special':
        self.applySpecial();
        break;
      case 'worldstate':
        // iterate over all players
        var players = message.players;
        if (typeof players === 'object') {
          console.log('adding all players');
          Object.keys(players).forEach(function(name) {
            var pid = players[name];
            self.players[pid] = new Player(pid, name);
          });
        }
        // TODO
        break;
      default:
    }   

  };

  self.ws.onopen = function() {
    console.log('connected to server');
  };

  self.ws.onclose = function() {
    console.log('disconnected to server');
  };

  self.ws.onerror = function(err) {
    throw err;
  };
  

};

Game.prototype.appendChatMessage = function(pid, message) {
  var self = this;

  console.log('appendChatMessage: pid=' + pid + ', message=' + message);
  var player = self.players[pid];
  if (player) {
    var name = player.name;
    var li = document.createElement("li");
    var textnode = document.createTextNode(message);
    li.innerHTML = '<a class="user" onclick=\'alert("clicked")\'>&lt'+name+'&gt&nbsp</a>';
    li.appendChild(textnode);
    self.messages.appendChild(li);
    // lock scroller to last message
    self.log.scrollTop = self.log.scrollHeight;
  } else {
    console.log('something is wrong');
  }

};
