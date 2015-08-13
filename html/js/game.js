'use strict';

Game.WIDTH = 512;
Game.HEIGHT = 256;
Game.SERVER = 'ws://' + window.location.hostname + ':8188';
Game.DEBUGGING = true;

function Game(options) {
  var self = this;
  options = options || {};

  self._ws = null;
  self._chat = null;

  self._cursors = null;
  self._client = null;
  self._players = {};
  self._playerGroup = null;

  self._map = null;
  self._layers = [];
  self._collision = null;

  self._game = new Phaser.Game(Game.WIDTH, Game.HEIGHT, Phaser.CANVAS, 'phaser-example', {
    preload: function() {
      if (Game.DEBUGGING) {
        // enable fps debugging
        self._game.time.advancedTiming = true;
      }
      // set background color
      self._game.stage.backgroundColor = '#222244';
      // use notifications on blur
      self._game.stage.disableVisibilityChange = false;
      self._game.onFocus.dispatch = function() {
        self._chat.gainFocus();
      };
      self._game.onBlur.dispatch = function() {
        self._chat.loseFocus();
        if (self._client) {
          self._clearClientKeystate();
        }   
      };
      // load maps
      self._game.load.tilemap('subway-map', 'assets/maps/subway32.json',null, Phaser.Tilemap.TILED_JSON);
      // load atlases
      self._game.load.atlas('thug1', 'assets/images/thug1.png', 'assets/atlases/thug1.json');
      // load images that weren't loaded by atlases
      self._game.load.image('subway', 'assets/images/subway32.png');

      // canvas scaling
      self._game.scale.maxWidth = 2*Game.WIDTH;
      self._game.scale.maxHeight = 2*Game.HEIGHT;
      self._game.scale.pageAlignHorizontally = true;
      self._game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;

    },
    create: function() {

      // connect to server
      self._setupServerConnection(Game.SERVER);
      // initialize chat
      self._chat = new Chat();
      // start physics system
      self._game.physics.startSystem(Phaser.Physics.P2JS, {useElapsedTime: true});
      self._game.physics.p2.useElapsedTime = true;
      // prepare user input
      self._cursors = self._game.input.keyboard.createCursorKeys();

      // create map
      self._map = self._game.add.tilemap('subway-map');
      self._map.addTilesetImage('subway');
      // add tile layers from back to front
      for (var ii = 0; ii < self._map.layers.length; ii++) {
        // console.log(self._map.layers[ii]);
        var layer = self._map.createLayer(self._map.layers[ii].name);
        // layer.fixedToCamera = false;
        layer.smoothed = false;
        layer.resizeWorld();
        self._layers.push(layer);
      }
      // add collision layer to physics world
      self._collision = self._game.physics.p2.convertCollisionObjects(self._map, 'collision');
      // physics world debugging
      if (Game.DEBUGGING) {
        for (var ii = 0; ii < self._collision.length; ii++) {
          self._collision[ii].debug = true;
        }   
      }
      // players in their own group
      self._playerGroup = self._game.add.group();

    },
    update: function() {
      var time = new Date().getTime();
      self._updatePlayers(time);
      if (self._client) {
        self._updateClient(time);
      }
      // sort player sprites on y-axis
      self._playerGroup.sort('z', Phaser.Group.SORT_ASCENDING);
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

Game.prototype.send = function(message) {
  var self = this;  
  if (1 == self._ws.readyState) {
    self._ws.send(JSON.stringify(message));
  }
};

Game.prototype.selectCanvas = function() {
  var self = this;
  // FIXME why is phaser so retarded?
  document.getElementsByTagName('canvas')[0].click();
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

Game.prototype._addClient = function(client) {
  var self = this;
  
  self._client = new Player(self._game, self._playerGroup, {
    id: client.id,
    name: client.name,
    position: Player.START_POS,
    state: Player.IDLE,
    debug: Game.DEBUGGING
  });

  self._client.cameraFollow(self._game);
  self._chat.setName(client.name);
  self._broadcastClientState();
};

Game.prototype._addPlayer = function(player) {
  var self = this;

  self._players[player.id] = new Player(self._game, self._playerGroup, {
    id: player.id,
    name: player.name,
    position: player.position,
    state: player.state,
    debug: Game.DEBUGGING
  });

  self._chat.appendSessionMessage('['+player.name+' joined]');
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

  // var state = self._client.getState();
  // console.log('state: ' + state);
  // self._client.debugState(state);

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
    if (self._game.input.keyboard.isDown(Phaser.Keyboard.T)) {
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


