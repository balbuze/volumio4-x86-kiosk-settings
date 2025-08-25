//vkiosksettings - balbuze 2025
'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var libFsExtra = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var spawn = require('child_process').spawn;
const Logprefix = "vkiosksettings --- "
// Define the vkiosksettings class
module.exports = vkiosksettings;



function vkiosksettings(context) {
   var self = this;

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

vkiosksettings.prototype.onStop = function () {
   var self = this;
   var defer = libQ.defer();
   self.stopvkiosksettingsservice();
   defer.resolve();
   return defer.promise;
};

vkiosksettings.prototype.onStart = function () {
   var self = this;
   var defer = libQ.defer();
   self.startvkiosksettingsservice();

   // Once the Plugin has successfull started resolve the promise
   defer.resolve();

   return defer.promise;
};


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


vkiosksettings.prototype.startvkiosksettingsservice = function () {
   const self = this;
   let defer = libQ.defer();

   exec("/usr/bin/sudo /bin/systemctl start vkiosksettings.service", {
      uid: 1000,
      gid: 1000
   }, function (error, stdout, stderr) {
      if (error) {
         self.logger.info(logPrefix + 'vkiosksettings failed to start. Check your configuration ' + error);
      } else {
         self.commandRouter.pushConsoleMessage('vkiosksettings Daemon Started');

         defer.resolve();
      }
   });
};

vkiosksettings.prototype.restartvkiosksettingsservice = function () {
   const self = this;
   let defer = libQ.defer();
   exec("/usr/bin/sudo /bin/systemctl restart vkiosksettings.service", {
      uid: 1000,
      gid: 1000
   }, function (error, stdout, stderr) {
      if (error) {
         self.logger.info(logPrefix + 'vkiosksettings failed to start. Check your configuration ' + error);
      } else {
         self.commandRouter.pushConsoleMessage('vkiosksettings Daemon Started');

         defer.resolve();
      }
   });
};

vkiosksettings.prototype.stopvkiosksettingsservice = function () {
   const self = this;
   let defer = libQ.defer();

   exec("/usr/bin/sudo /bin/systemctl stop vkiosksettings.service", {
      uid: 1000,
      gid: 1000
   }, function (error, stdout, stderr) {
      if (error) {
         self.logger.info(logPrefix + 'vkiosksettings failed to stop!! ' + error);
      } else {
         self.commandRouter.pushConsoleMessage('vkiosksettings Daemon Stop');

         defer.resolve();
      }
   });
};

vkiosksettings.prototype.getUIConfig = function () {
   var defer = libQ.defer();
   var self = this;

   var lang_code = this.commandRouter.sharedVars.get('language_code');

   self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
      .then(function (uiconf) {

         var rvalue = self.config.get('rotatescreen') || { value: "normal", label: "normal" };

         self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', rvalue.value);
         self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label', rvalue.label);


         var tcvalue = self.config.get('touchcorrection') || { value: "none", label: "none" };

         self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', tcvalue.value);
         self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label', tcvalue.label);

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

vkiosksettings.prototype.rotatescreen = function (data) {
  const self = this;

  self.config.set('rotatescreen', {
    value: data['rotatescreen'].value,
    label: data['rotatescreen'].label
  });

  self.config.set('touchcorrection', {
    value: data['touchcorrection'].value,
    label: data['touchcorrection'].label
  });

  self.applyrotatescreen();
};

vkiosksettings.prototype.applyrotatescreen = function () {
  const self = this;
  const defer = libQ.defer();

  const rotatescreen = self.config.get("rotatescreen").value;
  const touchcorrection = self.config.get("touchcorrection").value;

  fs.readFile(__dirname + "/rotatescreen.sh.tmpl", "utf8", function (err, data) {
    if (err) {
      self.logger.error("Template read error: " + err);
      return defer.reject(new Error(err));
    }

    // Replace both variables independently
    let conf1 = data.replace("${rotatescreen}", rotatescreen);
    conf1 = conf1.replace("${touchcorrection}", touchcorrection);

    const scriptPath = "/data/plugins/user_interface/vkiosksettings/rotatescreen.sh";

    fs.writeFile(scriptPath, conf1, { encoding: "utf8", mode: 0o755 }, function (err) {
      if (err) {
        self.logger.error("Script write error: " + err);
        defer.reject(new Error(err));
      } else {
        self.logger.info(`Rotation script updated: display=${rotatescreen}, touchscreen=${touchcorrection}`);
        self.restartvkiosksettingsservice();
        defer.resolve();
      }
    });
  });

  return defer.promise;
};
