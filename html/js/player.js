'use strict';

// player key states
Player.LEFT_PRESSED  = 1;
Player.RIGHT_PRESSED = 1 << 1;
Player.UP_PRESSED    = 1 << 2;
Player.DOWN_PRESSED  = 1 << 3;
// player game states
Player.IDLE     = 1 << 4;
Player.WALK     = 1 << 5;
Player.JUMP     = 1 << 6
Player.PUNCH    = 1 << 7;
Player.HEADBUTT = 1 << 8;
Player.HIT      = 1 << 9;
Player.FALL     = 1 << 10
Player.RECOVER  = 1 << 11;
// bit masks
Player.KEYSTATE_MASK = 0x0F;
Player.STATE_MASK = 0xFF0;
Player.FACING_LEFT = 1 << 12;
// other shared attributes
Player.MAX_SPEED  = 180;
Player.MAX_DAMAGE = 15;
Player.HIT_TIME   = 200; // ms
Player.PUNCH_TIME = 50; // ms
Player.CAN_MOVE   = Player.IDLE | Player.WALK;
Player.CAN_HIT    = ~(Player.HIT | Player.FALL | Player.RECOVER);
Player.CAN_PUNCH  = Player.CAN_HIT;
Player.START_POS  = {x: 256, y: 220}; // temp

function Player(game, options) {
  var self = this;
  options = options || {};

  if (typeof game !== 'object') {
    throw new Error('Player expects valid game context');
    return null;
  }
  self._game = game;

  self._id = (typeof options.id === 'string') ? options.id : undefined;
  self._name = (typeof options.name === 'string') ? options.name : '???';
  self._debug = (typeof options.debug === 'boolean') ? options.debug : false;
  var position = (typeof options.position === 'object') ? options.position : Player.START_POS;

  self._damage  = 0;
  self._hitTime = 0;
  self._yAtHit  = 0;
  self._punchTime = 0;
  self._animation = null;

  // FIXME Player should be base class
  var idle = [
    'thug1-idle-0',
    'thug1-idle-1',
    'thug1-idle-2',
    'thug1-idle-1'
  ];
  var walk = [
    'thug1-walk-0',
    'thug1-walk-1',
    'thug1-walk-2',
    'thug1-walk-1'
  ];
  var punch = [
    'thug1-punch'
  ];
  var headbutt = [
    'thug1-headbutt-0',
    'thug1-headbutt-1',
    'thug1-headbutt-2'
  ];
  var hit = [
    'thug1-hit-0'
  ];
  var falling = [
    'thug1-hit-1'
  ];
  var recover = [
    'thug1-recover-0',
    'thug1-recover-1',
    'thug1-recover-2'
  ];

  // player name should be above sprite
  self._textYOffset = -88;
  self._text = new Phaser.Text(game, position.x, position.y + self._textYOffset, self._name);
  self._text.smoothed = false;
  self._text.font = 'Press Start 2P';
  self._text.fontSize = '8px';
  self._text.fontWeight = 'normal';
  self._text.fill = (typeof options.textFill === 'string') ? options.textFill : '#FF0000';
  self._text.stroke = '#000000';
  self._text.strokeThickness = 2;
  self._text.anchor.setTo(0.5, 0.0);
  // shadow only used when falling
  self._shadow = new Phaser.Sprite(game, position.x, position.y, 'thug-atlas', 'thug1-shadow');
  self._shadow.anchor.setTo(0.5, 1.0);
  self._shadow.visible = false;
  self._shadow.smoothed = false;
  // player sprite and animations
  self._lastFrame = idle[0];
  self._sprite = new Phaser.Sprite(game, position.x, position.y, 'thug-atlas', self._lastFrame);
  self._sprite.animations.add('idle', idle);
  self._sprite.animations.add('walk', walk);
  self._sprite.animations.add('punch', punch);
  self._sprite.animations.add('headbutt', headbutt);
  self._sprite.animations.add('hit', hit);
  self._sprite.animations.add('falling', falling);
  self._sprite.animations.add('recover', recover);
  self._sprite.anchor.setTo(0.5, 1.0);
  self._sprite.smoothed = false;
  // add graphics to sprite group
  if (typeof options.spriteGroup === 'object') {
    var spriteGroup = options.spriteGroup;
    spriteGroup.add(self._text);
    spriteGroup.add(self._shadow);
    spriteGroup.add(self._sprite);
  }

  // setup collision bodies
  self._collisionConfig = options.collisionConfig;
  self._collisionBodies = self._collisionConfig.bodies;
  Object.keys(self._collisionBodies).forEach(function(key) {
    var leftBody = self._collisionBodies[key].left,
        rightBody = self._collisionBodies[key].right,
        categoryBits = self._collisionBodies[key].categoryBits;
    // custom properties
    leftBody.player = self;
    rightBody.player = self;
    leftBody.categoryBits = categoryBits;
    rightBody.categoryBits = categoryBits;
    // normal properties
    leftBody.fixedRotation = true;
    rightBody.fixedRotation = true;
    leftBody.clearCollision();
    rightBody.clearCollision();
    game.physics.p2.addBody(leftBody);
    game.physics.p2.addBody(rightBody);
  });
  self._activeBody = self._collisionBodies[idle[0]].right;
  self._activeBody.debug = self._debug;

  // capsule can have same dimensions as shadow
  var radius = self._shadow.height/1.5;
  self._yOffset = radius/2;
  self._worldBody = new Phaser.Physics.P2.Body(game, null, position.x, position.y, 1);
  self._worldBody.addCircle(radius);
  self._worldBody.debug = self._debug;
  game.physics.p2.addBody(self._worldBody);

  if (typeof options.worldCollisionGroup === 'object' && typeof options.playerCollisionGroup === 'object') {
    var worldCollisionGroup = options.worldCollisionGroup;
    var playerCollisionGroup = options.playerCollisionGroup;
    self._worldBody.setCollisionGroup(playerCollisionGroup);
    self._worldBody.collides([worldCollisionGroup]);
  }

  self._state = 0;
  self._keystate = 0;
  self._direction = 0;
  if (typeof options.state === 'number') {
    self.setState(options.state);
  }
  self._lastDirection = self._direction;
  self._lastKeystate = self._keystate;
  self._lastState = self._state;
}

