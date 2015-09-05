'use strict';

PlayerInput.MAX_DT = 1000;

PlayerInput.A_KEY = Phaser.Keyboard.S;
PlayerInput.B_KEY = Phaser.Keyboard.D;
PlayerInput.C_KEY = Phaser.Keyboard.F;

PlayerInput.LEFT_KEY = Phaser.Keyboard.LEFT;
PlayerInput.RIGHT_KEY = Phaser.Keyboard.RIGHT;
PlayerInput.UP_KEY = Phaser.Keyboard.UP;
PlayerInput.DOWN_KEY = Phaser.Keyboard.DOWN;

function PlayerInput(game, options) {
  var self = this;
  options = options || {};

  if (typeof game !== 'object') {
    throw new Error('Player input expects game context: ' + game);
  }
  self._game = game;

  self.buffer = [];
  self.keystate = 0;
  self._lastPressTime = 0;

  self._aButton = null;
  self._bButton = null;
  self._cButton = null;
  self.setAKey(PlayerInput.A_KEY);
  self.setBKey(PlayerInput.B_KEY);
  self.setCKey(PlayerInput.C_KEY);

  self._leftButton = null;
  self._rightButton = null;
  self._downButton = null;
  self._upButton = null;
  self.setLeftKey(PlayerInput.LEFT_KEY);
  self.setRightKey(PlayerInput.RIGHT_KEY);
  self.setDownKey(PlayerInput.DOWN_KEY);
  self.setUpKey(PlayerInput.UP_KEY);

  self.captureInput = true;

}

PlayerInput.prototype.debugMovement = function() {
  var self = this;
  var output = '';
  if (self.leftPressed) output += '◄';
  if (self.downPressed && self.upPressed) {
    output += '♦';
  } else {
    if (self.downPressed) output += '▼';
    if (self.upPressed) output += '▲';
  }
  if (self.rightPressed) output += '►';


  if (output !== '') {
    console.log('movement state: ' + output);
  }
};

PlayerInput.prototype.clear = function() {
  var self = this;

  // clear key states
  self.buffer = [];
  self.keystate = 0;

  // soft reset on all buttons
  self._aButton.reset(false);
  self._bButton.reset(false);
  self._cButton.reset(false);
  self._leftButton.reset(false);
  self._rightButton.reset(false);
  self._downButton.reset(false);
  self._upButton.reset(false);

};

PlayerInput.prototype.hasInput = function() {
  return (this.buffer.length > 0);
}

PlayerInput.prototype.dequeue = function() {
  var self = this;
  var buttonState = '';

  var lastTime = -1;
  while (self.buffer.length > 0) {
    var keyInfo = self.buffer[0];
    if (keyInfo.time - lastTime <= PlayerInput.MAX_DT || lastTime < 0) {
      // insert unique keys
      if (buttonState.indexOf(keyInfo.key) === -1)
        buttonState += keyInfo.key;
      lastTime = keyInfo.time;
      self.buffer.shift();
    } else {
      break;
    }
  }

  // sort keys in string
  var buttonArray = buttonState.split('');
  buttonArray = buttonArray.sort();
  buttonState = buttonArray.join('');

  return buttonState;
};

PlayerInput.prototype.enqueue = function(key) {
  var self = this;

  if (self.captureInput) {
    var now = new Date().getTime();
    self.buffer.push({
      key: key,
      time: now
    });
  }

};

PlayerInput.prototype.setAKey = function(keycode) {
  var self = this;
  if (self._aButton) {
    self._aButton.reset(true);
  }
  self._aButton = self._game.input.keyboard.addKey(keycode);
  self._game.input.keyboard.removeKeyCapture(keycode);
  self._aButton.onDown.add(function() {this.enqueue('A')}, this);
};

PlayerInput.prototype.setBKey = function(keycode) {
  var self = this;
  if (self._bButton) {
    self._bButton.reset(true);
  }
  self._bButton = self._game.input.keyboard.addKey(keycode);
  self._game.input.keyboard.removeKeyCapture(keycode);
  self._bButton.onDown.add(function() {this.enqueue('B')}, this);
};

PlayerInput.prototype.setCKey = function(keycode) {
  var self = this;
  if (self._cButton) {
    self._cButton.reset(true);
  }
  self._cButton = self._game.input.keyboard.addKey(keycode);
  self._game.input.keyboard.removeKeyCapture(keycode);
  self._cButton.onDown.add(function() {this.enqueue('C')}, this);
};



PlayerInput.prototype.setLeftKey = function(keycode) {
  var self = this;

  if (self._leftButton) {
    self._leftButton.reset(true);
  }

  self._leftButton = self._game.input.keyboard.addKey(keycode);

  self._leftButton.onDown.add(function() {
    if (this.captureInput) {
      this.keystate |= Player.LEFT_PRESSED;
    }
  }, self);

  self._leftButton.onUp.add(function() {
    if (this.captureInput) {
      this.keystate ^= Player.LEFT_PRESSED;
    }
  }, self);

};

PlayerInput.prototype.setRightKey = function(keycode) {
  var self = this;

  if (self._rightButton) {
    self._rightButton.reset(true);
  }

  self._rightButton = self._game.input.keyboard.addKey(keycode);

  self._rightButton.onDown.add(function() {
    if (this.captureInput) {
      this.keystate |= Player.RIGHT_PRESSED;
    }
  }, self);

  self._rightButton.onUp.add(function() {
    if (this.captureInput) {
      this.keystate ^= Player.RIGHT_PRESSED;
    }
  }, self);

};

PlayerInput.prototype.setDownKey = function(keycode) {
  var self = this;

  if (self._downButton) {
    self._downButton.reset(true);
  }

  self._downButton = self._game.input.keyboard.addKey(keycode);

  self._downButton.onDown.add(function() {
    if (this.captureInput) {
      this.keystate |= Player.DOWN_PRESSED;
    }
  }, self);

  self._downButton.onUp.add(function() {
    if (this.captureInput) {
      this.keystate ^= Player.DOWN_PRESSED;
    }
  }, self);

};

PlayerInput.prototype.setUpKey = function(keycode) {
  var self = this;

  if (self._upButton) {
    self._upButton.reset(true);
  }

  self._upButton = self._game.input.keyboard.addKey(keycode);

  self._upButton.onDown.add(function() {
    if (this.captureInput) {
      this.keystate |= Player.UP_PRESSED;
    }
  }, self);

  self._upButton.onUp.add(function() {
    if (this.captureInput) {
      this.keystate ^= Player.UP_PRESSED;
    }
  }, self);

};
