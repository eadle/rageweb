'use strict';

function Player(game, group, options) {
  var self = this;
  options = options || {};

  if (typeof game !== 'object') {
    throw new Error('Player expects valid game context');
    return null;
  }

  if (typeof group !== 'object') {
    throw new Error('Player expects valid game group');
    return null;
  }

  self._id = (typeof options.id === 'string') ? options.id : undefined;
  self._name = (typeof options.name === 'string') ? options.name : undefined;

  self._state = Player.IDLING;
  self._keystate = (typeof options.keystate === 'number') ? options.keystate : 0;
  self.setKeystate(self._keystate);

  var position = (typeof options.position === 'object') ? options.position : Player.START_POS;

  self._debug = (typeof options.debug === 'boolean') ? options.debug : false;

  // damage variables
  self._damage  = 0;
  self._hitTime = 0;
  self._yAtHit  = 0;
  self._punchTime = 0;

  // current animation
  self._animation = null;

  // FIXME Player should be base class
  var idle = [
    'thug1-idle-0.png',
    'thug1-idle-1.png',
    'thug1-idle-2.png',
    'thug1-idle-1.png'
  ];

  var walk = [
    'thug1-walk-0.png',
    'thug1-walk-1.png',
    'thug1-walk-2.png',
    'thug1-walk-1.png'
  ];

  var punch = [
    'thug1-punch.png'
  ];

  var headbutt = [
    'thug1-headbutt-0.png',
    'thug1-headbutt-1.png',
    'thug1-headbutt-2.png'
  ];

  var hit = [
    'thug1-hit-0.png'
  ];

  var falling = [
    'thug1-hit-1.png'
  ];

  var recover = [
    'thug1-recover-0.png',
    'thug1-recover-1.png',
    'thug1-recover-2.png'
  ];

  // player sprite and animations
  self._sprite = new Phaser.Sprite(game, position.x, position.y, 'thug1', idle[0]);
  self._sprite.animations.add('idle', idle);
  self._sprite.animations.add('walk', walk);
  self._sprite.animations.add('punch', punch);
  self._sprite.animations.add('headbutt', headbutt);
  self._sprite.animations.add('hit', hit);
  self._sprite.animations.add('falling', falling);
  self._sprite.animations.add('recover', recover);
  self._sprite.anchor.setTo(0.5, 1.0);
  self._sprite.smoothed = false;
  group.add(self._sprite);

  // shadow only used when falling
  self._shadow = new Phaser.Sprite(game, position.x, position.y, 'thug1', 'thug1-shadow.png');
  self._shadow.anchor.setTo(0.5, 1.0);
  self._shadow.smoothed = false;
  self._shadow.visible = false;
  group.add(self._shadow);

  // capsule can have same dimensions as shadow
  var radius = self._shadow.height/1.5;
  self._yOffset = radius/2;
  self._body = new Phaser.Physics.P2.Body(game, null, position.x, position.y, 1);
  self._body.addCircle(radius);
  self._body.debug = self._debug;
  // enable physics body
  game.physics.p2.addBody(self._body);

  self._setNextState();
}

Player.prototype.destroy = function() {
  var self = this;
  self._body.destroy();
  self._shadow.destroy();
  self._sprite.destroy();
};

Player.prototype.getName = function() {
  return this._name;
};

Player.prototype.getPosition = function() {
  return {x: this._body.x, y: this._body.y};
};

Player.prototype.getKeystate = function() {
  return this._keystate;
};

Player.prototype.setPosition = function(position) {
  var self = this;
  self._body.x = position.x;
  self._body.y = position.y;
  self._lockSpritesToBody();
};

Player.prototype.setKeystate = function(keystate) {
  var self = this;

  if (keystate !== self._keystate) {
    //console.log('setting keystate: keystate=' + keystate);
    self._keystate = keystate;
    // TODO attacking
    // ...
    // TODO jumping
    // ...
    // FIXME can't be walking if attacking or jumping
    if (self._state & Player.CAN_MOVE) {
      self._setNextState();
    }
  };

};

Player.prototype._lockSpritesToBody = function() {
  var self = this;


  // lock shadow to body
  self._shadow.x = self._body.x;
  self._shadow.y = self._body.y + self._yOffset;
  self._shadow.z = self._shadow.y;

  // lock sprite to body
  self._sprite.x = self._body.x;
  if (self._state !== Player.FALLING) {
    self._sprite.y = self._shadow.y;
  }
  self._sprite.z = self._shadow.y;

  // while we're debugging
  if (self._debug) {
    self._body.debugBody.x = self._body.x;
    self._body.debugBody.y = self._body.y;
    self._body.debugBody.rotation = self._body.rotation;
  }
};

