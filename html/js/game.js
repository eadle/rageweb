'use strict';

var LEFT_MASK  = 1,
    RIGHT_MASK = 1 << 1,
    UP_MASK    = 1 << 2,
    DOWN_MASK  = 1 << 3;

function Game(options) {
  var self = this;
  options = options || {};

  self.players = {};
  self.client = new Player();
  self.lastupdate = -1;
  self.ws = null;

  // connect to server
  var server = 'ws://167.114.185.203:8188';
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
  self.game = new Phaser.Game(512, 300, Phaser.CANVAS, 'phaser-example', {
    preload: preload, create: create, update: update, render: render
  });

  // preload function
  function preload() {
	  self.game.stage.backgroundColor = '#007236';
	  self.game.load.image('mushroom', 'assets/sprites/mushroom.png');
    self._setupClientCallbacks();
    self.lasttime = self.game.time.now;

    self.game.stage.disableVisibilityChange = true;
  }

  var cursors;
  function create() {
	  self.game.world.setBounds(0, 0, 512, 300);
	  cursors = self.game.input.keyboard.createCursorKeys();

    var pos = {x: self.game.world.centerX, y: self.game.world.centerY};
    self.client.sprite = self._createPlayerSprite(pos);
  }


  function update() {
    var now = self.game.time.now; 
    var dt = now - self.lasttime;

    self._updatePlayers(dt);
    self._updateClient(dt);

    self.lasttime = now;
  }

  function render() {
    // game.debug.spriteInfo(sprite, 32, 32);
	  // game.debug.cameraInfo(game.camera, 32, 32);
  }

}

Game.prototype._createPlayerSprite = function() {
  var self = this;

  var sprite = self.game.add.sprite(
    self.game.world.centerX,
    self.game.world.centerY,
    'mushroom'
  );
  sprite.anchor.setTo(0.5, 0.5);
  sprite.scale.setTo(2.0, 2.0);
  sprite.smoothed = false;

  return sprite;
};

Game.prototype._setupClientCallbacks = function() {
  var self = this;

  // moving
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

  // jump
  // TODO

  // talk
  // TODO

};

Game.prototype._updateClient = function(dt) {
  var self = this,
      client = self.client;

  var speed = 0.5;

  // modify velocity based on keystate
  client.velocity.x = 0;
  client.velocity.y = 0;
  if (client.keystate & LEFT_MASK)  client.velocity.x -= speed;
  if (client.keystate & RIGHT_MASK) client.velocity.x += speed;
  if (client.keystate & UP_MASK)    client.velocity.y -= speed;
  if (client.keystate & DOWN_MASK)  client.velocity.y += speed;

  client.position.x += dt*client.velocity.x;
  client.position.y += dt*client.velocity.y;
  client.sprite.x = client.position.x;
  client.sprite.y = client.position.y;

  if (client.keystate !== client.laststate) {
    client.lasttime = self.game.time.now;
    client.laststate = client.keystate;
    // send move message
    self.ws.send(JSON.stringify({
      'type': 'move',
      'id': client.id,
      'position': client.position,
      'velocity': client.velocity,
      'time': client.lastime
    }));
  }
};

Game.prototype._updatePlayers = function(dt) {
  var self = this;
  Object.keys(self.players).forEach(function(player) {
    self.players[player].update(dt);
  });
};

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
        li.innerHTML = '<a class="user" onclick=\'alert("clicked")\'>&lt'
          + self.client.name + '&gt&nbsp</a>';
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
    //console.log('received: ' + event.data);
    var message = JSON.parse(event.data);
    switch (message.type) {
      case 'handle':
          self.client.id = message.id;
          self.client.name = message.name;
          self.requestingHandle = false;
          self.handle.innerHTML = message.name;
        break;
      case 'player':
        var playerSprite = self._createPlayerSprite();
        self.players[message.id] = new Player(message.id, message.name, playerSprite);
        break;
      case 'move':
        var position = message.position,
            velocity = message.velocity,
            pid = message.id;
        self.applyMove(pid, position, velocity);
        break;
      case 'jump':
        var pid = message.id;
        self.applyJump(pid); // TODO
        break;
      case 'chat':
        var pid = message.id;
        //console.log('received message: ' + message.message);
        self.appendChatMessage(pid, message.message);
        break;
      case 'special':
        self.applySpecial();
        break;
      case 'disconnect':
        var player = self.players[message.id];
        if (player) {
          player.dispose();
          delete self.players[message.id];
        }
        break;
      case 'worldstate':
        // iterate over all players
        var players = message.players;
        if (typeof players === 'object') {
          console.log('adding all players');
          Object.keys(players).forEach(function(name) {
            var pid = players[name];
            var playerSprite = self._createPlayerSprite();
            self.players[pid] = new Player(pid, name, playerSprite);
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

Game.prototype.applyMove = function(pid, position, velocity) {
  var self = this;
  self.players[pid].setPosition(position);
  self.players[pid].setVelocity(velocity);
};

Game.prototype.appendChatMessage = function(pid, message) {
  var self = this;

  // console.log('appendChatMessage: pid=' + pid + ', message=' + message);
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
