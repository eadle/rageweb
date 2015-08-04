'use strict';

function Player(id, name, sprite, position, velocity) {
  var self = this;

  self.id = id || undefined;
  self.name = name || undefined;
  self.keystate = 0;
  self.sprite = sprite;
  self.position = position || {x: 0, y: 0};
  self.velocity = velocity || {x: 0, y: 0};

  console.log('created player: name='+name+', id='+id);
}

Player.prototype.dispose = function() {
  var self = this;
  if (self.sprite) {
    self.sprite.kill();
    // console.log('killed sprite');
  }
  // console.log(self.name + ' disconnected...');
};

Player.prototype.update = function(dt) {
  var self = this;
  if (self.velocity.x > 0) {
    self.sprite.scale.setTo(-2.0, 2.0);
  } else if (self.velocity.x < 0) {
    self.sprite.scale.setTo(2.0, 2.0);
  }
  self.position.x += dt*self.velocity.x; 
  self.position.y += dt*self.velocity.y;
  self.sprite.x = self.position.x;
  self.sprite.y = self.position.y;
};

Player.prototype.setPosition = function(position) {
  var self = this;
  if (self.sprite) {
    self.sprite.x = position.x;
    self.sprite.y = position.y;
  } else {
    console.log('player has no sprite???');
  }
  self.position = position;
  // console.log('set ' + self.name + ' position');
};

Player.prototype.setVelocity = function(velocity) {
  var self = this;
  self.velocity = velocity;
  // console.log('set ' + self.name + ' velocity');
};