Player.prototype.cameraFollow = function(game) {
  var self = this;
  game.camera.follow(self._sprite);
  var width = 0.5*game.camera.width,
      height = game.camera.height;
  var pos = {x: (game.camera.width - width)/2, y: 0};
  game.camera.deadzone = new Phaser.Rectangle(pos.x, pos.y, width, height);
};

Player.prototype.destroy = function() {
  var self = this;

  self._worldBody.destroy();
  self._shadow.destroy();
  self._sprite.destroy();
  self._text.destroy();

  // destroy collision bodies
  Object.keys(self._collisionBodies).forEach(function(key) {
    self._collisionBodies[key].right.destroy();
    self._collisionBodies[key].left.destroy();
    delete self._collisionBodies[key];
  });

};

Player.prototype.getName = function() {
  return this._name;
};

Player.prototype.getPosition = function() {
  return {x: this._worldBody.x, y: this._worldBody.y};
};

Player.prototype.getKeystate = function() {
  return this._keystate;
};

Player.prototype.setPosition = function(position) {
  var self = this;
  self._worldBody.x = position.x;
  self._worldBody.y = position.y;
  self._updateSprites();
};

Player.prototype.changedDirection = function() {
  var self = this;
  if (self._lastDirection !== self._direction) {
    self._lastDirection = self._direction;
    return true;
  }
  return false;
};

Player.prototype.changedKeystate = function() {
  var self = this;
  if (self._lastKeystate !== self._keystate) {
    self._lastKeystate = self._keystate;
    return true;
  }
  return false;
};

Player.prototype.changedState = function() {
  var self = this;
  if (self._lastState !== self._state) {
    self._lastState = self._state;
    return true;
  }
  return false;
};

Player.prototype.changed = function() {
  var self = this;
  return self.changedState() || self.changedKeystate() || self.changedDirection();
};

Player.prototype.debugState = function(state) {
  var self = this;

  var s = '';
  switch (state & Player.STATE_MASK) {
    case Player.IDLE:    s = 'idling';     break;
    case Player.WALK:    s = 'walking';    break;
    case Player.PUNCH:   s = 'punching';   break; 
    case Player.HIT:     s = 'being hit';  break;
    case Player.FALL:    s = 'falling';    break;
    case Player.RECOVER: s = 'recovering'; break;
    default: s = 'unknown'; break;
  }

  var keystate = '';
  if (state & Player.LEFT_PRESSED) keystate  += '<';
  if (state & Player.RIGHT_PRESSED) keystate += '>';
  if (state & Player.UP_PRESSED) keystate    += '^';
  if (state & Player.DOWN_PRESSED) keystate  += 'v';

  var direction = '';
  if (state & Player.FACING_LEFT) {
    direction = 'left';
  } else {
    direction = 'right';
  }

  console.log(self._name + ': state=' + s + ', keystate=' + keystate + ', direction=' + direction);

};

