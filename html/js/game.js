'use strict';

function World(options) {
  // TODO...
};


function Player(id, name, sprite) {
  var self = this;

  self.id = id || undefined;
  self.name = name || undefined;
  self.keystate = 0;
  self.laststate = 0;
  self.lasttime = 0;
  self.position = {x: 0, y: 0};
  self.velocity = {x: 0, y: 0};
  self.sprite = sprite || null;

  console.log('created player: name='+name+', id='+id);
}

Player.prototype.update = function(dt) {
  var self = this;
  // extrapolate player position
  // TODO
};

Player.prototype.setPosition = function(position) {
  this.position = position;
};

Player.prototype.setVelocity = function(velocity) {
  this.velocity = velocity;
};

var LEFT_MASK  = 1,
    RIGHT_MASK = 1 << 1,
    UP_MASK    = 1 << 2,
    DOWN_MASK  = 1 << 3;

function Game(options) {
  var self = this;
  options = options || {};

  self.players = {};
  self.client = new Player();
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
  }

  var cursors,
      sprite;
  function create() {
	  self.game.world.setBounds(0, 0, 512, 300);
	  cursors = self.game.input.keyboard.createCursorKeys();

    self.client.sprite = self.game.add.sprite(
      self.game.world.centerX,
      self.game.world.centerY,
      'mushroom'
    );
    self.client.sprite.anchor.setTo(0.5, 0.5);
    self.client.sprite.scale.setTo(2.0, 2.0);
    self.client.sprite.smoothed = false;
  }


  var lastupdate = new Date().getTime();
  function update() {
    var time = new Date().getTime(),
        dt = time - lastupdate,
        lastupdate = time;
    self._updatePlayers(dt);
    self._updateClient(dt);
  }

  function render() {
    // game.debug.spriteInfo(sprite, 32, 32);
	  // game.debug.cameraInfo(game.camera, 32, 32);
  }

}

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

  var speed = 5.0;
  if (client.keystate & LEFT_MASK) {
    client.sprite.x -= speed;
  }
  if (client.keystate & RIGHT_MASK) {
    client.sprite.x += speed;
  }
  if (client.keystate & UP_MASK) {
    client.sprite.y -= speed;
  }
  if (client.keystate & DOWN_MASK) {
    client.sprite.y += speed;
  }

  if (client.keystate !== client.laststate) {
    // console.log('keystate: ' + client.keystate);
    client.laststate = client.keystate;
    // broadcast keystate, position, velocity
  }
};

Game.prototype._updatePlayers = function(dt) {
  var self = this;

  Object.keys(self.players).forEach(function(player) {
    // TODO ...
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
    // console.log('received: ' + event.data);
    var message = JSON.parse(event.data);
    switch (message.type) {
      case 'handle':

          self.client.id = message.id;
          self.client.name = message.name;
          self.requestingHandle = false;
          // console.log(self.handle.innerHTML);
          self.handle.innerHTML = message.name;
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
        //console.log('received message: ' + message.message);
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