Player.prototype.update = function(time) {
  var self = this;

  // clear velocity
  self._body.velocity.x = 0;
  self._body.velocity.y = 0;

  switch (self._state) {
    case Player.WALKING:
      var hSpeed = Player.MAX_SPEED,
          vSpeed = Player.MAX_SPEED/2;
      if (self._keystate & Player.LEFT_PRESSED)  self._body.moveLeft(hSpeed);
      if (self._keystate & Player.RIGHT_PRESSED) self._body.moveRight(hSpeed);
      if (self._keystate & Player.UP_PRESSED)    self._body.moveUp(vSpeed);
      if (self._keystate & Player.DOWN_PRESSED)  self._body.moveDown(vSpeed);
      break;
    case Player.HIT:
      var dt = time - self._hitTime;
      // console.log('time=' + time + ', hittime= ' + self._hitTime + ', dt=' + dt);
      if (dt >= Player.HIT_TIME) {
        self._setNextState();
      }
      break;
    case Player.FALLING:
      var t = (time - self._hitTime)/1000,
          v0y = -200,
          g = 500;
      self._sprite.y = self._yAtHit + v0y*t + 0.5*g*t*t;
      self._sprite.z = self._shadow.y;
      // if falling animation has completed
      if (self._sprite.y > self._yAtHit) {
        // start recovering
        self._sprite.y = self._yAtHit;
        self._damage = 0;
        self._setRecover();
        self._shadow.visible = false;
      }
      break;
    case Player.RECOVERING:
      if (!self._animation.isPlaying) {
        self._setNextState();
      }
      break;
    case Player.PUNCHING:
      var dt = time  - self._punchTime;
      if (dt >= Player.PUNCH_TIME) {
        self._setNextState();
      }
      break;
    case Player.HEADBUTTING:
      console.log('WARN: headbutting not implemented');
      break;
    case Player.JUMPING:
      console.log('WARN: jumping not implemented');
      break;
    default:
  };

  self._lockSpritesToBody();
};

Player.prototype.punch = function() {
  var self = this;
  if (self._state & Player.CAN_PUNCH) {
    self._punchTime = new Date().getTime();
    self._setPunch();
  }
};

Player.prototype.hit = function(damage) {
  var self = this;
  if (self._state & Player.CAN_HIT) {
    self._hitTime = new Date().getTime();
    self._damage += damage;
    self._setHit();
  }
};

Player.prototype._faceLeft = function() {
  this._sprite.scale.x = -1.0;
};

Player.prototype._faceRight = function() {
  this._sprite.scale.x = 1.0;
};

Player.prototype._setNextState = function() {
  var self = this;
  if (self._movingHorizontally() || self._movingVertically()) {
    self._setWalk();
  } else {
    self._setIdle();
  }
};

Player.prototype._setWalk = function() {
  var self = this;
  self._state = Player.WALKING;
  // face sprite in moving direction
  if (self._keystate & Player.LEFT_PRESSED) {
    self._faceLeft();
  } else if (self._keystate & Player.RIGHT_PRESSED) {
    self._faceRight();
  }
  self._setAnimation('walk', 10);
};

Player.prototype._setIdle = function() {
  var self = this;
  self._state = Player.IDLING;
  self._setAnimation('idle', 6);
};

Player.prototype._setPunch = function() {
  var self = this;
  self._state = Player.PUNCHING;
  self._setAnimation('punch', 1, false);
};

Player.prototype._setHit = function() {
  var self = this;

  if (self._damage < Player.MAX_DAMAGE) {
    self._state = Player.HIT;
    self._sprite.animations.play('hit', 1, false);
  } else {
    self._yAtHit = self._sprite.y;
    self._state = Player.FALLING;
    self._sprite.animations.play('falling', 1, false);
    self._shadow.visible = true;
  }
};

Player.prototype._setRecover = function() {
  var self = this;
  self._state = Player.RECOVERING;
  self._setAnimation('recover', 4, false);
};

Player.prototype._setAnimation = function(animation, fps, loop) {
  var self = this;
  loop = (typeof loop === 'boolean') ? loop : true;
  fps = (typeof fps === 'number') ? fps : 12;
  self._animation = self._sprite.animations.play(animation, fps, loop);
};

Player.prototype._movingHorizontally = function() {
  var self = this;
  var left = self._keystate & Player.LEFT_PRESSED,
      right = self._keystate & Player.RIGHT_PRESSED;
  return (left && !right) || (!left && right);
};

Player.prototype._movingVertically = function() {
  var self = this;
  var up = self._keystate & Player.UP_PRESSED,
      down = self._keystate & Player.DOWN_PRESSED;
  return (up && !down) || (!up && down);
};

// player key states
Player.LEFT_PRESSED  = 1;
Player.RIGHT_PRESSED = 1 << 1;
Player.UP_PRESSED    = 1 << 2;
Player.DOWN_PRESSED  = 1 << 3;
// player game states
Player.IDLING        = 1 << 4;
Player.WALKING       = 1 << 5;
Player.JUMPING       = 1 << 6
Player.PUNCHIING     = 1 << 7;
Player.HEADBUTTING   = 1 << 8;
Player.HIT           = 1 << 9;
Player.FALLING       = 1 << 10
Player.RECOVERING    = 1 << 11;
// other shared attributes
Player.MAX_SPEED = 150;
Player.MAX_DAMAGE = 20;
Player.HIT_TIME = 200;   // ms
Player.PUNCH_TIME = 200; // ms
Player.CAN_MOVE = Player.IDLING | Player.WALKING;
Player.CAN_HIT = ~(Player.HIT | Player.FALLING | Player.RECOVERING);
Player.CAN_PUNCH = Player.CAN_HIT;
// temporary
Player.START_POS = {x: 256, y: 220};