Player.prototype.canMove = function() {
  return this._state & Player.CAN_MOVE;
};

Player.prototype.getState = function() {
  var self = this;
  return self._state | self._keystate | self._direction;
};

Player.prototype.setState = function(state) {
  var self = this;

  // set direction
  if (state & Player.FACING_LEFT) {
    self._faceLeft();
  } else {
    self._faceRight();
  }
  // set player state
  switch (state & Player.STATE_MASK) {
    case Player.IDLE:    self._setIdle(); break;
    case Player.WALK:    self._setWalk(); break;
    case Player.PUNCH:   self.punch();    break; 
    case Player.HIT:     self._setHit();  break;
    case Player.FALL:    self._setFall(); break;
    case Player.RECOVER: self._setRecover(); break;
    default: console.log('unknown state: ' + (state & Player.STATE_MASK)); break;
  }
  // set keystate
  self.setKeystate(state & Player.KEYSTATE_MASK);
};

Player.prototype.setKeystate = function(keystate) {
  var self = this;
  // only set keystate if it changed
  if (keystate !== self._keystate) {
    self._keystate = keystate;
    if (self._state & Player.CAN_MOVE) {
      self._setNextState();
    }
  };
};

Player.prototype._updateSprites = function() {
  var self = this;

  // lock shadow to body
  self._shadow.x = self._worldBody.x;
  self._shadow.y = self._worldBody.y + self._yOffset;
  self._shadow.z = self._shadow.y;

  // lock sprite to body
  self._sprite.x = self._worldBody.x;
  if (self._state !== Player.FALL) {
    self._sprite.y = self._shadow.y;
  }
  self._sprite.z = self._shadow.z;

  // lock text to body
  self._text.x = self._worldBody.x - 1;
  self._text.y = self._sprite.y + self._textYOffset - 1;
  self._text.z = self._sprite.z;

  // if debugging physics body
  if (self._debug) {
    self._worldBody.debugBody.x = self._worldBody.x;
    self._worldBody.debugBody.y = self._worldBody.y;
    self._worldBody.debugBody.rotation = self._worldBody.rotation;
  }

};

Player.prototype._disableBody = function(body) {
  var self = this;
  body.clearCollision();
};

Player.prototype._enableBody = function(body, categoryBits) {
  var self = this;
  body.setCollisionGroup(self._collisionConfig.collisionGroups[categoryBits]);
  body.collides(self._collisionConfig.collidesConfig[categoryBits], self._collisionCallback, this);
};

Player.prototype._collisionCallback = function(body1, body2) {
  var self = this;
  var maxZMargin = 7;
  if (body1.player._id === body2.player._id) return;
  if (body1.categoryBits === 1 && body1.player._id === self._id) {
    if (body2.categoryBits === 2) {
      var zDiff = Math.abs(body1.player._shadow.y - body2.player._shadow.y);
      //console.log('z difference: ' + zDiff);
      if (zDiff <= maxZMargin) {
        self.hit();
      }
    }
  }
  if (body2.categoryBits === 1 && body2.player._id === self._id) {
    if (body1.categoryBits === 2) {
      var zDiff = Math.abs(body2.player._shadow.y - body1.player._shadow.y);
      //console.log('z difference: ' + zDiff);
      if (zDiff <= maxZMargin) {
        self.hit();
      }
    }
  }


  // console.log('body1.player: ' + body1.player
  //         + ', body2.player: ' + body2.player);
}

Player.prototype._updateCollisionBody = function() {
  var self = this;

  var frameName = self._sprite.frameName;
  if (frameName !== self._lastFrame) {
    if (self._activeBody) {
      self._disableBody(self._activeBody);
      self._activeBody.debug = false; 
    }
    if (frameName in self._collisionBodies) {
      self._activeBody = (self._sprite.scale.x < 0) ?
        self._collisionBodies[frameName].left : self._collisionBodies[frameName].right;
      self._enableBody(self._activeBody, self._collisionBodies[frameName].categoryBits);
      self._activeBody.debug = self._debug; 
    }
    self._lastFrame = frameName;
  } 

  if (self._activeBody) {
    self._activeBody.x = self._sprite.x;
    self._activeBody.y = self._sprite.y - self._sprite.height/2;
    if (self._activeBody.debugBody) {
      self._activeBody.debugBody.x = self._activeBody.x;
      self._activeBody.debugBody.y = self._activeBody.y;
      self._activeBody.debugBody.rotation = self._activeBody.rotation;
    }
  }

};

