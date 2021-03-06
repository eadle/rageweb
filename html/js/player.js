'use strict';

// maximum 256 player states
Player.STATE_MASK = 0x00FF;
// movement encoding
Player.LEFT_PRESSED  = 1 << 24;
Player.RIGHT_PRESSED = 1 << 25;
Player.UP_PRESSED    = 1 << 26;
Player.DOWN_PRESSED  = 1 << 27;
Player.KEYSTATE_MASK = 0x0F000000;
// direction encoding
Player.FACING_LEFT = 1 << 28;
// other shared attributes
Player.START_POS = {x: 256, y: 220}; // temp
Player.HALF_GRAVITY = 300;
Player.CHANGED_STATE = -1;

function Player(game, options) {
  var self = this;
  options = options || {};

  // must specify game context
  if (typeof game !== 'object') {
    throw new Error('Player expects valid game context: ' + game);
  }
  self._game = game;

  // must specify player id
  if (typeof options.id !== 'string') {
    throw new Error('Player expects valid id string: ' + options.id);
  }
  self._id = options.id;

  // must specify player position
  if (typeof options.position !== 'object') {
    throw new Error('Player expects valid starting position: ' + options.position);
  }
  var position = options.position;

  // other options
  self._isClient = (typeof options.isClient === 'boolean') ? options.isClient : false;
  self._debug = (typeof options.debug === 'boolean') ? options.debug : false;
  self._name = (typeof options.name === 'string') ? options.name : null;

  // player name
  self._text = null;
  if (self.hasName()) {
    self._textOffset = {x: 0, y: -88};
    self._text = new Phaser.Text(game, position.x, position.y + self._textOffset.y, self._name);
    self._text.anchor.setTo(0.5, 0.0);
    self._text.font = 'Press Start 2P';
    self._text.fontWeight = 'normal';
    self._text.smoothed = false;
    self._text.fontSize = '8px';
    self._text.fill = (typeof options.textFill === 'string') ? options.textFill : '#FF0000';
    self._text.stroke = '#000000';
    self._text.strokeThickness = 2;
  }

  // player shadow
  self._shadow = self._game.add.sprite(position.x, position.y, 'shadow');
  self._shadow.anchor.setTo(0.5, 1.0);
  self._shadow.visible = false;
  self._shadow.smoothed = false;
  self._lockSpriteToBody = true;

  // add the sprites to sprite group for z-sorting
  if (typeof options.playerSpriteGroup === 'object') {
    var group = options.playerSpriteGroup;
    group.add(self._shadow);
    if (self._text) {
      group.add(self._text);
    }
  }

  // player collision bodies
  self._collisionConfig = options.collisionConfig; // FIXME
  self._collisionBodies = self._collisionConfig.bodies;
  Object.keys(self._collisionBodies).forEach(function(key) {
    var leftBody = self._collisionBodies[key].left,
        rightBody = self._collisionBodies[key].right,
        categoryBits = self._collisionBodies[key].categoryBits;
    // custom properties
    leftBody.player = self;
    rightBody.player = self;
    var isHitbox = (categoryBits === 1);
    var isAttack = (categoryBits === 2);
    leftBody.isHitbox = isHitbox;
    rightBody.isHitbox = isHitbox;
    leftBody.isAttack = isAttack;
    rightBody.isAttack = isAttack;
    // normal properties
    leftBody.fixedRotation = true;
    rightBody.fixedRotation = true;
    leftBody.clearCollision();
    rightBody.clearCollision();
    game.physics.p2.addBody(leftBody);
    game.physics.p2.addBody(rightBody);
  });
  self._activeBody = null;

  // capsule can have same dimensions as shadow
  var radius = self._shadow.height/1.5;
  self._shadowOffset = {x: 0, y: radius/2};
  self._worldBody = new Phaser.Physics.P2.Body(game, null, position.x, position.y, 1);
  self._worldBody.addCircle(radius);
  self._worldBody.debug = self._debug;
  game.physics.p2.addBody(self._worldBody);
  var worldCollisionGroup = options.worldCollisionGroup;   // FIXME
  var playerCollisionGroup = options.playerCollisionGroup; // FIXME
  self._worldBody.setCollisionGroup(playerCollisionGroup);
  self._worldBody.collides([worldCollisionGroup]);

  // client uses input events
  self._input = (self._isClient) ? new PlayerInput(self._game, self) : null;

  // player info
  self._state = 0;
  self._keystate = 0;
  self._direction = 0;
  self._stateStartPosition = {x: self._worldBody.x, y: self._worldBody.y};
  self._stateStartVelocity = {x: 0, y: 0};
  self._health = 100;

  // helpers 
  self._lastStateInternal = self._state;
  self._lastKeystateInternal = self._keystate;
  self._lastDirectionInternal = self._direction;
}

Player.prototype.useInput = function() {
  var self = this;
  if (self._isClient && self._input) {
    self._input.captureInput = true;
  } 
};

