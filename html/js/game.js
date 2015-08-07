'use strict';

// debugging -- remove me
var startPos = {x:5*16,y:5*16};

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
  self.game = new Phaser.Game(256, 160, Phaser.CANVAS, 'phaser-example', {
    preload: preload, create: create, update: update, render: render
  });

  self.map = null;
  self.layer = null;
  self.collision = null;

  // testing tilemaps
  var tilemapFile = 'assets/test.json',
      layer = null,
      map = null;

  // preload function
  function preload() {
    self.game.stage.disableVisibilityChange = true;
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
    self.game.scale.maxWidth = 512;
    self.game.scale.maxHeight = 320;
    self.game.scale.pageAlignHorizontally = true;
    self.game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;

    // load texture atlas
    self.game.load.atlas('dawnlike', 'assets/dawnlike.png', 'assets/dawnlike.json');
    // load tilemap
    self.game.load.tilemap('tilemap', 'assets/collisionmap.json', null, Phaser.Tilemap.TILED_JSON);

    self.lasttime = self.game.time.now;
  }


  self.cursors = null;
  function create() {

    // start physics engine
    self.game.physics.startSystem(Phaser.Physics.ARCADE);

    // connect to server
    var server = 'ws://' + window.location.hostname + ':8188';
    if (typeof server !== 'string') {
      throw new Error('expects valid server');
    }
    self._setupServerConnection(server);

    // tilemap
    self.map = self.game.add.tilemap('tilemap');
    self.map.addTilesetImage('dawnlike');
    // map layer
    self.layer = self.map.createLayer('map');
    self.layer.smoothed = false;
    self.layer.resizeWorld();
    // collision layer
    self.collision = self.map.createLayer('collision');
    self.collision.smoothed = false;
    self.collision.resizeWorld();
    // sprites collide with collision layer
    self.map.setCollisionBetween(0, 10000, true, self.collision);

	  self.game.world.setBounds(0, 0, 512, 300);
	  self.cursors = self.game.input.keyboard.createCursorKeys();

    self.spriteGroup = self.game.add.group();

  }

  function update() {
    self._updatePlayers();
    if (self.client) {
      self._updateClient();
    }
    self.spriteGroup.sort('y', Phaser.Group.SORT_ASCENDING);
  }

  function render() {
    // self.game.debug.cameraInfo(self.game.camera, 32, 32);
    // game.debug.spriteInfo(sprite, 32, 32);
	  // game.debug.cameraInfo(game.camera, 32, 32);
  }

}

Game.prototype._createPlayerSprite = function(file, pos) {
  var self = this;
  pos = pos || startPos;

  var sprite = new Phaser.Sprite(self.game, pos.x, pos.y, 'dawnlike', file);
  //sprite.scale.setTo(2.0, 2.0);
  //sprite.anchor.setTo(0.5, 0.5);
  sprite.smoothed = false;

  // testing idle animation
  sprite.animations.add('skelly-idle', ['skelly-0.png', 'skelly-1.png']);
  sprite.animations.play('skelly-idle', 2, true);

  self.spriteGroup.add(sprite);

  return sprite;
};

Game.prototype._addPlayer = function(id, name, file, position, keystate) {
  var self = this;
  var sprite = self._createPlayerSprite(file, position);
  self.game.physics.enable(sprite);
  self.players[id] = new Player(id, name, sprite, position, keystate);
};

Game.prototype._addClient = function(id, name, file, position, keystate) {
  var self = this;
  position = position || startPos;
  var sprite = self._createPlayerSprite(file, position);
  self.game.physics.enable(sprite);
  self.client = new Player(id, name, sprite, position);

  self.client.setCameraFollow(self.game);
  self._broadcastClientState();
};

Game.prototype._updateClient = function() {
  var self = this;

  var state = 0;
  if (self.cursors.left.isDown)  state |= Player.LEFT_MASK;
  if (self.cursors.right.isDown) state |= Player.RIGHT_MASK;
  if (self.cursors.up.isDown)    state |= Player.UP_MASK;
  if (self.cursors.down.isDown)  state |= Player.DOWN_MASK;

  self.client.update();

  if (state !== self.client.keystate) {
    self.client.keystate = state;
    self._broadcastClientState();
  }

  self.game.physics.arcade.collide(self.client.sprite, self.collision);

};

Game.prototype._updatePlayers = function(dt) {
  var self = this;
  Object.keys(self.players).forEach(function(player) {
    self.players[player].update();
    self.game.physics.arcade.collide(self.players[player].sprite, self.collision);
  });
};


Game.prototype._broadcastClientState = function(data) {
  var self = this;

  if (self.client) {
    self.ws.send(JSON.stringify({
      'type': 'move',
      'id': self.client.id,
      'position': {x: self.client.sprite.x, y: self.client.sprite.y},
      'keystate': self.client.keystate
    }));
  }
};

Game.prototype.applyMove = function(pid, position, keystate) {
  var self = this;
  if (pid in self.players) {
    self.players[pid].setPosition(position);
    self.players[pid].setKeystate(keystate);
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
        self._addPlayer(message.id, message.name, 'skelly-0.png',
          message.position, message.keystate);
          self.appendSessionMessage('[' + message.name + ' joined]')
        break;
      case 'move':
        var position = message.position,
            keystate = message.keystate,
            pid = message.id;
        self.applyMove(pid, position, keystate);
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
          self.appendSessionMessage('[' + player.name + ' left]')
          player.dispose();
          delete self.players[message.id];
        }
        break;
      case 'worldstate':
        // add players to the world
        var players = message.players;
        if (typeof players === 'object') {
          console.log('active users: ');
          Object.keys(players).forEach(function(name) {
            var player = players[name];
            console.log('\t' + name);
            self._addPlayer(player.id, name, 'skelly-0.png',
              player.position, player.keystate);
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
  //alert(name + 'clicked');
  alert('>implying this is implemented');
  // TODO ...
};

Game.prototype.appendSessionMessage = function(message) {
  var self = this;
  var textnode = document.createTextNode(message);
  var li = document.createElement("li");
  var span = document.createElement('span');
  span.className = 'session';
  span.appendChild(textnode);
  li.appendChild(span);
  self.messages.appendChild(li)
  // lock scroller to last message
  self.log.scrollTop = self.log.scrollHeight;
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
    // remove unnecessary whitespace
    message = message.replace(/^\s*|^\s$/gm, '');
    // enforce 300 char limit
    if (message.length >= 300) {
      // psssh, nothing personal kid
      message = message.substring(0, 300) + '...';
    }

    if (message !== '') {
      if (!self.requestingHandle) {
        // add message to chat log
        self.appendUserMessage(self.client.name, message);
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
    }

    // clear input field
    self.input.value = '';

  }, false);

};