Player.prototype._forceProperSpriteRendering = function() {
  var self = this;
  var shadowXOffset = (self._shadow.width%2)  ? 0 : -0.5,
      spriteXOffset = (self._sprite.width%2)  ? 0 : -0.5,
      shadowYOffset = (self._shadow.height%2) ? 0 : -0.5,
      spriteYOffset = (self._sprite.height%2) ? 0 : -0.5;
  self._shadow.x = Math.round(self._shadow.x) + shadowXOffset;
  self._shadow.y = Math.round(self._shadow.y) + shadowYOffset;
  self._sprite.x = Math.round(self._sprite.x) + spriteXOffset;
  self._sprite.y = Math.round(self._sprite.y) + spriteYOffset;
};

Player.prototype.update = function(time) {
  var self = this;

  // clear velocity
  self._worldBody.velocity.x = 0;
  self._worldBody.velocity.y = 0;

  switch (self._state) {
    case Player.WALK:
      var dx = Player.MAX_SPEED,
          dy = Player.MAX_SPEED/2;
      if (self._keystate & Player.LEFT_PRESSED)  self._worldBody.moveLeft(dx);
      if (self._keystate & Player.RIGHT_PRESSED) self._worldBody.moveRight(dx);
      if (self._keystate & Player.UP_PRESSED)    self._worldBody.moveUp(dy);
      if (self._keystate & Player.DOWN_PRESSED)  self._worldBody.moveDown(dy);
      break;
    case Player.HIT:
      var dt = time - self._hitTime;
      // console.log('time=' + time + ', hittime= ' + self._hitTime + ', dt=' + dt);
      if (dt >= Player.HIT_TIME) {
        self._setNextState();
      }
      break;
    case Player.FALL:
      var t = (time - self._hitTime)/1000,
          v0y = -200,
          g = 500;
      self._sprite.y = self._yAtHit + v0y*t + 0.5*g*t*t;
      self._sprite.z = self._shadow.y;
      // if falling animation has completed
      if (self._sprite.y > self._yAtHit && t > 0) {
        // start recovering
        self._sprite.y = self._yAtHit;
        self._setRecover();
      }
      break;
    case Player.RECOVER:
      if (!self._animation.isPlaying) {
        self._setNextState();
      }
      break;
    case Player.PUNCH:
      var dt = time  - self._punchTime;
      if (dt >= Player.PUNCH_TIME) {
        self._setNextState();
      }
      break;
    case Player.HEADBUTT:
      console.log('WARN: headbutting not implemented');
      break;
    case Player.JUMP:
      console.log('WARN: jumping not implemented');
      break;
    default:
  };

  self._updateSprites();
  self._updateCollisionBody();
  self._forceProperSpriteRendering();

};

Player.prototype._faceLeft = function() {
  var self = this;
  self._direction = Player.FACING_LEFT;
  this._sprite.scale.x = -1.0;
};

Player.prototype._faceRight = function() {
  var self = this;
  self._direction = 0;
  self._sprite.scale.x = 1.0;
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
  self._state = Player.WALK;
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
  self._state = Player.IDLE;
  self._setAnimation('idle', 6);
};

Player.prototype.punch = function() {
  var self = this;
  if (self._state & Player.CAN_PUNCH) {
    self._punchTime = new Date().getTime();
    self._setPunch();
  }
};

Player.prototype._setPunch = function() {
  var self = this;
  self._state = Player.PUNCH;
  self._setAnimation('punch', 1, false);
};

Player.prototype.hit = function(damage) {
  var self = this;
  console.log('hit()');
  if (self._state & Player.CAN_HIT) {
    self._damage += 5; // FIXME
    if (self._damage < Player.MAX_DAMAGE) {
      self._setHit();
    } else {
      self._setFall();
    }
  }
};

Player.prototype._setHit = function() {
  var self = this;
  self._hitTime = new Date().getTime();
  self._state = Player.HIT;
  self._sprite.animations.play('hit', 1, false);
};

Player.prototype._setFall = function() {
  var self = this;
  self._damage = 0;
  self._hitTime = new Date().getTime();
  self._yAtHit = self._sprite.y;
  self._state = Player.FALL;
  self._sprite.animations.play('falling', 1, false);
  self._shadow.visible = true;
};

Player.prototype._setRecover = function() {
  var self = this;
  self._state = Player.RECOVER;
  self._shadow.visible = false;
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
