'use strict';

function PlayerFactory(game, options) {
  var self = this;
  options = options || {}; 

  if (typeof game !== 'object')
    throw new Error('PlayerFactory expects current game context: ' + game);
  if (typeof options.playerSpriteGroup !== 'object')
    throw new Error('PlayerFactory expects player sprite group: ' + options.PlayerSpriteGroup);
  if (typeof options.worldCollisionGroup !== 'object') 
    throw new Error('PlayerFactory expects world collision group: ' + options.worldCollisionGroup);
  if (typeof options.playerCollisionGroup !== 'object')
    throw new Error('PlayerFactory expects player collision group: ' + options.playerCollisionGroup);
  if (typeof options.hitboxCollisionGroup !== 'object')
    throw new Error('PlayerFactory expects hitbox collision group: ' + options.hitboxCollisionGroup);
  if (typeof options.attackCollisionGroup !== 'object')
    throw new Error('PlayerFactory expects attack collision group: ' + options.attackCollisionGroup);

  self._game = game;
  self._playerSpriteGroup = options.playerSpriteGroup;
  self._worldCollisionGroup = options.worldCollisionGroup;
  self._playerCollisionGroup = options.playerCollisionGroup;
  self._hitboxCollisionGroup = options.hitboxCollisionGroup;
  self._attackCollisionGroup = options.attackCollisionGroup;

  self._debug = false;
  if (typeof options.debug === 'boolean') {
    self._debug = options.debug;
  }

  // setup physics factory
  var physicsFactoryGroups = []; 
  physicsFactoryGroups.push({categoryBits: 1, group: self._hitboxCollisionGroup});
  physicsFactoryGroups.push({categoryBits: 2, group: self._attackCollisionGroup});
  self._physicsFactory = new PhysicsFactory(self._game, {groups: physicsFactoryGroups});
  var physicsKeyConfig = {collides: [[1,2], [2,2]]};
  self._physicsFactory.addKey('vice', 'vice-atlas', 'vice-physics', physicsKeyConfig);
  // self._physicsFactory.addKey('max', 'max-atlas', 'max-physics', physicsKeyConfig);

}

PlayerFactory.prototype.createPlayer = function(options) {
  var self = this;
  options = options || {}; 

  if (typeof options.type !== 'string') {
    throw new Error('PlayerFactory expects a player type: ' + options.type);
  }
  if (typeof options.id !== 'string') {
    throw new Error('PlayerFactory expects a player id: ' + options.id);
  }
  if (typeof options.position !== 'object') {
    throw new Error('PlayerFactory expects a player position: ' + options.position);
  }

  options.playerSpriteGroup = self._playerSpriteGroup;
  options.worldCollisionGroup = self._worldCollisionGroup;
  options.playerCollisionGroup = self._playerCollisionGroup;
  options.debug = self._debug;

  var isClient = (typeof options.isClient === 'boolean') ? options.isClient : false;
  if (!isClient) {
    options.collisionConfig = {
      bodies: self._physicsFactory.buildBodies(options.type, false, {categoryBits: [2]}),
      collides: self._physicsFactory.getCollidesConfig(options.type),
      collisionGroups: self._physicsFactory.getCollisionGroups()
    };
  } else {
    options.collisionConfig = self._physicsFactory.getCollisionConfig(options.type);
  }

  switch (options.type) {
    case 'vice':
      return new Vice(self._game, options);
    //case 'max':
      //return new Max(self._game, options);
    default:
      return null;
  }

};
