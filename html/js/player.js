'use strict';

function Player(id, name, sprite, position, keystate) {
  var self = this;

  self.id = id || undefined;
  self.name = name || undefined;
  self.keystate = 0;

  self.sprite = sprite;
  // physics body dimensions
  self.sprite.body.width = 8;
  self.sprite.body.height = 2;
  self.sprite.body.offset.x = 4;
  self.sprite.body.offset.y = 14;

  var position = position || {x: 0, y: 0};
  var velocity = velocity || {x: 0, y: 0};
  self.setPosition(position);
  self.setKeystate(keystate);

  // console.log('created player: name='+name+', id='+id
  //   +', position='+position + ', velocity=' + velocity);
}

Player.prototype.dispose = function() {
  var self = this;
  self.sprite.kill();
  // console.log(self.name + ' disconnected...');
};

Player.prototype.setPosition = function(position) {
  var self = this;
  self.sprite.x = position.x;
  self.sprite.y = position.y;
  // console.log('set ' + self.name + ' position');
};

Player.prototype.setKeystate = function(keystate) {
  var self = this;
  self.keystate = keystate;
  console.log('set keystate for ' + self.name + ': ' + self.keystate);
};

Player.prototype.setVelocity = function(velocity) {
  var self = this;
  self.sprite.body.velocity.x = velocity.x;
  self.sprite.body.velocity.y = velocity.y;
  // console.log('set ' + self.name + ' velocity');
};

Player.prototype.update = function() {
  var self = this;

  var speed = 150,
      vx = 0,
      vy = 0;
  if (self.keystate & Player.LEFT_MASK)  vx -= speed;
  if (self.keystate & Player.RIGHT_MASK) vx += speed;
  if (self.keystate & Player.UP_MASK)    vy -= speed;
  if (self.keystate & Player.DOWN_MASK)  vy += speed;
  self.sprite.body.velocity.x = vx; 
  self.sprite.body.velocity.y = vy; 

};

Player.prototype.setCameraFollow = function(game) {
  var self = this;

  game.camera.follow(self.sprite);

  var p = 0.2;
  var width = p*game.world.width,
      height = p*game.world.height;
  var pos = {
    x: game.world.centerX/2 - width/2 - self.sprite.width/2,
    y: game.world.centerY/2 - height/2 - self.sprite.height/2
  };

  game.camera.deadzone = new Phaser.Rectangle(pos.x, pos.y, width, height);
};

Player.LEFT_MASK  = 1;
Player.RIGHT_MASK = 1 << 1;
Player.UP_MASK    = 1 << 2;
Player.DOWN_MASK  = 1 << 3;
