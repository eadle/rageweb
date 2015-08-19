'use strict';

Game.WIDTH = 512;
Game.HEIGHT = 256;
Game.ASPECT = Game.WIDTH/Game.HEIGHT;
Game.SERVER = 'ws://' + window.location.hostname + ':8188';
Game.DEBUGGING = false;

function Game(options) {
  var self = this;
  options = options || {};

  self._ws = null;
  self._chat = null;
  self._canvasElement = null;

  self._cursors = null;
  self._client = null;
  self._players = {};
  self._playerSpriteGroup = null;

  self._map = null;
  self._layers = [];
  self._worldCollision = null;
  self._physicsFactory = null;
  self._worldCollisionGroup = null;

  self._game = new Phaser.Game(Game.WIDTH, Game.HEIGHT, Phaser.CANVAS, 'phaser-example', {
    preload: function() {
      // FIXME -- there must be a way to get this internally through phaser
      self._canvasElement = document.getElementsByTagName('canvas')[0];
      // phaser settings
      self._game.antialias = false;
      self._game.stage.backgroundColor = '#222244';
      self._game.time.advancedTiming = Game.DEBUGGING;
      self._game.stage.disableVisibilityChange = true;
      // load assets
      self._game.load.script('webfont', '//ajax.googleapis.com/ajax/libs/webfont/1.4.7/webfont.js');
      self._game.load.atlas('thug-atlas', 'assets/images/thug1.png', 'assets/atlases/thug1.json');
      self._game.load.physics('thug-physics', 'assets/physics/thug1-physics.json');
      self._game.load.tilemap('subway-map', 'assets/maps/subway32.json',null, Phaser.Tilemap.TILED_JSON);
      self._game.load.image('subway', 'assets/images/subway32.png');
      // UI callbacks
      self._setupCanvasScaling();
      self._setupDispatchEvents();
    },
    create: function() {
      // connect to server and initialize chat
      self._setupServerConnection(Game.SERVER);
      self._chat = new Chat(self._game.parent);

      // create map and load tile layers
      self._map = self._game.add.tilemap('subway-map');
      self._map.addTilesetImage('subway');
      for (var ii = 0; ii < self._map.layers.length; ii++) {
        var layer = self._map.createLayer(self._map.layers[ii].name);
        layer.resizeWorld();  // FIXME
        self._layers.push(layer);
      }

      // start physics system
      self._game.physics.startSystem(Phaser.Physics.P2JS);
      self._game.physics.p2.useElapsedTime = true;

      // create collision groups
      self._game.physics.p2.updateBoundsCollisionGroup();
      self._worldCollisionGroup = self._game.physics.p2.createCollisionGroup();
      self._playerCollisionGroup = self._game.physics.p2.createCollisionGroup();

      // setup physics factory
      self._physicsFactory = new PhysicsFactory(self._game);
      self._physicsFactory.addKey('thug', 'thug-atlas', 'thug-physics');

      // add collision layer to physics world
      self._worldCollision = self._game.physics.p2.convertCollisionObjects(self._map, 'collision');
      for (var ii = 0; ii < self._worldCollision.length; ii++) {
        self._worldCollision[ii].debug = Game.DEBUGGING;
        self._worldCollision[ii].setCollisionGroup(self._worldCollisionGroup);
        self._worldCollision[ii].collides([self._playerCollisionGroup]);
      }   

      // player sprite group and cursor input
      self._playerSpriteGroup = self._game.add.group();
      self._cursors = self._game.input.keyboard.createCursorKeys();

      // resize chat
      self._resizeChat();
    },
    update: function() {
      var time = new Date().getTime();
      self._updatePlayers(time);
      if (self._client) {
        self._updateClient(time);
      }
      self._playerSpriteGroup.sort('z', Phaser.Group.SORT_ASCENDING);
    },
    render: function() {
      if (Game.DEBUGGING) {
        // show frames per second
        self._game.debug.text(self._game.time.fps || '--', 2, 14, "#00ff00");
        if (self._client) {
          // debugging camera deadzone
          var zone = self._game.camera.deadzone;
          self._game.context.fillStyle = 'rgba(255,0,0,0.6)';
          self._game.context.fillRect(zone.x, zone.y, zone.width, zone.height);
        } 
      }
    }
  });

}

