//vkiosksettings - balbuze August2025
'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var libFsExtra = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var spawn = require('child_process').spawn;
const io = require('socket.io-client');
const logPrefix = "vkiosksettings --- "
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
   self.socket = io.connect('http://localhost:3000');
   self.startvkiosksettingsservice();
   self.getDisplaynumber();
   setTimeout(function () {
      self.checkIfPlay()

   }, 2000);
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

         var hidecursor = self.config.get('hidecursor', false);
         uiconf.sections[0].content[2].value = hidecursor;

         uiconf.sections[0].content[3].value = self.config.get('timeout');
         uiconf.sections[0].content[3].attributes = [
            {
               placeholder: 120,
               maxlength: 4,
               min: 0,
               max: 1000
            }
         ];

         uiconf.sections[0].content[4].value = self.config.get('noifplay');

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

// Define once
vkiosksettings.prototype.getDisplaynumber = function () {
   try {
      if (process.env.DISPLAY) {
         return process.env.DISPLAY;
      }
      //
      const { execSync } = require("child_process");

      // Check Xorg processes
      let output = execSync("ps -ef | grep -m1 '[X]org' || true", { encoding: "utf8" });
      let match = output.match(/Xorg\s+(:\d+)/);
      if (match) {
         return match[1];
      }

      // Try xdpyinfo if installed
      try {
         let xdpy = execSync("xdpyinfo 2>/dev/null | grep 'name of display'", { encoding: "utf8" });
         let xmatch = xdpy.match(/:([0-9]+)/);
         if (xmatch) {
            return ":" + xmatch[1];
         }
      } catch (e) {
         // ignore
      }

      // Default fallback
      return ":0";
   } catch (err) {
      this.logger.error("detectDisplay() error: " + err);
      return ":0";
   }
};


vkiosksettings.prototype.refreshUI = function () {
   const self = this;

   setTimeout(function () {
      var respconfig = self.commandRouter.getUIConfigOnPlugin('user_interface', 'vkiosksettings', {});
      respconfig.then(function (config) {
         self.commandRouter.broadcastMessage('pushUiConfig', config);
      });
      self.commandRouter.closeModals();
   }, 100);
}
/*
vkiosksettings.prototype.savescreensettings = function (data) {
   const self = this;

   self.config.set('rotatescreen', {
      value: data['rotatescreen'].value,
      label: data['rotatescreen'].label
   });

   self.config.set('touchcorrection', {
      value: data['touchcorrection'].value,
      label: data['touchcorrection'].label
   });

   self.config.set('hidecursor', data['hidecursor']);

   // ✅ validate timeout
   let timeout = parseInt(data['timeout'], 10);
   if (isNaN(timeout)) {
      self.logger.warn('[vkiosksettings] Invalid timeout value, using default 120');
      timeout = 120;
   } else {
      if (timeout < 0) {
         self.logger.warn('[vkiosksettings] Timeout < 0, clamped to 0');
         timeout = 0;
      }
      if (timeout > 1000) {
         self.logger.warn('[vkiosksettings] Timeout > 1000, clamped to 1000');
         timeout = 1000;
      }
   }
   self.config.set('timeout', timeout);

   self.config.set('noifplay', data.noifplay);

   if (timeout === 0) {
      self.wakeupScreen();
   }

   self.checkIfPlay();
   self.applyscreensettings();
};
*/

vkiosksettings.prototype.checkIfPlay = function () {
   const self = this;

   // self.logger.info(logPrefix +' noifplay '+ noifplay);

   self.socket.on('pushState', function (data) {
      var timeout = self.config.get('timeout');
      var noifplay = self.config.get('noifplay');
      self.logger.info(logPrefix + 'Volumio status ' + data.status + ' timeout ' + timeout + ' noifplay ' + noifplay);

      if ((data.status === "play") && (noifplay)) {
         self.wakeupScreen()
      } else if ((((data.status === "pause") || (data.status === "stop")) && (timeout != 0)) || ((data.status === "play") && (!noifplay))) {
         self.sleepScreen()

      }
   })
};

