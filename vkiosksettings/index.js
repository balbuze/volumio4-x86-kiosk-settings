//vkiosksettings - balbuze 2025
'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var libFsExtra = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var spawn = require('child_process').spawn;
// Define the vkiosksettings class
module.exports = vkiosksettings;



function vkiosksettings(context) {
   var self = this;

   // Save a reference to the parent commandRouter
   self.context = context;
   self.commandRouter = self.context.coreCommand;
   self.logger = self.commandRouter.logger;


   this.context = context;
   this.commandRouter = this.context.coreCommand;
   this.logger = this.context.logger;
   this.configManager = this.context.configManager;

};

vkiosksettings.prototype.onVolumioStart = function () {
   var self = this;
   var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
   this.config = new (require('v-conf'))();
   this.config.loadFile(configFile);

   return libQ.resolve();


};

vkiosksettings.prototype.getConfigurationFiles = function () {
   var self = this;
   return ['config.json'];
};




// Plugin methods -----------------------------------------------------------------------------

vkiosksettings.prototype.onStop = function () {
   var self = this;
   var defer = libQ.defer();
   defer.resolve();
   return defer.promise;
};

vkiosksettings.prototype.onStart = function () {
   var self = this;
   var defer = libQ.defer();


   // Once the Plugin has successfull started resolve the promise
   defer.resolve();

   return defer.promise;
};

// playonconnect stop



vkiosksettings.prototype.onRestart = function () {
   var self = this;
   //
};

vkiosksettings.prototype.onInstall = function () {
   var self = this;
   //Perform your installation tasks here
};

vkiosksettings.prototype.onUninstall = function () {
   var self = this;
};

vkiosksettings.prototype.getUIConfig = function () {
   var defer = libQ.defer();
   var self = this;

   var lang_code = this.commandRouter.sharedVars.get('language_code');

   self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
      .then(function (uiconf) {


         defer.resolve(uiconf);
      })
      .fail(function () {
         defer.reject(new Error());
      });

   return defer.promise;

};

vkiosksettings.prototype.setUIConfig = function (data) {
   var self = this;
   //Perform your installation tasks here
};

vkiosksettings.prototype.getConf = function (varName) {
   var self = this;
   //Perform your installation tasks here
};

vkiosksettings.prototype.setConf = function (varName, varValue) {
   var self = this;
   //Perform your installation tasks here
};