Game.prototype._setupCanvasScaling = function() {
  var self = this;

  self._game.scale.minWidth  = Game.WIDTH;
  self._game.scale.minHeight = Game.HEIGHT;
  self._game.scale.maxWidth  = 2*Game.WIDTH;
  self._game.scale.maxHeight = 2*Game.HEIGHT;
  self._game.scale.pageAlignHorizontally = true;
  self._game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;

  window.onresize = function() {
    self._resizeChat();
  };

};

Game.prototype._resizeChat = function() {
  var self = this;
  var width = (window.innerWidth > 2*Game.WIDTH) ? 2*Game.WIDTH :
    (window.innerWidth < Game.WIDTH) ? Game.WIDTH : window.innerWidth;
  self._chat.resize(width/Game.ASPECT);
};

/* An ugly function to make the game pretty. */
Game.prototype._setupDispatchEvents = function() {
  var self = this;
  // on lost focus
  self._game.onBlur.dispatch = function() {
    self._chat.loseFocus();
    if (self._client) {
      self._clearClientKeystate();
    }   
  };
  // on gained focus
  self._game.onFocus.dispatch = function() {
    self._chat.gainFocus();
  };
  // on game resize
  self._game.scale.onSizeChange.dispatch = function() {
    self._canvasElement.style.cssText =
     'display: block;' +
     'width: ' + self._game.scale.width + 'px;' +
     'height: ' + self._game.scale.height + 'px;' +
     'cursor: inherit;' +
     'margin-left: 0px;';
    if (self._game.scale.width%Game.WIDTH === 0) {
      self._canvasElement.style.cssText +=
       '-ms-interpolation-mode: nearest-neighbor;' +
       'image-rendering: -moz-crisp-edges;' +
       'image-rendering: -o-crisp-edges;' +
       'image-rendering: -webkit-optimize-contrast;' +
       'image-rendering: optimize-contrast;' +
       'image-rendering: crisp-edges;' + 
       'image-rendering: pixelated;';
    }
  };
};

Game.prototype.send = function(message) {
  var self = this;  
  if (1 == self._ws.readyState) { // FIXME
    self._ws.send(JSON.stringify(message));
  }
};

Game.prototype.selectCanvas = function() {
  var self = this;
  self._canvasElement.click();
};

Game.prototype._setupServerConnection = function(server) {
  var self = this;

  self._ws = new WebSocket(server);

  self._ws.onmessage = function(event) {
    //console.log('received: ' + event.data);
    var message = JSON.parse(event.data);
    switch (message.type) {
      case 'handle':
        self._addClient(message);
        break;
      case 'player':
        self._addPlayer(message);
        break;
      case 'state':
        var pid = message.id,
            position = message.position,
            state = message.state;
        self._applyStateChange(pid, position, state);
        break;
      case 'chat':
        var pid = message.id;
        if (pid in self._players) {
          var name = self._players[pid].getName(),
              message = message.message;
          self._chat.appendUserMessage(name, message);
        }
        break;
      case 'disconnect':
        var player = self._players[message.id];
        if (player) {
          self._chat.appendSessionMessage('['+player.getName()+' left]');
          player.destroy();
          delete self._players[message.id];
        }
        break;
      case 'worldstate':
        // add players to the world
        var players = message.players;
        if (typeof players === 'object') {
          Object.keys(players).forEach(function(name) {
            var player = players[name];
            player.name = name;
            self._addPlayer(player);
          });
        }
        break;
      case 'error':
        console.log(event.data);
        self._chat.setHandleField(message.error);
        self._chat.selectInput();
        break;
      default:
    }
  };
  self._ws.onopen = function() {
    console.log('connected to server');
  };
  self._ws.onclose = function() {
    console.log('disconnected to server');
  };
  self._ws.onerror = function(err) {
    throw err;
  };

};

