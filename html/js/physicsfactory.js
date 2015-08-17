'use strict';

function PhysicsFactory(game, options) {
  var self = this;
  options = options || {};

  if (typeof game !== 'object') {
    throw new Error('PhysicsFactory expect valid game context: ' + game);
  }

  self._game = game;
  self._playerConfig = {};
  self._playerFrames = {};

  self._trimSpriteNames = true; // default
  if (typeof options.trimSpriteNames === 'boolean') {
    self._trimSpriteNames = options.trimSpriteNames;
  } 

}

PhysicsFactory.prototype.addKey = function(key, atlas, physics, options) {
  var self = this;
  options = options || {};

  if (typeof key !== 'string')
    throw new Error('Player key must be of type string: ' + key);
  if (key in self._playerConfig)
    throw new Error('Player key already exists in PhysicsFactory: ' + key);
  if (typeof atlas !== 'string')
    throw new Error('Atlas key must be of type string: ' + atlas);
  if (self._game.cache.checkImageKey(atlas) === false)
    throw new Error('Atlas key is not in game cache: ' + atlas);
  if (typeof physics !== 'string')
    throw new Error('Physics key must be of type string: ' + physics);
  if (self._game.cache.checkPhysicsKey(physics) === false)
    throw new Error('Physics key is not in game cache: ' + physics);

  // store frame names
  var frames = self._game.cache.getImage(atlas, true).frameData._frames;
  self._playerFrames[key] = frames;

  // store physics configurations
  var config = {};
  var allPhysicsData = self._game.cache.getPhysicsData(physics);
  for (var ii = 0; ii < frames.length; ii++) {
    var frameName = frames[ii].name;
    frameName = (self._trimSpriteNames) ? frameName.replace(/\..+$/, '') : frameNmae;
    // if the sprite has a physics body
    if (frameName in allPhysicsData) {
      var center = {x: frames[ii].centerX, y: frames[ii].centerY};
      var data = self._stripPhysicsData(allPhysicsData[frameName]);
      var flipped = self._flipPhysicsData(data, center, true);
      // store shapes in collision group hash
      var group = [];
      for (var di = 0; di < data.length; di++) {
        var collisionGroup = data[di].filter.categoryBits;
        // search group array for collisionGroup
        var groupIndex = -1;
        for (var gi = 0; gi < group.length; gi++) {
          if (group[gi].collisionGroup === collisionGroup) {
            groupIndex = gi;
            break;
          }
        }
        // initialize group
        if (groupIndex === -1) {
          group.push({
            collisionGroup: collisionGroup,
            imported: [],
            flipped: []
          });
          groupIndex = group.length - 1;
        }
        // insert shapes into appropriate shape array
        group[groupIndex].imported.push(data[di].shape);
        group[groupIndex].flipped.push(flipped[di].shape);
      }
      
      // add frame center and group
      config[frameName] = {
        center: center,
        group: group
      };
    }
  }
  self._playerConfig[key] = config;

};

PhysicsFactory.prototype._getPhysicsBody = function(shape, centerOfMass) {
  var self = this;

  var body = new Phaser.Physics.P2.Body(self._game, null, self._game.width/2, self._game.height/2, 1);

  var cm = p2.vec2.create();
  for (var i = 0; i < shape.length; i++) {
    var vertices = []; 
    for (var s = 0; s < shape[i].length; s += 2) {
      vertices.push([body.world.pxmi(shape[i][s]), body.world.pxmi(shape[i][s + 1])]);
    }
    var convex = new p2.Convex({vertices: vertices});
    for (var j = 0; j !== convex.vertices.length; j++) {
      var v = convex.vertices[j];
      p2.vec2.sub(v, v, convex.centerOfMass);
    }
    p2.vec2.scale(cm, convex.centerOfMass, 1);
    cm[0] -= body.world.pxmi(centerOfMass.x); 
    cm[1] -= body.world.pxmi(centerOfMass.y); 
    convex.updateTriangles();
    convex.updateCenterOfMass();
    convex.updateBoundingRadius();
    body.data.addShape(convex, cm);
  }
  body.data.aabbNeedsUpdate = true; 
  body.shapeChanged(); 
  
  return body;
};

