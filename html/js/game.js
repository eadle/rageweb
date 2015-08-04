'use strict';

var LEFT_MASK  = 1,
    RIGHT_MASK = 1 << 1,
    UP_MASK    = 1 << 2,
    DOWN_MASK  = 1 << 3;

function Game(options) {
  var self = this;
  options = options || {};

  self.players = {};
  self.client = null;
  self.lastupdate = -1;
  self.ws = null;
  self.spriteGroup = null;

  // setup chat 
  self.unseenMessages = 0;
  self.hasClientFocus = true;
  self.log = document.getElementById('chat-log'),
  self.input = document.getElementById('chat-input'),
  self.form = document.getElementById('chat-form'),
  self.messages = document.getElementById('chat-messages'),
  self.handle = document.getElementById('handle');
  self._setupChatInput();

  // setup game
  self.game = new Phaser.Game(512, 300, Phaser.CANVAS, 'phaser-example', {
    preload: preload, create: create, update: update, render: render
  });

  // preload function
  function preload() {
    self.game.onPause.add(function() {
      self.hasClientFocus = false;
      if (self.client) {
        self.client.keystate = 0;
      }
    }, self);
    self.game.onResume.add(function() {
      self.unseenMessages = 0;
      self.hasClientFocus = true;
      document.title = 'skellyweb';
    }, self);

	  self.game.stage.backgroundColor = '#222244';
    self.game.load.atlas('dawnlike', 'assets/dawnlike.png', 'assets/dawnlike.json');
    //self.game.stage.disableVisibilityChange = true;
    self.lasttime = self.game.time.now;
  }

  var cursors;
  function create() {

    // connect to server
    var server = 'ws://167.114.185.203:8188';
    if (typeof server !== 'string') {
      throw new Error('expects valid server');
    }

    self._setupServerConnection(server);
	  self.game.world.setBounds(0, 0, 512, 300);
	  cursors = self.game.input.keyboard.createCursorKeys();
    self.spriteGroup = self.game.add.group();
  }

  function update() {
    var now = self.game.time.now; 
    var dt = now - self.lasttime;
    self._updatePlayers(dt);
    if (self.client) {
      self._updateClient(dt);
    }
    self.lasttime = now;
  }

  function render() {
    // game.debug.spriteInfo(sprite, 32, 32);
	  // game.debug.cameraInfo(game.camera, 32, 32);
  }

}

Game.prototype._createPlayerSprite = function(file, pos) {
  var self = this;
  pos = pos || {x: self.game.world.centerX, y: self.game.world.centerY};
  var sprite = new Phaser.Sprite(self.game, pos.x, pos.y, 'dawnlike', file);
  sprite.scale.setTo(2.0, 2.0);
  sprite.anchor.setTo(0.5, 0.5);
  sprite.smoothed = false;

  // testing idle animation
  sprite.animations.add('skelly-idle', ['skelly-0.png', 'skelly-1.png']);
  sprite.animations.play('skelly-idle', 2, true);

  self.spriteGroup.add(sprite);
  return sprite;
};

Game.prototype._addPlayer = function(id, name, file, position, velocity) {
  var self = this;
  var sprite = self._createPlayerSprite(file, position);
  self.players[id] = new Player(id, name, sprite, position, velocity);
};

Game.prototype._addClient = function(id, name, file, position, velocity) {
  var self = this;
  var pos = {x: self.game.world.centerX, y: self.game.world.centerY};
  var sprite = self._createPlayerSprite(file, position);
  self.client = new Player(id, name, sprite, pos);
  self._setupMoveCallbacks();
  self._broadcastClientState();
};

Game.prototype._setupMoveCallbacks = function() {
  var self = this;

  var upKey = self.game.input.keyboard.addKey(Phaser.Keyboard.UP);
  upKey.onDown.add(function(){self.client.keystate |= UP_MASK}, self);
  upKey.onUp.add(function()  {self.client.keystate &= ~UP_MASK}, self);
  var downKey = self.game.input.keyboard.addKey(Phaser.Keyboard.DOWN);
  downKey.onDown.add(function(){self.client.keystate |= DOWN_MASK}, self);
  downKey.onUp.add(function()  {self.client.keystate &= ~DOWN_MASK}, self);
  var leftKey = self.game.input.keyboard.addKey(Phaser.Keyboard.LEFT);
  leftKey.onDown.add(function() {self.client.keystate |= LEFT_MASK}, self);
  leftKey.onUp.add(function()   {self.client.keystate &= ~LEFT_MASK}, self);
  var rightKey = self.game.input.keyboard.addKey(Phaser.Keyboard.RIGHT);
  rightKey.onDown.add(function() {self.client.keystate |= RIGHT_MASK}, self);
  rightKey.onUp.add(function()   {self.client.keystate &= ~RIGHT_MASK}, self);

};