vkiosksettings.prototype.wakeupScreen = function () {
   const self = this;
   const defer = libQ.defer();

   const display = self.getDisplaynumber();
   const cmd = `/bin/sudo /usr/bin/xset -display ${display} -dpms`;

   exec(cmd, { uid: 1000, gid: 1000 }, (error, stdout, stderr) => {
      if (error) {
         self.logger.error(logPrefix + ': Error waking up the screen: ' + error);
      } else {
         self.logger.info(logPrefix + `: Screen wake command sent to display=${display}`);
      }
      defer.resolve();
   });

   return defer.promise;
};

vkiosksettings.prototype.sleepScreen = function () {
   const self = this;
   const defer = libQ.defer();

   const display = self.getDisplaynumber();
   const timeout = self.config.get('timeout');

   const cmd = `/bin/sudo /usr/bin/xset -display ${display} s 0 0 +dpms dpms 0 0 ${timeout}`;

   exec(cmd, { uid: 1000, gid: 1000 }, (error, stdout, stderr) => {
      if (error) {
         self.logger.error(logPrefix + ': Error sleeping the screen: ' + error);
      } else {
         self.logger.info(logPrefix + `: Sleep screen set with timeout=${timeout}, display=${display}`);
      }
      defer.resolve();
   });

   return defer.promise;
};

vkiosksettings.prototype.savescreensettings = function (data) {
   const self = this;

   self.config.set('rotatescreen', {
      value: data['rotatescreen'].value,
      label: data['rotatescreen'].label
   });

   self.config.set('touchcorrection', {
      value: data['touchcorrection'].value,
      label: data['touchcorrection'].label
   });

   self.config.set('hidecursor', data['hidecursor']);

   // ✅ validate timeout
   let timeout = parseInt(data['timeout'], 10);
   if (isNaN(timeout)) {
      timeout = 120;
      self.config.set('timeout', timeout);
      self.commandRouter.pushToastMessage(
         'error',
         'Screensaver Timeout',
         'Invalid value entered. Reset to default (120 seconds).'
      );
   } else {
      if (timeout < 0) {
         timeout = 0;
         self.commandRouter.pushToastMessage(
            'error',
            'Screensaver Timeout',
            'Value cannot be negative. Clamped to 0.'
         );
      } else if (timeout > 1000) {
         timeout = 1000;
         self.commandRouter.pushToastMessage(
            'error',
            'Screensaver Timeout',
            'Value too high. Clamped to 1000.'
         );
      } else {
         self.commandRouter.pushToastMessage(
            'success',
            ' ✅ Screen settings applied'
           
         );
      }
      self.config.set('timeout', timeout);
   }

   self.config.set('noifplay', data.noifplay);

   if (timeout === 0) {
      self.wakeupScreen();
   }
   self.refreshUI();
   self.checkIfPlay();
   self.applyscreensettings();
};



vkiosksettings.prototype.applyscreensettings = function () {
   const self = this;
   const defer = libQ.defer();
   const display = self.getDisplaynumber();

   const rotatescreen = self.config.get("rotatescreen").value;
   const touchcorrection = self.config.get("touchcorrection").value;
   const hidecursor = self.config.get("hidecursor")
   if (hidecursor) {
      var phidecursor = "unclutter-xfixes -idle 2 -root"
   } else {
      var phidecursor = "pkill unclutter"
   }

   fs.readFile(__dirname + "/rotatescreen.sh.tmpl", "utf8", function (err, data) {
      if (err) {
         self.logger.error("Template read error: " + err);
         return defer.reject(new Error(err));
      }

      // Replace both variables independently
      let conf1 = data.replace("${rotatescreen}", rotatescreen);
      conf1 = conf1.replace("${touchcorrection}", touchcorrection);
      conf1 = conf1.replace("${hidecursor}", phidecursor);
      conf1 = conf1.replace("${display}", display);


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