Game.prototype._addPlayer = function(player) {
  var self = this;
  self._players[player.id] = new Player(self._game, self._playerSpriteGroup, {
    id: player.id,
    name: player.name,
    position: player.position,
    state: player.state,
    debug: Game.DEBUGGING,
    bodies: self._physicsFactory.buildBodies('thug'),
    playerCollisionGroup: self._playerCollisionGroup,
    worldCollisionGroup: self._worldCollisionGroup
  });
  self._chat.appendSessionMessage('['+player.name+' joined]');
};


Game.prototype._applyStateChange = function(pid, position, state) {
  var self = this;
  if (pid in self._players) {
    self._players[pid].setPosition(position);
    self._players[pid].setState(state);
  }
};

Game.prototype._updatePlayers = function(time) {
  var self = this;
  Object.keys(self._players).forEach(function(id) {
    var player = self._players[id];
    player.update(time);
  });
};

Game.prototype._addClient = function(client) {
  var self = this;
  self._client = new Player(self._game, self._playerSpriteGroup, {
    id: client.id,
    name: client.name,
    position: Player.START_POS,
    state: Player.IDLE,
    textFill: '#00FF00',
    debug: Game.DEBUGGING,
    bodies: self._physicsFactory.buildBodies('thug'),
    playerCollisionGroup: self._playerCollisionGroup,
    worldCollisionGroup: self._worldCollisionGroup
  });
  self._client.cameraFollow(self._game);
  self._chat.setName(client.name);
  self._broadcastClientState();
};

Game.prototype._clearClientKeystate = function() {
  var self = this;
  if (0 !== self._client.getKeystate()) {
    self._client.setKeystate(0);
    self._broadcastClientState();
  }
};

Game.prototype._broadcastClientState = function() {
  var self = this;
  if (self._client) {
    self.send({
      'type': 'state',
      'id': self._client.id,
      'position': self._client.getPosition(),
      'state': self._client.getState()
    });
  }
};

Game.prototype._updateClient = function(time) {
  var self = this;

  if (!self._chat.isSelected()) {
    var keystate = 0;
    if (self._selectInputPressed()) {
      self._clearClientKeystate();
      self._chat.selectInput();
    } else if (self._game.input.keyboard.isDown(Phaser.Keyboard.P)) {
      self._client.punch();
    } else if (self._game.input.keyboard.isDown(Phaser.Keyboard.O)) {
      self._client.hit(5);
    } else {
      if (self._client.canMove()) {
        if (self._leftPressed())  keystate |= Player.LEFT_PRESSED;
        if (self._rightPressed()) keystate |= Player.RIGHT_PRESSED;
        if (self._upPressed())    keystate |= Player.UP_PRESSED;
        if (self._downPressed())  keystate |= Player.DOWN_PRESSED;
        self._client.setKeystate(keystate);
      }
    }
  }

  self._client.update(time);
  if (self._client.changed()) {
    self._broadcastClientState();
  }

};

Game.prototype._selectInputPressed = function() {
  var self = this;
  return self._game.input.keyboard.isDown(Phaser.Keyboard.T);
};

Game.prototype._leftPressed = function() {
  var self = this;
  return self._cursors.left.isDown
    || self._game.input.keyboard.isDown(Phaser.Keyboard.H);
}

Game.prototype._rightPressed = function() {
  var self = this;
  return self._cursors.right.isDown
    || self._game.input.keyboard.isDown(Phaser.Keyboard.L);
}

Game.prototype._upPressed = function() {
  var self = this;
  return self._cursors.up.isDown
    || self._game.input.keyboard.isDown(Phaser.Keyboard.K);
}

Game.prototype._downPressed = function() {
  var self = this;
  return self._cursors.down.isDown
    || self._game.input.keyboard.isDown(Phaser.Keyboard.J);
}