Player.prototype.ignoreInput = function() {
  var self = this;
  if (self._isClient && self._input) {
    self._input.captureInput = false;
    self._input.clear();
  }
};

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

  if (self._sprite) {
    self._sprite.destroy();
    self._sprite = null;
  }

  if (self._shadow) {
    self._shadow.destroy();
    self._shadow = null;
  }

  if (self._text) {
    self._text.destroy();
    self._text = null;
  }

  self._worldBody.destroy();
  Object.keys(self._collisionBodies).forEach(function(key) {
    self._collisionBodies[key].right.destroy();
    self._collisionBodies[key].left.destroy();
    delete self._collisionBodies[key];
  });

};

Player.prototype.hasName = function() {
  return (typeof this._name === 'string');
};

Player.prototype.getName = function() {
  return this._name;
};

Player.prototype.getVelocity = function() {
  return this._stateStartVelocity;
};

Player.prototype.setVelocity = function(velocity) {
  var self = this;
  self._worldBody.velocity.x = velocity.x;
  self._worldBody.velocity.y = velocity.y;
};

Player.prototype.getPosition = function() {
  return this._stateStartPosition; 
};

Player.prototype.setPosition = function(position) {
  var self = this;
  self._worldBody.x = position.x;
  self._worldBody.y = position.y;
  self._updateSprites();
};

Player.prototype.changedDirection = function() {
  var self = this;
  if (self._lastDirectionInternal !== self._direction) {
    self._lastDirectionInternal = self._direction;
    return true;
  }
  return false;
};

Player.prototype.changedKeystate = function() {
  var self = this;
  if (self._lastKeystateInternal !== self._keystate) {
    self._lastKeystateInternal = self._keystate;
    return true;
  }
  return false;
};

Player.prototype.changedState = function() {
  var self = this;
  if (self._lastStateInternal !== self._state) {
    self._lastStateInternal = self._state;
    return true;
  }
  return false;
};