PhysicsFactory.prototype._stripPhysicsData = function(data) {
  var self = this;

  var stripped = [];
  for (var ii = 0; ii < data.length; ii++) {
    var obj = {};
    obj.filter = data[ii].filter;
    obj.shape = data[ii].shape;
    stripped.push(obj);
  }

  return stripped;
};

PhysicsFactory.prototype._flipPhysicsData = function(data, center, hFlip, vFlip) {
  var self = this;

  var flippedShapes = [];
  for (var ii = 0; ii < data.length; ii++) {
    flippedShapes.push(self._flipPhysicsShape(data[ii].shape, center, hFlip, vFlip));
  }

  var flippedData = [];
  for (var ii = 0; ii < data.length; ii++) {
    var destination = {};
    self._clone(destination, data[ii]);
    destination.shape = flippedShapes[ii];
    flippedData.push(destination);
  }

  return flippedData;
};

PhysicsFactory.prototype._flipPhysicsShape = function(shape, center, hFlip, vFlip) {
  var self = this;
  hFlip = (typeof hFlip === 'boolean') ? hFlip : false;
  vFlip = (typeof vFlip === 'boolean') ? vFlip : false;

  var flippedShape = [];
  for (var jj = 0; jj < shape.length; jj += 2) {
    var x = shape[jj];
    if (hFlip) {
      x -= center.x;
      x *= -1;
      x += center.x;
    }
    var y = shape[jj + 1];
    if (vFlip) {
      y -= center.y;
      y *= -1;
      y += center.y;
    }
    flippedShape.push(x);
    flippedShape.push(y);
  }
  if ((hFlip && !vFlip) || (!hFlip && vFlip)) {
    flippedShape = self._reversePointDirection(flippedShape);
  }

  return flippedShape;
};

PhysicsFactory.prototype._reversePointDirection = function(shape) {
  var self = this;

  for (var ii = 0, jj = shape.length-2; ii < shape.length/2; ii += 2, jj -= 2) {
    // swap x-coordinate
    var tmp = shape[ii];
    shape[ii] =  shape[jj];
    shape[jj] = tmp;
    // swap y-coordinate
    tmp = shape[ii+1];
    shape[ii+1] =  shape[jj+1];
    shape[jj+1] = tmp;
  }

  return shape;
};

PhysicsFactory.prototype._clone = function(destination, source) {
  for (var property in source) {
    if (typeof source[property] === "object" && source[property] !== null && destination[property]) { 
      clone(destination[property], source[property]);
    } else {
      destination[property] = source[property];
    }
  }
};

PhysicsFactory.prototype._debugConfig = function(frameName, config) {
  var self = this;
  console.log(frameName + ':');
  console.log(JSON.stringify(config, function(k,v) {
    if(v instanceof Array && typeof v[0] === 'number')
      return JSON.stringify(v);
    return v;
  },2));
  console.log('');
};

PhysicsFactory.prototype.buildBodies = function(key) {
  var self = this;

  if (!(key in self._playerConfig)) {
    throw new Error('Player key is not in PhysicsFactory: ' + key);
  }

  var bodies = {};
  var playerFrames = self._playerFrames[key];
  var playerConfig = self._playerConfig[key];
  for (var fi = 0; fi < playerFrames.length; fi++) {
    var frameName = playerFrames[fi].name;
    if (!(frameName in playerConfig)) continue;
    var frameConfig = playerConfig[frameName]; 
    var center = frameConfig.center,
        group = frameConfig.group;
    for (var gi = 0; gi < group.length; gi++) {
      console.log(JSON.stringify(group[gi]));
      bodies[frameName] = {
        group: group.collisionGroup,
        right: self._getPhysicsBody(group[gi].imported, center),
        left: self._getPhysicsBody(group[gi].flipped, center)
      };
    }
  }

  return bodies;
};
