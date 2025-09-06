//vkiosksettings - balbuze September 2025
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
   self.fixXauthority();
   // self.startvkiosksettingsservice();
   setTimeout(function () {
      self.checkIfPlay();
      self.getDisplaynumber();
      self.applyscreensettings();

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
      let display;

      if (process.env.DISPLAY) {
         display = process.env.DISPLAY;
      } else {
         const { execSync } = require("child_process");

         // Check Xorg processes
         let output = execSync("ps -ef | grep -m1 '[X]org' || true", { encoding: "utf8" });
         let match = output.match(/Xorg\s+(:\d+)/);
         if (match) {
            display = match[1];
         } else {
            // Try xdpyinfo if installed
            try {
               let xdpy = execSync("xdpyinfo 2>/dev/null | grep 'name of display'", { encoding: "utf8" });
               let xmatch = xdpy.match(/:([0-9]+)/);
               if (xmatch) {
                  display = ":" + xmatch[1];
               }
            } catch (e) {
               // ignore
            }
         }
      }

      // Default fallback
      if (!display) display = ":0";

      // Export to environment for all child processes
      process.env.DISPLAY = display;

      return display;
   } catch (err) {
      this.logger.error("detectDisplay() error: " + err);
      process.env.DISPLAY = ":0";
      return ":0";
   }
};

vkiosksettings.prototype.detectConnectedScreen = function () {
   const self = this;
   const display = self.getDisplaynumber();

   return new Promise((resolve, reject) => {
      exec(`xrandr --display ${display} --query`, (error, stdout, stderr) => {
         if (error) {
            return reject(`xrandr error: ${stderr || error.message}`);
         }

         const lines = stdout.split("\n");

         const connected = lines
            .map(line => {
               const match = line.match(/^([A-Za-z0-9-]+)\s+connected/);
               return match ? match[1] : null;
            })
            .filter(Boolean);

         if (connected.length === 0) {
            self.logger.warn(logPrefix + " No connected screens detected");
            return resolve(null);
         }

         self.logger.info(logPrefix + " Connected screens: " + connected.join(", "));
         resolve(connected[0]);
      });
   });
};

vkiosksettings.prototype.fixXauthority = function () {
   const self = this;

   return new Promise((resolve, reject) => {
      const cmd = `if [ -f /root/.Xauthority ]; then cp /root/.Xauthority /home/volumio/ && chown volumio:volumio /home/volumio/.Xauthority; fi`;

      const fullCmd = `/bin/echo volumio | /usr/bin/sudo -S /bin/bash -c '${cmd}'`;

      exec(fullCmd, { uid: 1000, gid: 1000 }, (error, stdout, stderr) => {
         if (error) {
            self.logger.error(logPrefix + " fixXauthority failed: " + (stderr || error.message));
            return reject(error);
         }
         self.logger.info(logPrefix + " fixXauthority: /home/volumio/.Xauthority updated");
         resolve(stdout);
      });
   });
};


vkiosksettings.prototype.checkIfPlay = function () {
   const self = this;

   self.logger.info(logPrefix +' noifplay ');

   self.socket.on('pushState', function (data) {
      var timeout = self.config.get('timeout');
      var noifplay = self.config.get('noifplay');
      self.logger.info(logPrefix + 'Volumio status ' + data.status + ' timeout ' + timeout + ' noifplay ' + noifplay);

      if ((data.status === "play") && (noifplay)) {
         self.wakeupScreen()
      } else if (((data.status != "play") && (timeout != 0)) || ((data.status === "play") && (!noifplay))) {
         self.sleepScreen()

      }
   })
};

vkiosksettings.prototype.wakeupScreen = function () {
   const self = this;
   const defer = libQ.defer();

   const display = self.getDisplaynumber();
   const cmd = `/usr/bin/xset -display ${display} -dpms`;

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

   const cmd = `/usr/bin/xset -display ${display} s 0 0 +dpms dpms 0 0 ${timeout}`;

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

   // validate timeout
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
setTimeout(function () {
   self.refreshUI();
   self.checkIfPlay();
   self.applyscreensettings();

   // ✅ Apply screensaver immediately
   try {
      const state = self.commandRouter.volumioGetState();
      const timeout = self.config.get('timeout');
      const noifplay = self.config.get('noifplay');

      if ((state.status === "play") && noifplay) {
         self.wakeupScreen();
      } else if (((state.status !== "play") && (timeout != 0)) || ((state.status === "play") && (!noifplay))) {
         self.sleepScreen();
      }
   } catch (err) {
      self.logger.error(logPrefix + " Failed to apply screensaver immediately: " + err);
   }
}, 500);

};


vkiosksettings.prototype.detectTouchscreen = function () {
   const self = this;
   const display = self.getDisplaynumber();

   return new Promise((resolve, reject) => {
      exec(`DISPLAY=${display} xinput list`, (error, stdout, stderr) => {
         if (error) {
            return reject(`xinput error: ${stderr || error.message}`);
         }

         const lines = stdout.split("\n");

         // Find all lines containing "touchscreen"
         const matches = lines.filter(line =>
            /touchscreen/i.test(line)
         );

         if (matches.length === 0) {
            return resolve(null); // no touchscreen found
         }

         // Extract IDs and names
         const devices = matches.map(line => {
            const idMatch = line.match(/id=(\d+)/);
            const id = idMatch ? idMatch[1] : null;
            const name = line.replace(/\s*id=\d+.*/, "").trim();
            return { id, name };
         });

         self.logger.info(logPrefix + " Touchscreens detected: " + JSON.stringify(devices));
         resolve(devices[0].id || devices[0].name);
      });
   });
};

vkiosksettings.prototype.applyscreensettings = async function () {
   const self = this;
   const display = self.getDisplaynumber();

   const rotatescreen = self.config.get("rotatescreen").value;
   const touchcorrection = self.config.get("touchcorrection").value;
   const hidecursor = self.config.get("hidecursor");

   const phidecursor = hidecursor
      ? "unclutter-xfixes -idle 3 -root"
      : "pkill unclutter";

   try {
      // ✅ Detect touchscreen
      const touchscreenId = await self.detectTouchscreen();
      self.logger.info(logPrefix + ` Detected touchscreen: ${touchscreenId || "none"}`);

      // ✅ Detect connected screen
      const screen = await self.detectConnectedScreen();
      if (!screen) {
         self.logger.error(logPrefix + " No connected screen detected, skipping rotation.");
      }

      // Build touch matrix
      let matrix = "1 0 0  0 1 0  0 0 1";
      switch (touchcorrection) {
         case "swap-lr": matrix = "0 -1 1  1 0 0  0 0 1"; break;
         case "swap-ud": matrix = "-1 0 1  0 -1 1  0 0 1"; break;
         case "swap-both": matrix = "0 1 0  -1 0 1  0 0 1"; break;
      }

      // ✅ Apply rotation only if screen found
      if (screen) {
         exec(`DISPLAY=${display} xrandr --output ${screen} --rotate ${rotatescreen}`);
      }

      // ✅ Apply touchscreen correction
      if (touchscreenId) {
         exec(`DISPLAY=${display} xinput set-prop ${touchscreenId} "Coordinate Transformation Matrix" ${matrix}`);
      }

      // ✅ Hide cursor if requested
      exec(`DISPLAY=${display} ${phidecursor}`);

      return; // success
   } catch (err) {
      self.logger.error(logPrefix + " applyscreensettings error: " + err);
      throw err;
   }
};