Player.prototype.needsBroadcast = function() {
  var self = this;
  return self.changedState() || self.changedKeystate() || self.changedDirection();
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

Player.prototype.getKeystate = function() {
  return this._keystate;
};

Player.prototype.setKeystate = function(keystate) {
  this._keystate = keystate;
};

Player.prototype.getState = function() {
  var self = this;
  return self._state | self._keystate | self._direction;
};

Player.prototype.setState = function(state) {
  var self = this;

  // face the proper direction
  if (state & Player.FACING_LEFT) {
    self._faceLeft();
  } else {
    self._faceRight();
  }
  // set the actual player state
  self._setState(state & Player.STATE_MASK);
  // set the keystate
  self.setKeystate(state & Player.KEYSTATE_MASK);

};

Player.prototype._enableBody = function(body, categoryBits) {
  var self = this;
  body.setCollisionGroup(self._collisionConfig.collisionGroups[categoryBits]);
  body.collides(self._collisionConfig.collides[categoryBits], self._collisionCallback, this);
};

Player.prototype._disableBody = function(body) {
  var self = this;
  body.clearCollision();
};

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

Player.prototype._updateSprites = function() {
  var self = this;

  self._worldBody.x = self._worldBody.x;
  self._worldBody.y = self._worldBody.y;

  // shadow is always locked to body
  self._shadow.x = Math.floor(self._worldBody.x + self._shadowOffset.x);
  self._shadow.y = Math.floor(self._worldBody.y + self._shadowOffset.y);
  self._shadow.z = self._shadow.y;

  // sprite may not be locked to body
  if (self._lockSpriteToBody) {
    self._sprite.x = self._shadow.x;
    self._sprite.y = self._shadow.y;
    self._sprite.z = self._shadow.z;
  }

  // text is locked to body but offset vertically
  if (self._text) {
    self._text.x = Math.floor(self._shadow.x + self._textOffset.x);
    self._text.y = Math.floor(self._sprite.y + self._textOffset.y);
    self._text.z = self._sprite.z;
  }

  // if debugging physics body
  if (self._debug) {
    self._worldBody.debugBody.x = self._worldBody.x;
    self._worldBody.debugBody.y = self._worldBody.y;
    self._worldBody.debugBody.rotation = self._worldBody.rotation;
  }

};

Player.prototype._preUpdate = function() {
  var self = this;
  // clear velocity
  self._worldBody.velocity.x = 0;
  self._worldBody.velocity.y = 0;
};

Player.prototype._postUpdate = function() {
  var self = this;
  self._updateSprites();
  self._updateCollisionBody();
  //self._forceProperSpriteRendering();
};

Player.prototype.update = function(time) {
  var self = this;
  self._preUpdate();
  self._update(time);
  self._postUpdate();
};

Player.prototype._isMoving = function() {
  return this._isMovingHorizontally() || this._isMovingVertically();
};

Player.prototype._isMovingHorizontally = function() {
  var self = this;
  var left = self._keystate & Player.LEFT_PRESSED,
      right = self._keystate & Player.RIGHT_PRESSED;
  return (left && !right) || (!left && right);
};

Player.prototype._isMovingVertically = function() {
  var self = this;
  var up = self._keystate & Player.UP_PRESSED,
      down = self._keystate & Player.DOWN_PRESSED;
  return (up && !down) || (!up && down);
};

// Override these
Player.prototype._update = function(time) {};
Player.prototype._setState = function(state) {};
Player.prototype._setNextState = function() {};
Player.prototype._collisionCallback = function(bodyA, bodyB) {};


Vice.prototype = Object.create(Player.prototype);
Vice.constructor = Vice;

Vice.IDLE     = 0;
Vice.WALK     = 1;
Vice.PUNCH    = 2;
Vice.HEADBUTT = 3;
Vice.DAMAGED  = 4;
Vice.FALL     = 5;
Vice.RECOVER  = 6;
Vice.GHOST    = 7;
Vice.DAMAGE_TIME = 150;
Vice.PUNCH_TIME  = 100;
Vice.SPEED = 180;

function Vice(game, options) {
  var self = this;
  options = options || {};

  Player.call(self, game, options);

  self._type = 'vice';

  var position = options.position;
  self._sprite = new Phaser.Sprite(self._game, position.x, position.y, 'vice-atlas', 'idle-0');
  self._sprite.anchor.setTo(0.5, 1.0);
  self._sprite.smoothed = false;
  // idle animation
  self._sprite.animations.add('idle', [
    'idle-0',
    'idle-1',
    'idle-2',
    'idle-1'
  ], 6, true);
  // walk animation
  self._sprite.animations.add('walk', [
    'walk-0',
    'walk-1',
    'walk-2', 
    'walk-1'
  ], 10, true);
  // recover animation
  self._sprite.animations.add('recover', [
    'recover-0',
    'recover-1',
    'recover-2'
  ], 4, false);
  // add the sprite to sprite group for z-sorting
  if (typeof options.playerSpriteGroup === 'object') {
    var group = options.playerSpriteGroup;
    group.add(self._sprite);
  }

  if (typeof options.state === 'number') {
    self.setState(options.state);
  } else {
    self._setState(Vice.IDLE);
  }

  // custom attributes
  self._timesHit = 0;

  // state helper variables
  self._stateStartTime = new Date().getTime();
  self._stateStartPosition = position;
  self._currentAnimation = null;

};

Vice.prototype.canMove = function() {
  var self = this;
  return (self._state <= Vice.WALK);
};

Vice.prototype._collisionCallback = function(bodyA, bodyB) {
  var self = this;
  //console.log('collision callback');
  if (Math.abs(bodyA.player._shadow.y - bodyB.player._shadow.y) <= 10) {
    self.hit();
  }
}

Vice.prototype._setNextState = function() {
  var self = this;
  if (self._isMovingHorizontally() || self._isMovingVertically()) {
    self._setWalking();
  } else {
    self._setIdling();
  }
};

Vice.prototype._setIdling = function() {
  var self = this;
  self._state = Vice.IDLE;
  self._currentAnimation = self._sprite.animations.play('idle');
};

Vice.prototype._setWalking = function() {
  var self = this;
  self._state = Vice.WALK;
  // face sprite in moving direction
  if (self._keystate & Player.LEFT_PRESSED) {
    self._faceLeft();
  } else if (self._keystate & Player.RIGHT_PRESSED) {
    self._faceRight();
  }
  self._currentAnimation = self._sprite.animations.play('walk');
};

Vice.prototype._setPunching = function() {
  var self = this;
  if (self._state <= Vice.WALK) {
    self._state = Vice.PUNCH;
    self._stateStartTime = new Date().getTime();
    self._sprite.animations.stop();
    self._sprite.frameName = 'punch';
  }
};

Vice.prototype._setHeadbutting = function() {
  var self = this;
  self._state = Vice.HEADBUTT;
  self._stateStartTime = new Date().getTime();
};

Vice.prototype.hit = function(damage) {
  var self = this;
  if (self._state <= Vice.WALK) {
    self._timesHit += 1;
    if (self._timesHit < 3) {
      self.setDamaged();
    } else {
      self._timesHit = 0;
      self._setFalling();
    }
  }
};

Vice.prototype.setDamaged = function() {
  var self = this;
  self._state = Vice.DAMAGED;
  self._stateStartTime = new Date().getTime();
  self._sprite.animations.stop();
  self._sprite.frameName = 'damage';
};

Vice.prototype._setFalling = function() {
  var self = this;
  self._state = Vice.FALL;
  self._shadow.visible = true;
  self._stateStartTime = new Date().getTime();
  self._stateStartPosition = { 
    x: self._sprite.x,
    y: self._sprite.y
  };
  self._sprite.animations.stop();
  self._lockSpriteToBody = false;
  self._sprite.frameName = 'fall';
};

Vice.prototype._setRecovering = function() {
  var self = this;
  self._state = Vice.RECOVER;
  self._shadow.visible = false;
  self._lockSpriteToBody = true;
  self._currentAnimation = self._sprite.animations.play('recover');
};

Vice.prototype._setGhosting = function() {
  var self = this;
  // TODO
};

Vice.prototype._setState = function(state) {
  var self = this;

  switch (state) {
    case Vice.IDLE: self._setIdling(); break;
    case Vice.WALK: self._setWalking(); break;
    case Vice.PUNCH: self._setPunching(); break;
    case Vice.HEADBUTT: self._setHeadbutting(); break;
    case Vice.DAMAGED: self.setDamaged(); break;
    case Vice.FALL: self._setFalling(); break;
    case Vice.RECOVER: self._setRecovering(); break;
    case Vice.GHOST: self._setGhosting(); break;
    default: console.log('unknown state: ' + state); 
  }

};

// Override
Vice.prototype._update = function(time) {
  var self = this;

  // clear velocity
  self._worldBody.velocity.x = 0;
  self._worldBody.velocity.y = 0;

  switch (self._state) {
    case Vice.WALK:
      var dx = Vice.SPEED,
          dy = Vice.SPEED/2;
      if (self._keystate & Player.LEFT_PRESSED)  self._worldBody.moveLeft(dx);
      if (self._keystate & Player.RIGHT_PRESSED) self._worldBody.moveRight(dx);
      if (self._keystate & Player.UP_PRESSED)    self._worldBody.moveUp(dy);
      if (self._keystate & Player.DOWN_PRESSED)  self._worldBody.moveDown(dy);
      break;
    case Vice.DAMAGED:
      var dt = time - self._stateStartTime;
      // console.log('time=' + time + ', hittime= ' + self._hitTime + ', dt=' + dt);
      if (dt >= Vice.DAMAGE_TIME) {
        self._setNextState();
      }
      break;
    case Vice.FALL:
      var t = (time - self._stateStartTime)/1000,
          v0y = -200,
          g = 500;
      self._sprite.y = self._stateStartPosition.y + v0y*t + 0.5*g*t*t;
      self._sprite.z = self._shadow.y;
      // if falling animation has completed
      if (self._sprite.y > self._stateStartPosition.y && t > 0) {
        // start recovering
        self._sprite.y = self._stateStartPosition.y;
        self._setRecovering();
      }
      break;
    case Vice.RECOVER:
      if (!self._currentAnimation.isPlaying) {
        self._setNextState();
      }
      break;
    case Vice.PUNCH:
      var dt = time  - self._stateStartTime;
      if (dt >= Vice.PUNCH_TIME) {
        self._setNextState();
      }
      break;
    default:
  };

};


Max.prototype = Object.create(Player.prototype);
Max.constructor = Max;

// states
Max.NO_STATE           =-1;
Max.IDLE               = 0;
Max.WALK               = 1;
Max.JUMP               = 2;
Max.CHOP               = 3;
Max.RIGHT_PUNCH        = 4;
Max.HAMMER_PUNCH       = 5;
Max.SUPER_HAMMER_PUNCH = 6;
Max.KNUCKLE_BOMB       = 7;
Max.THUNDER_TACKLE     = 8;
Max.POWER_SLIDE        = 10;
Max.ELBOW_DROP         = 11;
Max.DROP_KICK          = 12;
Max.DAMAGED            = 13;
Max.FALL               = 14;
Max.RECOVER            = 15;
Max.GHOST              = 16;
// constants
Max.SPEED = 200;
Max.CROUCH_TIME = 50;
Max.DAMAGED_TIME = 200;
Max.JUMP_VELOCITY = -275;
Max.TEXT_OFFSET_X = 0;
Max.TEXT_OFFSET_Y = -97;

function Max(game, options) {
  var self = this;
  options = options || {};

  Player.call(self, game, options);

  self._type = 'max';
  self._textOffset = {x: Max.TEXT_OFFSET_X, y: Max.TEXT_OFFSET_Y};

  var position = options.position;
  self._sprite = new Phaser.Sprite(self._game, position.x, position.y, 'max-atlas', 'idle-0');
  self._sprite.anchor.setTo(0.5, 1.0);
  self._sprite.smoothed = false;
  // idle animation
  self._sprite.animations.add('idle', [
    'idle-0',
    'idle-1',
    'idle-2',
    'idle-1',
    'idle-0'
  ], 6, true);
  // walk animation
  self._sprite.animations.add('walk', [
    'walk-0',
    'walk-1',
    'walk-2', 
    'walk-3',
    'walk-4',
    'walk-5'
  ], 10, true);
  // recover animation
  self._sprite.animations.add('recover', [
    'recover-0',
    'recover-1',
    'recover-2'
  ], 4, false);
  // chop animation
  self._sprite.animations.add('chop', [
    'chop-0',
    'chop-1',
    'chop-2',
    'chop-3',
    'chop-3'
  ], 16, false);
  // right-punch animation
  self._sprite.animations.add('right-punch', [
    'right-punch-0',
    'right-punch-1',
    'right-punch-2',
    'right-punch-3',
    'right-punch-3'
  ], 14, false);
  // hammer-punch animation
  self._sprite.animations.add('hammer-punch', [
    'hammer-punch-1',
    'hammer-punch-1',
    'hammer-punch-1',
    'hammer-punch-2',
    'hammer-punch-2',
    'hammer-punch-3',
    'hammer-punch-3',
    'hammer-punch-3'
  ], 16, false);
  // super-hammer-punch animation
  self._sprite.animations.add('super-hammer-punch', [
    'super-hammer-punch-0',
    'super-hammer-punch-0',
    'super-hammer-punch-0',
    'super-hammer-punch-1',
    'super-hammer-punch-1',
    'super-hammer-punch-2'
  ], 16, false);
  // elbow-drop animation
  self._sprite.animations.add('elbow-drop', [
    'elbow-drop-0',
    'elbow-drop-1'
  ], 8, false);
  // drop-kick animation
  self._sprite.animations.add('drop-kick', [
    'drop-kick-0',
    'drop-kick-1'
  ], 8, false);
  // knuckle-bomb animation
  self._sprite.animations.add('knuckle-bomb', [
    'knuckle-bomb-0',
    'knuckle-bomb-1',
    'knuckle-bomb-2',
    'knuckle-bomb-3',
    'knuckle-bomb-0',
    'knuckle-bomb-1',
    'knuckle-bomb-2',
    'knuckle-bomb-3'
  ], 16, false);
  // thunder-tackle animation
  self._sprite.animations.add('thunder-tackle', [
    'thunder-tackle-0',
    'thunder-tackle-0',
    'thunder-tackle-1',
    'thunder-tackle-3',
    'thunder-tackle-3',
    'thunder-tackle-1'
  ], 14, false); 
  // power-slide animation
  self._sprite.animations.add('power-slide', [
    'power-slide-0',
    'power-slide-0',
    'power-slide-1',
    'power-slide-1',
    'power-slide-2',
    'power-slide-2',
    'recover-2',
  ], 10, false);

  // add the sprite to sprite group for z-sorting
  if (typeof options.playerSpriteGroup === 'object') {
    var group = options.playerSpriteGroup;
    group.add(self._sprite);
  }

  if (typeof options.state === 'number') {
    self.setState(options.state);
  } else {
    self._setState(Max.IDLE);
  }

  // state helper variables
  self._prevState = 0; 
  self._velocityOnStart = {x: 0, y: 0};
  self._positionOnStart = {x: self._sprite.x, y: self._sprite.y};
  self._currentAnimation = null;

  // FIXME redo jump state
  self._jumpState  = -1;
  self._crouchTime = -1;
  self._jumpTime   = -1;
  self._landTime   = -1;
  self._landingSprite = 'jump-0';
  self._landingOffset = 0;
  self._lastHitTime = 0;

  // FIXME to be removed
  self._stateStartTime = new Date().getTime();
  self._stateStartPosition = position;

  // sound effects
  self._audio = { 
    attack: self._game.add.audio('sfx-attack'),
    hit0: self._game.add.audio('sfx-hit-0'),
    hit1: self._game.add.audio('sfx-hit-0'),
    hit2: self._game.add.audio('sfx-hit-0'),
    jump: self._game.add.audio('sfx-jump'),
    elbowdrop: self._game.add.audio('sfx-elbow-drop'),
    fall: self._game.add.audio('sfx-drop'),
    powerslide: self._game.add.audio('sfx-power-slide'),
    thunderbodyslam: self._game.add.audio('sfx-thunder-body-slam')
  };

  self._audio.attack.volume = 0.4;
  self._audio.hit0.volume = 0.4;
  self._audio.hit1.volume = 0.4;
  self._audio.hit2.volume = 0.4;
  self._audio.jump.volume = 0.4;
  self._audio.elbowdrop.volume = 0.4;
  self._audio.fall.volume = 0.4;
  self._audio.powerslide.volume = 0.3;
  self._audio.thunderbodyslam.volume = 0.4;

  //self._game.sound.mute = true;
  //self._game.sound.volume = 0.1;

}

Max.prototype.setGhosting = function(ghosting) {
  var self = this;
  var ghost = (typeof ghosting === 'boolean') ? ghosting : false;
  if (ghosting) {
    self._setState(Max.GHOST);
  } else {
    self._setNextState();
  }
};

Max.prototype.hit = function(from) {
  var self = this;
  var timeSinceLastHit = new Date().getTime() - self._lastHitTime;
  if (self._state < Max.DAMAGED && timeSinceLastHit > Max.DAMAGED_TIME + 75) {
    console.log('hp: ' + self._health);
    if (self._health < 0) {
      self._setState(Max.FALL);
      self._health = 100;
    } else {
      self._setState(Max.DAMAGED);
      self._health -= 35;
    }
  }
};

Max.prototype._collisionCallback = function(bodyA, bodyB) {
  var self = this;

  if (bodyA.player._id === bodyB.player._id) return;

  if (Math.abs(bodyA.player._shadow.y - bodyB.player._shadow.y) <= 10) {
    if (bodyA.isHitbox && bodyA.player._isClient) {
      var from = {
        x: bodyB.player._sprite.x,
        y: bodyB.player._sprite.y
      };
      bodyA.player.hit(from);
    }
    if (bodyB.isHitbox && bodyB.player._isClient) {
      var from = {
        x: bodyA.player._sprite.x,
        y: bodyA.player._sprite.y
      };
      bodyB.player.hit(from);
    }
  }
}

Max.prototype._clearState = function() {
  var self = this;
  self._lockSpriteToBody = true;
  self._shadow.visible = false;
  self._landingOffset = 0;
  self._textOffset = {x: Max.TEXT_OFFSET_X, y: Max.TEXT_OFFSET_Y};
  if (self._input) {
    self._keystate = self._input.keystate;
  }
  self._faceProperDirection();
  self._sprite.alpha = 1.0;
};

Max.prototype._setState = function(state) {
  var self = this;

  if (Max.NO_STATE === state)
    return;

  self._clearState();
  self._prevState = self._state;

  // all states but idle and walk should be rebroadcast on repeats
  if (self._state !== Max.IDLE && self._state !== Max.WALK) {
    self._lastStateInternal = Player.CHANGED_STATE; // FIXME
  }

  switch (state) {

    case Max.GHOST:
      self._state = Max.GHOST;
      self._sprite.alpha = 0.4;
      self._currentAnimation = self._sprite.animations.play('idle');
      break;

    case Max.IDLE:
      self._state = Max.IDLE;
      self._currentAnimation = self._sprite.animations.play('idle');
      break;

    case Max.WALK:
      self._state = Max.WALK;
      if (self._keystate & Player.LEFT_PRESSED) {
        self._faceLeft();
      } else if (self._keystate & Player.RIGHT_PRESSED) {
        self._faceRight();
      }
      self._currentAnimation = self._sprite.animations.play('walk');
      break;

    case Max.DAMAGED:
      self._audio.hit0.play();
      self._state = Max.DAMAGED;
      self._sprite.animations.stop();
      self._sprite.frameName = 'damaged-0';
      self._stateStartTime = new Date().getTime();
      self._lastHitTime = self._stateStartTime;
      break;

    case Max.FALL:
      self._state = Max.FALL;
      self._audio.hit1.play();
      self._sprite.animations.stop();
      self._lockSpriteToBody = false;
      self._sprite.frameName = 'fall-0';
      self._shadow.visible = true;
      // self._landingOffset = ???;
      self._sprite.frameName = 'fall-0';
      self._stateStartTime = new Date().getTime();
      break;

    case Max.RECOVER:
      self._state = Max.RECOVER;
      self._currentAnimation = self._sprite.animations.play('recover');
      break;

    case Max.JUMP:
      self._state = Max.JUMP;
      self._jumpState = 0;
      self._audio.jump.play();
      self._sprite.animations.stop();
      self._lockSpriteToBody = false;
      self._sprite.frameName = 'jump-0';
      self._landingSprite = 'jump-0';
      self._crouchTime = new Date().getTime();
      self._move();
      self._velocityOnStart = {
        x: self._worldBody.velocity.x,
        y: self._worldBody.velocity.y
      };
      break;

    case Max.CHOP:
      self._state = Max.CHOP;
      self._audio.attack.play();
      self._currentAnimation = self._sprite.animations.play('chop');
      break;

    case Max.RIGHT_PUNCH:
      self._state = Max.RIGHT_PUNCH;
      self._audio.attack.play();
      self._currentAnimation = self._sprite.animations.play('right-punch');
      break;

    case Max.HAMMER_PUNCH:
      self._state = Max.HAMMER_PUNCH;
      self._audio.attack.play();
      self._currentAnimation = self._sprite.animations.play('hammer-punch');
      break;

    case Max.KNUCKLE_BOMB:
      self._state = Max.KNUCKLE_BOMB;
      self._audio.powerslide.play('', 0.2);
      self._currentAnimation = self._sprite.animations.play('knuckle-bomb');
      self._move(Max.SPEED/2);
      self._velocityOnStart = {
        x: self._worldBody.velocity.x,
        y: self._worldBody.velocity.y
      };
      break;

    case Max.THUNDER_TACKLE:
      self._state = Max.THUNDER_TACKLE;
      self._audio.attack.play();
      self._audio.thunderbodyslam.play();
      var dy = 1.25*Max.SPEED;
      self._velocityOnStart.y = 0;
      if (self._keystate & Player.UP_PRESSED) self._velocityOnStart.y -= dy;
      if (self._keystate & Player.DOWN_PRESSED) self._velocityOnStart.y += dy;
      var dx = 2.5*Max.SPEED;
      self._velocityOnStart.x = (self._sprite.scale.x < 0) ? -dx : dx;
      self._currentAnimation = self._sprite.animations.play('thunder-tackle');
      break;

    case Max.POWER_SLIDE:
      self._state = Max.POWER_SLIDE;
      var dx = 1.5*Max.SPEED;
      self._audio.powerslide.play();
      self._velocityOnStart.x = (self._sprite.scale.x < 0) ? -dx : dx;
      self._velocityOnStart.y = 0;
      self._currentAnimation = self._sprite.animations.play('power-slide');
      break;

    case Max.SUPER_HAMMER_PUNCH:
      self._state = Max.SUPER_HAMMER_PUNCH;
      self._audio.attack.play();
      self._textOffset.y = -107;
      self._shadow.visible = true;
      self._lockSpriteToBody = false;
      self._landingSprite = 'jump-0';
      self._currentAnimation = self._sprite.animations.play('super-hammer-punch');
      break;

    case Max.ELBOW_DROP:
      self._state = Max.ELBOW_DROP;

      self._audio.attack.play();
      self._textOffset.y = -105;
      self._shadow.visible = true;
      self._lockSpriteToBody = false;
      self._landingOffset = 30;
      self._landingSprite = 'elbow-drop-2';
      self._currentAnimation = self._sprite.animations.play('elbow-drop');
      break;

    case Max.DROP_KICK:
      self._state = Max.DROP_KICK;
      self._audio.attack.play();
      self._shadow.visible = true;
      self._lockSpriteToBody = false;
      self._landingOffset = 40;
      self._landingSprite = 'power-slide-0';
      self._currentAnimation = self._sprite.animations.play('drop-kick');
      break;

    default:
      console.log('set state: UNKNOWN'); // FIXME
  }

  self._stateStartPosition = {x: self._worldBody.x, y: self._worldBody.y};
  self._stateStartVelocity = {x: self._worldBody.velocity.x, y: self._worldBody.velocity.y};

};

Max.prototype._faceProperDirection = function() {
  var self = this;
  if (self._keystate & Player.LEFT_PRESSED && !(self._keystate & Player.RIGHT_PRESSED)) {
    self._faceLeft();
  }
  if (self._keystate & Player.RIGHT_PRESSED && !(self._keystate & Player.LEFT_PRESSED)) {
    self._faceRight();
  }
};

Max.prototype._move = function(speed) {
  var self = this;
  speed = speed || Max.SPEED;
  var dx = speed, dy = speed/2;
  if (self._keystate & Player.LEFT_PRESSED)  self._worldBody.moveLeft(dx);
  if (self._keystate & Player.RIGHT_PRESSED) self._worldBody.moveRight(dx);
  if (self._keystate & Player.UP_PRESSED)    self._worldBody.moveUp(dy);
  if (self._keystate & Player.DOWN_PRESSED)  self._worldBody.moveDown(dy);
  if (self._worldBody.velocity.x < 0) self._faceLeft();
  if (self._worldBody.velocity.x > 0) self._faceRight();
};

Max.prototype._setNextState = function(transitions) {
  var self = this;

  if (self._isClient) {
    var transition = transitions || {};

    var stateA  = transition.A  || Max.CHOP,
        stateB  = transition.B  || Max.POWER_SLIDE,
        stateX  = transition.X  || Max.KNUCKLE_BOMB,
        stateY  = transition.Y  || Max.JUMP,
        stateAX = transition.AX || Max.THUNDER_TACKLE;

    if (self._input.hasInput()) {
      var buttonState = self._input.dequeue();
      switch (buttonState) {
        case 'A':
          self._setState(stateA);
          return;
        case 'B':
          self._setState(stateB);
          return;
        case 'X':
          self._setState(stateX);
          return;
        case 'Y':
          self._setState(stateY);
          return;
        case 'AX':
          self._setState(stateAX);
          return;
        default:
      }
    }
  }

  if (self._isMoving()) {
    self._setState(Max.WALK);
  } else {
    self._setState(Max.IDLE);
  }

};

Max.prototype._update = function(time) {
  var self = this;

  switch (self._state) {
    case Max.IDLE:
      self._setNextState();
      break;

    case Max.WALK:
      if (self._isMoving()) {
        self._move();
      }
      self._setNextState();
      break;

    case Max.DAMAGED:
      var dt = time - self._stateStartTime;
      if (dt >= Max.DAMAGED_TIME) {
        self._setNextState();
      }
      break;

    case Max.FALL:
      var dt = (time - self._stateStartTime)/1000;
      self._sprite.y = self._shadow.y + dt*(Max.JUMP_VELOCITY + dt*Player.HALF_GRAVITY);
      self._sprite.z = self._shadow.y;
      if (dt > 0 && self._sprite.y > self._shadow.y + self._landingOffset) {
        self._sprite.y = self._shadow.y;
        self._shadow.visible = false;
        self._setState(Max.RECOVER);
      }
      break;

    case Max.RECOVER:
      if (!self._currentAnimation.isPlaying) {
        self._setNextState();
      }
      break;

    case Max.JUMP:

      if (self._jumpState > 0) {
        self._worldBody.velocity.x = self._velocityOnStart.x;
        self._worldBody.velocity.y = self._velocityOnStart.y;
        self._sprite.x = Math.floor(self._worldBody.x);
        self._sprite.y = Math.floor(self._worldBody.y);
      }
      switch (self._jumpState) {
        case 0: // initial crouch
          var dt = time - self._crouchTime;
          if (dt >= Max.CROUCH_TIME) {
            self._jumpState = 1;
            self._jumpTime = time;
            self._sprite.frameName = 'jump-1';
            self._shadow.visible = true;
            self._textOffset.y = -105;
          } else {
            break;
          }
        case 1: // in air
          dt = (time - self._jumpTime)/1000;
          self._sprite.y = self._shadow.y + dt*(Max.JUMP_VELOCITY + dt*Player.HALF_GRAVITY);
          self._sprite.z = self._shadow.y;

          var distanceFromFloor = Math.abs(self._sprite.y - self._shadow.y);
          if (dt > 0 && self._sprite.y > self._shadow.y) {
            self._sprite.y = self._shadow.y;
            self._jumpState = 2;
            self._landTime = time;
            self._sprite.frameName = 'jump-0';
            self._shadow.visible = false;
          } else if (self._isClient && self._input.hasInput() && distanceFromFloor > 30) {
            self._setNextState({
              A: Max.ELBOW_DROP,
              B: Max.DROP_KICK,
              X: Max.SUPER_HAMMER_PUNCH,
              Y: Max.NO_STATE,
              AX: Max.NO_STATE
            });
          }

          break;
        case 2: // landing
          dt = time - self._landTime;
          if (dt >= Max.CROUCH_TIME) {
            self._setNextState();
          }
        default:
      }

      break;

    case Max.SUPER_HAMMER_PUNCH:
    case Max.ELBOW_DROP:
    case Max.DROP_KICK:
      self._worldBody.velocity.x = self._velocityOnStart.x;
      self._worldBody.velocity.y = self._velocityOnStart.y;
      self._sprite.x = Math.floor(self._worldBody.x);
      self._sprite.y = Math.floor(self._worldBody.y);

      switch (self._jumpState) {
        case 1:
          dt = (time - self._jumpTime)/1000;
          self._sprite.y = self._shadow.y + dt*(Max.JUMP_VELOCITY + dt*Player.HALF_GRAVITY);
          self._sprite.z = self._shadow.y;

          if (dt > 0 && self._sprite.y > self._shadow.y + self._landingOffset) {
            self._jumpState = 2;
            self._landTime = time;
            self._sprite.y = self._shadow.y;
            self._sprite.frameName = self._landingSprite;
            self._shadow.visible = false;
          }

          break;
        case 2:
          dt = time - self._landTime;
          if (dt >= Max.CROUCH_TIME) {
            self._setNextState();
          }
          break;
      }

      break;

    case Max.CHOP:
      if (!self._currentAnimation.isPlaying) {
        var stateOnA = (self._prevState === Max.CHOP) ? Max.RIGHT_PUNCH : Max.CHOP;
        self._setNextState({A: stateOnA});
      }
      break;

    case Max.RIGHT_PUNCH:
      if (!self._currentAnimation.isPlaying) {
        self._setNextState({A: Max.HAMMER_PUNCH});
      }
      break;

    case Max.HAMMER_PUNCH:
      if (!self._currentAnimation.isPlaying) {
        self._setNextState();
      }
      break;

    case Max.KNUCKLE_BOMB:
      self._worldBody.velocity.x = self._velocityOnStart.x;
      self._worldBody.velocity.y = self._velocityOnStart.y;
      if (!self._currentAnimation.isPlaying) {
        self._setNextState();
      }
      break;
    
    case Max.THUNDER_TACKLE:
      if (self._sprite.frameName !== 'thunder-tackle-0') {
        self._shadow.visible = true;
        self._worldBody.velocity.x = self._velocityOnStart.x;
        self._worldBody.velocity.y = self._velocityOnStart.y;
      }
      if (!self._currentAnimation.isPlaying) {
        self._setNextState();
      }
      break;

    case Max.POWER_SLIDE:
      if (self._sprite.frameName !== 'power-slide-0' && self._sprite.frameName !== 'recover-2') {
        self._worldBody.velocity.x = self._velocityOnStart.x;
        self._worldBody.velocity.y = self._velocityOnStart.y;
      }
      if (!self._currentAnimation.isPlaying) {
        self._setNextState();
      }
      
      break;

    default: /* do nothing */

  }

};
