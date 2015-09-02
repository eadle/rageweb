'use strict';

InputBuffer.JUMP_BIT      = 1 << 0;
InputBuffer.PUNCH_BIT     = 1 << 1;
InputBuffer.KICK_BIT      = 1 << 2;
InputBuffer.SPECIAL_BIT   = 1 << 3;
InputBuffer.MAX_BUFFER_LENGTH = 5;

function InputBuffer(game, options) {
  var self = this;
  options = options || {};

  if (typeof game !== 'object') {
    throw new Error('Input buffer expects game context:' + game);
  }
  self._game = game;


  self._buffer = [];

  self._leftPressed  = false;
  self._rightPressed = false;
  self._upPressed    = false;
  self._downPressed  = false;

  self._jumpButton    = null;
  self._punchButton   = null;
  self._kickButton    = null;
  self._specialButton = null;

  self._leftButton   = null;
  self._rightButton  = null;
  self._upButton     = null;
  self._downButton   = null;

  self.setJumpKey(options.jumpKey || Phaser.Keyboard.SPACEBAR);
  self.setPunchKey(options.punchKey || Phaser.Keyboard.S);
  self.setKickKey(options.kickKey || Phaser.Keyboard.D);
  self.setSpecialKey(options.specialKey || Phaser.Keyboard.F);

  self.setLeftKey(options.leftKey || Phaser.Keyboard.LEFT);
  self.setRightKey(options.rightKey || Phaser.Keyboard.RIGHT);
  self.setUpKey(options.upKey || Phaser.Keyboard.UP);
  self.setDownKey(options.downKey || Phaser.Keyboard.DOWN);

}

InputBuffer.prototype.reset = function() {
  var self = this;
  // clear input buffer
  self._buffer = [];
  // no movement keys pressed
  self._leftPressed  = false;
  self._rightPressed = false;
  self._upPressed    = false;
  self._downPressed  = false;
  // soft reset on movement keys
  self._leftButton.reset(false);
  self._rightButton.reset(false);
  self._upButton.reset(false);
  self._downButton.reset(false);
  // soft reset on action keys
  self._jumpButton.reset(false);
  self._punchButton.reset(false);
  self._kickButton.reset(false);
  self._specialButton.reset(false);
};

InputBuffer.prototype.setJumpKey = function(keycode) {
  var self = this;
  if (self._jumpButton)
    self._jumpButton.reset(true);
  self._jumpButton = self._game.input.keyboard.addKey(keycode);
  self._jumpButton.onDown.add(self._onJumpPressed, this);
};

InputBuffer.prototype.setPunchKey = function(keycode) {
  var self = this;
  if (self._punchButton)
    self._punchButton.reset(true);
  self._punchButton = self._game.input.keyboard.addKey(keycode);
  self._punchButton.onDown.add(self._onPunchPressed, this);
};

InputBuffer.prototype.setKickKey = function(keycode) {
  var self = this;
  if (self._kickButton)
    self._kickButton.reset(true);
  self._kickButton = self._game.input.keyboard.addKey(keycode);
  self._kickButton.onDown.add(self._onKickPressed, this);
};

InputBuffer.prototype.setSpecialKey = function(keycode) {
  var self = this;
  if (self._specialButton)
    self._specialButton.reset(true);
  self._specialButton = self._game.input.keyboard.addKey(keycode);
  self._specialButton.onDown.add(self._onSpecialPressed, this);
};

InputBuffer.prototype._onJumpPressed = function() {
  var self = this;
  self._buffer.push({
    type: 'jump',
    //time: new Date().getTime()
  });
  if (self._buffer.length > InputBuffer.MAX_BUFFER_LENGTH) {
    self._buffer.shift();
  }
  console.log(JSON.stringify(self._buffer));
};

InputBuffer.prototype._onPunchPressed = function() {
  var self = this;
  self._buffer.push({
    type: 'punch',
    //time: new Date().getTime()
  });
  if (self._buffer.length > InputBuffer.MAX_BUFFER_LENGTH) {
    self._buffer.shift();
  }
  console.log(JSON.stringify(self._buffer));
};

InputBuffer.prototype._onKickPressed = function() {
  var self = this;
  self._buffer.push({
    type: 'kick',
    //time: new Date().getTime()
  });
  if (self._buffer.length > InputBuffer.MAX_BUFFER_LENGTH) {
    self._buffer.shift();
  }
  console.log(JSON.stringify(self._buffer));
};

InputBuffer.prototype._onSpecialPressed = function() {
  var self = this;
  self._buffer.push({
    type: 'special',
    //time: new Date().getTime()
  });
  if (self._buffer.length > InputBuffer.MAX_BUFFER_LENGTH) {
    self._buffer.shift();
  }
  console.log(JSON.stringify(self._buffer));
};


InputBuffer.prototype.setLeftKey = function(keycode) {
  var self = this;
  if (self._leftButton)
    self._leftButton.reset(true);
  self._leftButton = self._game.input.keyboard.addKey(keycode);
  self._leftButton.onDown.add(function() {
    self._leftPressed = true;
  }, this);
  self._leftButton.onUp.add(function() {
    self._leftPressed = false;
  }, this);
};

InputBuffer.prototype.setRightKey = function(keycode) {
  var self = this;
  if (self._rightButton)
    self._rightButton.reset(true);
  self._rightButton = self._game.input.keyboard.addKey(keycode);
  self._rightButton.onDown.add(function() {
    self._rightPressed = true;
  }, this);
  self._rightButton.onUp.add(function() {
    self._rightPressed = false;
  }, this);
};


InputBuffer.prototype.setUpKey = function(keycode) {
  var self = this;
  if (self._upButton)
    self._upButton.reset(true);
  self._upButton = self._game.input.keyboard.addKey(keycode);
  self._upButton.onDown.add(function() {
    self._upPressed = true;
  }, this);
  self._upButton.onUp.add(function() {
    self._upPressed = false;
  }, this);
};

InputBuffer.prototype.setDownKey = function(keycode) {
  var self = this;
  if (self._downButton)
    self._downButton.reset(true);
  self._downButton = self._game.input.keyboard.addKey(keycode);
  self._downButton.onDown.add(function() {
    self._downPressed = true;
  }, this);
  self._downButton.onUp.add(function() {
    self._downPressed = false;
  }, this);
};
