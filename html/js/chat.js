'use strict';

Chat.CHAR_LIMIT = 300;

function Chat(parentId) {
  var self = this;
  
  self._name = '';
  self._unseenMessages = 0;
  self._hasClientFocus = true;
  self._requestingHandle = true;
  self._inputSelected = false;
  self._originalTitle = document.title;
  self._parent = document.getElementById(parentId);
  self._wrapper = document.getElementById('chat-wrapper');
  self._log = document.getElementById('chat-log');
  self._form = document.getElementById('chat-form');
  self._input = document.getElementById('chat-input');
  self._handle = document.getElementById('chat-handle');
  self._messages = document.getElementById('chat-messages');

  self._setupChatInput();

}

Chat.prototype.resize = function(canvasHeight) {
  var self = this;


  var wrapperWidth = self._wrapper.offsetWidth;
  if (wrapperWidth <= Game.WIDTH) {
    var size = '8px';
    self._log.style.fontSize = size;
  } else if (wrapperWidth < 2*Game.WIDTH) {
    var size = '9px';
    self._log.style.fontSize = size;
  } else {
    var size = '10px';
    self._log.style.fontSize = size;
  }   

  // get total window height
  var totalHeight = self._wrapper.offsetHeight;
  // get sum of all elements but chat-log
  var handleHeight = self._handle.clientHeight,
      inputHeight = self._input.clientHeight;
  var logHeight = totalHeight - handleHeight - inputHeight - canvasHeight - 7;
  if (logHeight < 0) {
    logHeight = 0;
  }
  // set chat-log height
  self._log.style.height = logHeight + 'px';
  // scroll to bottom? 
  self._scrollOrRoll();
};

Chat.prototype.setFontSize = function(size) {
  var self = this;
  self._log.style.fontSize = size;
};


Chat.prototype.setName = function(name) {
  var self = this;
  self._name = name;
  self._requestingHandle = false;
  self.setHandleField(name);
  // allow for chat input
  self._input.maxLength = Chat.CHAR_LIMIT;
};

Chat.prototype.setHandleField = function(message) {
  var self = this;
  self._handle.innerHTML = message;
};

Chat.prototype.appendUserMessage = function(name, message) {
  var self = this;
  if (!self._hasClientFocus) {
    self._unseenMessages += 1;
    document.title = '(' + self._unseenMessages + ') ' + self._originalTitle;
  }
  self._messages.appendChild(self._generateListItem(name, message));
  self._scrollOrRoll();
};

Chat.prototype._generateListItem = function(name, message) {
  var self = this;

  var li = document.createElement("li"),
      textnode = document.createTextNode(message);
  li.innerHTML = '<a class="user" onclick=\'game.selectUser("'+name+'")\'>&lt'+name+'&gt&nbsp</a>';

  if (message[0] === '>') {
    // greentext message
    var span = document.createElement('span');
    span.className = 'quote';
    span.appendChild(textnode);
    li.appendChild(span);
  } else {
    // normal message
    li.appendChild(textnode);
  }

  return li;
};

Chat.prototype.appendSessionMessage = function(message) {
  var self = this;
  var textnode = document.createTextNode(message);
  var li = document.createElement("li");
  var span = document.createElement('span');
  span.className = 'session';
  span.appendChild(textnode);
  li.appendChild(span);
  self._messages.appendChild(li)
  self._scrollOrRoll();
};

Chat.prototype.focus = function() {
  var self = this;
  self._hasClientFocus = true;
  self._unseenMessages = 0;
  document.title = self._originalTitle;
};

Chat.prototype.blur = function() {
  var self = this;
  self._hasClientFocus = false;
};

Chat.prototype.isSelected = function() {
  var self = this;
  return self._inputSelected;
};

Chat.prototype._setupChatInput = function() {
  var self = this;

  self._input.onpaste = function(e) {
    // e.preventDefault();
  };

  self._input.onfocus = function() {
    game.deselectCanvas();
    self._hasClientFocus = true;
    self._inputSelected = true;
  };

  self._input.onblur = function() {
    game.selectCanvas();
    self._inputSelected = false;
  };

  self._form.addEventListener('submit', function(event) {
    // don't refresh on submit
    event.preventDefault();
    // remove whitespace and limit input size
    var message = self._input.value;
    message = message.replace(/^\s*|^\s$/gm, '');
    if (message >= Chat.CHAR_LIMIT) {
      message = message.substring(0, Chat.CHAR_LIMIT) + '...';
    }
    // send valid messages to server
    if (message !== '') {
      if (!self._requestingHandle) {
        self.appendUserMessage(self._name, message);
        game.send({'type': 'chat', 'message': message});
      } else {
        // TODO check if name is valid format
        // ...
        game.send({'type': 'name', 'name': message});
      }
    }
    // clear input field
    self._input.value = '';
    self._input.blur();
    // select game canvas
    game.selectCanvas();
  });

  // enable and select chat input
  self._input.disabled = false;
  self.selectInput();

};

Chat.prototype.selectInput = function() {
  var self = this;
  self._input.select();
};

Chat.prototype._scrollOrRoll = function() {
  var self = this;
  // TODO scroll to bottom if not reading old messages
  // ...
  self._log.scrollTop = self._log.scrollHeight;
};
