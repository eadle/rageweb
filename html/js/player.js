'use strict';

function Player(id, name, sprite, position, velocity) {
  var self = this;

  self.id = id || undefined;
  self.name = name || undefined;
  self.keystate = 0;
  self.sprite = sprite;

  self.sprite.body.width = 8;
  self.sprite.body.height = 2;
  self.sprite.body.offset.x = 4;
  self.sprite.body.offset.y = 14;
  

  var position = position || {x: 0, y: 0};
  var velocity = velocity || {x: 0, y: 0};
  self.setPosition(position);
  self.setVelocity(velocity);

  console.log('created player: name='+name+', id='+id
    +', position='+position + ', velocity=' + velocity);
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

Player.prototype.setVelocity = function(velocity) {
  var self = this;
  self.sprite.body.velocity.x = velocity.x;
  self.sprite.body.velocity.y = velocity.y;
  // console.log('set ' + self.name + ' velocity');
};