Game.prototype._updateClient = function(dt) {
  var self = this;

  var client = self.client,
      speed = 0.25;
  client.velocity.x = 0;
  client.velocity.y = 0;
  if (client.keystate & LEFT_MASK)  client.velocity.x -= speed;
  if (client.keystate & RIGHT_MASK) client.velocity.x += speed;
  if (client.keystate & UP_MASK)    client.velocity.y -= speed;
  if (client.keystate & DOWN_MASK)  client.velocity.y += speed;
  client.update(dt);

  if (client.keystate !== client.laststate) {
    client.lasttime = self.game.time.now;
    client.laststate = client.keystate;
    self._broadcastClientState();
  }

};

Game.prototype._updatePlayers = function(dt) {
  var self = this;
  Object.keys(self.players).forEach(function(player) {
    self.players[player].update(dt);
  });
};


Game.prototype._broadcastClientState = function(data) {
  var self = this;

  if (self.client) {
    self.ws.send(JSON.stringify({
      'type': 'move',
      'id': self.client.id,
      'position': self.client.position,
      'velocity': self.client.velocity
    }));
  }
};

Game.prototype.applyMove = function(pid, position, velocity) {
  var self = this;
  if (pid in self.players) {
    self.players[pid].setPosition(position);
    self.players[pid].setVelocity(velocity);
  }
};

Game.prototype._setupServerConnection = function(server) {
  var self = this;

  self.ws = new WebSocket(server);

  self.ws.onmessage = function(event) {
    //console.log('received: ' + event.data);
    var message = JSON.parse(event.data);
    switch (message.type) {
      case 'handle':
          self.requestingHandle = false;
          self.handle.innerHTML = message.name;
          self._addClient(message.id, message.name, 'skelly-0.png');
        break;
      case 'player':
        // TODO set position and velocity
        self._addPlayer(message.id, message.name, 'skelly-0.png',
          message.position, message.velocity);
        break;
      case 'move':
        var position = message.position,
            velocity = message.velocity,
            pid = message.id;
        self.applyMove(pid, position, velocity);
        break;
      case 'jump':
        var pid = message.id;
        // self.applyJump(pid); TODO
        break;
      case 'chat':
        var pid = message.id;
        if (pid in self.players) {
          self.appendUserMessage(self.players[pid].name, message.message);
        }
        break;
      case 'special':
        // self.applySpecial(); TODO
        break;
      case 'disconnect':
        var player = self.players[message.id];
        if (player) {
          player.dispose();
          delete self.players[message.id];
        }
        break;
      case 'worldstate':
        // add players to the world
        var players = message.players;
        if (typeof players === 'object') {
          console.log('adding all players');
          Object.keys(players).forEach(function(name) {
            var player = players[name];
            self._addPlayer(player.id, name, 'skelly-0.png',
              player.position, player.velocity);
          });
        }
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

Game.prototype.appendMessage = function(message) {
  var self = this;

  var textnode = document.createTextNode(message);
  var li = document.createElement("li");
  li.appendChild(textnode);
  self.messages.appendChild(li);
  self.log.scrollTop = self.log.scrollHeight;

};

Game.prototype.selectUser = function(name) {
  var self = this;
  alert(name + 'clicked');
  // TODO ...
};

Game.prototype.appendUserMessage = function(name, message) {
  var self = this;

  if (!self.hasClientFocus) {
    self.unseenMessages += 1;
    document.title = '(' + self.unseenMessages + ') skellyweb';
  }

  var textnode = document.createTextNode(message);
  var li = document.createElement("li");
  li.innerHTML = '<a class="user" onclick=\'game.selectUser("'+name+'")\'>&lt'+name+'&gt&nbsp</a>';
  if (message[0] === '>') {
    var span = document.createElement('span');
    span.className = 'quote';
    span.appendChild(textnode);
    li.appendChild(span);
  } else {
    li.appendChild(textnode);
  }
  self.messages.appendChild(li);

  // lock scroller to last message
  self.log.scrollTop = self.log.scrollHeight;

};

Game.prototype._setupChatInput = function() {
  var self = this;
  self.requestingHandle = true;

  self.input.onpaste = function(e) {
    // prevents pasta
    // e.preventDefault();
  };

  self.form.addEventListener("submit", function(event) {
    // prevents page refresh
    event.preventDefault();

    var message = self.input.value;
    if (message) {
      if (!self.requestingHandle) {
        message = message.replace(/^\s*|^\s$/gm, '');
        if (message !== '') {
          self.appendUserMessage(self.client.name, message);
          // send message to server
          self.ws.send(JSON.stringify({
            'type': 'chat',
            'message': message
          }));
        }

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

