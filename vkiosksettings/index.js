//vkiosksettings - balbuze September 2025
'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var libFsExtra = require('fs-extra');
var config = new (require('v-conf'))();
//var exec = require('child_process').exec;
const { exec } = require("child_process");

var execSync = require('child_process').execSync;
var spawn = require('child_process').spawn;
const io = require('socket.io-client');
const path = require("path");
const logPrefix = "Display-configuration --- "
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
   defer.resolve();
   return defer.promise;
};

vkiosksettings.prototype.onStart = function () {
   const self = this;
   const defer = libQ.defer();

   self.socket = io.connect('http://localhost:3000');
   self.fixXauthority();

   // Delay to ensure X server is ready

   setTimeout(async function () {
      self.checkIfPlay();
      const display = self.getDisplaynumber();
      await self.applyscreensettings();
      self.monitorLid(); // start monitoring lid events
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

vkiosksettings.prototype.getUIConfig = function () {
   var defer = libQ.defer();
   var self = this;

   var lang_code = this.commandRouter.sharedVars.get('language_code');

   self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
      .then(async function (uiconf) {

         var rvalue = self.config.get('rotatescreen') || { value: "normal", label: "normal" };

         self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', rvalue.value);
         self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label', rvalue.label);

         let touchscreenId = await self.detectTouchscreen();
         let touchDevices = await self.detectTouchscreen();
         if (!touchDevices || touchDevices.length === 0) {
            uiconf.sections[0].content[1].hidden = true;
         }


         var tcvalue = self.config.get('touchcorrection') || { value: "none", label: "none" };

         self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', tcvalue.value);
         self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label', tcvalue.label);

         var brightness = self.config.get('brightness');
         // self.logger.info(logPrefix+' brightness UI ' + brightness)
         uiconf.sections[0].content[2].config.bars[0].value = brightness;


         var hidecursor = self.config.get('hidecursor', false);
         uiconf.sections[0].content[3].value = hidecursor;


         var xsvalue = self.config.get('screensavertype') || { value: "dpms", label: "dpms" };

         self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.value', xsvalue.value);
         self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.label', xsvalue.label);

         uiconf.sections[0].content[6].value = self.config.get('timeout');
         uiconf.sections[0].content[6].attributes = [
            {
               placeholder: 120,
               maxlength: 4,
               min: 0,
               max: 1000
            }
         ];

         uiconf.sections[0].content[7].value = self.config.get('noifplay');

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

vkiosksettings.prototype.ensureXscreensaver = function () {
   const self = this;
   const display = self.getDisplaynumber();

   exec("pgrep xscreensaver", (err, stdout) => {
      if (stdout && stdout.trim().length > 0) {
         self.logger.info(logPrefix + " xscreensaver already running (pid " + stdout.trim() + ")");
      } else {
         exec(`DISPLAY=${display} xscreensaver -nosplash &`);
         self.logger.info(logPrefix + " xscreensaver started (using ~/.xscreensaver settings)");
      }
   });
};

vkiosksettings.prototype.monitorLid = function () {
   const self = this;
   const display = self.getDisplaynumber();

   // Detect all lid devices dynamically
   const lidPaths = [];
   const acpiPath = '/proc/acpi/button/lid/';
   if (fs.existsSync(acpiPath)) {
      const lids = fs.readdirSync(acpiPath);
      lids.forEach(lid => {
         const statePath = path.join(acpiPath, lid, 'state');
         if (fs.existsSync(statePath)) lidPaths.push(statePath);
      });
   }

   if (lidPaths.length === 0) {
      self.logger.warn(logPrefix + " No ACPI lid devices detected, lid monitoring disabled.");
      return;
   }

   self.logger.info(logPrefix + ` Monitoring lid(s): ${lidPaths.join(', ')}`);
   let lidClosed = false;

   setInterval(() => {
      try {
         let anyClosed = false;
         for (const lidFile of lidPaths) {
            const state = fs.readFileSync(lidFile, 'utf8').trim();
            if (state.toLowerCase().includes('closed')) anyClosed = true;
         }

         if (anyClosed && !lidClosed) {
            lidClosed = true;
            self.logger.info(logPrefix + " Lid closed — turning screen off via DPMS");
            exec(`/usr/bin/xset -display ${display} dpms force off`);
         } else if (!anyClosed && lidClosed) {
            lidClosed = false;
            self.logger.info(logPrefix + " Lid opened — turning screen on via DPMS");
            exec(`/usr/bin/xset -display ${display} dpms force on`);
         }
      } catch (err) {
         self.logger.error("Error reading lid state: " + err);
      }
   }, 1000); // check every 1 second
};



vkiosksettings.prototype.checkIfPlay = function () {
   const self = this;
   const display = self.getDisplaynumber();

   // Disable DPMS at start
   exec(`/usr/bin/xset -display ${display} -dpms`, () => {
      self.logger.info(logPrefix + " DPMS disabled before playback state check");
   });

   // Kill any leftover xscreensaver instances (clean start)
   exec("pkill -9 xscreensaver || true", () => {
      self.logger.info(logPrefix + " xscreensaver cleaned up before starting");
   });

   // 🔹 Start xscreensaver immediately if selected
   const screensavertype = self.config.get("screensavertype").value;
   if (screensavertype === "xscreensaver") {
      self.ensureXscreensaver();
   }

   // 🎵 Listen for Volumio playback state
   self.socket.on("pushState", function (data) {
      const timeout = self.config.get("timeout") || 0;
      const noifplay = self.config.get("noifplay");
      const screensavertype = self.config.get("screensavertype").value;

      self.logger.info(
         `${logPrefix} Volumio status=${data.status} timeout=${timeout} noifplay=${noifplay} screensavertype=${screensavertype}`
      );

      // ---- Wake conditions ----
      if ((data.status === "play" && noifplay) || timeout === 0 && screensavertype === "dpms") {
         self.wakeupScreen();
         self.logger.info(`${logPrefix} → Wakeup triggered`);
         return;
      }

      // ---- Sleep (DPMS) ----
      if (data.status !== "play" && timeout !== 0 && screensavertype === "dpms") {
         setTimeout(() => {
            if (self.lastState !== "play") {
               self.sleepScreen();
               self.logger.info(`${logPrefix} → Sleep (DPMS) triggered after ${timeout}s`);
            }
         }, timeout * 1000);
         return;
      }

      // ---- Sleep (xscreensaver) ----
      if (data.status !== "play" && screensavertype === "xscreensaver") {
         self.sleepScreen();
         self.logger.info(`${logPrefix} → Sleep (xscreensaver) triggered`);
         return;
      }

      self.logger.info(`${logPrefix} → No action taken`);
   });
};


vkiosksettings.prototype.sleepScreen = function () {
   const self = this;
   const display = self.getDisplaynumber();
   const screensavertype = self.config.get("screensavertype").value;
   const timeout = self.config.get('timeout');

   try {
      if (screensavertype === "dpms") {
         // Use DPMS to force screen off
         exec(`/usr/bin/xset -display ${display} s 0 0 +dpms dpms 0 0 ${timeout}`);
         self.logger.info(logPrefix + " sleepScreen: DPMS → screen");
      } else if (screensavertype === "xscreensaver") {
         // Use xscreensaver to blank/activate
         exec(`DISPLAY=${display} xscreensaver -nosplash`, () => {
            self.logger.info(logPrefix + " wakeupScreen: xscreensaver restarted");
         });
         //  exec(`DISPLAY=${display} xscreensaver-command -activate`);
         //  self.logger.info(logPrefix + " sleepScreen: xscreensaver → activate");
      } else {
         self.logger.warn(logPrefix + " sleepScreen: Unknown screensaver type, doing nothing");
      }
   } catch (err) {
      self.logger.error(logPrefix + " sleepScreen error: " + err);
   }
};


vkiosksettings.prototype.wakeupScreen = function () {
   const self = this;
   const display = self.getDisplaynumber();
   const screensavertype = self.config.get("screensavertype").value;

   try {
      if (screensavertype === "dpms") {
         // Wake DPMS screen
         exec(`/usr/bin/xset -display ${display} -dpms`);
         self.logger.info(logPrefix + " wakeupScreen: DPMS → screen on");
      } else if (screensavertype === "xscreensaver") {
         // Disable xscreensaver blanking
         exec("pkill -9 xscreensaver || true", () => {
            self.logger.info(logPrefix + " sleepScreen: xscreensaver killed");
         });

      } else {
         self.logger.warn(logPrefix + " wakeupScreen: Unknown screensaver type, doing nothing");
      }
   } catch (err) {
      self.logger.error(logPrefix + " wakeupScreen error: " + err);
   }
};

vkiosksettings.prototype.xscreensettings = function (data) {
   const self = this;
   const defer = libQ.defer();

   const display = self.getDisplaynumber();

   exec(`pkill -f xscreensaver-demo || true`);
   exec("pkill -9 xscreensaver || true")

   // exec(`DISPLAY=${display} xscreensaver-command -deactivate`);

   const cmd = `DISPLAY=${display} xscreensaver-demo`;
   exec(cmd, { uid: 1000, gid: 1000 }, (error, stdout, stderr) => {
      if (error) {
         self.logger.error(logPrefix + ": Failed to start xscreensaver-demo: " + error);
         defer.reject(error);
      } else {
         self.logger.info(logPrefix + `: xscreensaver-demo started on display ${display}`);
         defer.resolve();
      }
   });

   return defer.promise;
};

vkiosksettings.prototype.setBrightness = function () {
   const self = this;
   const display = self.getDisplaynumber();
   var value = self.config.get('brightness')
   // Clamp between 0.1 and 1.0 (xrandr rejects 0 or >1)
   const brightness = Math.max(0.1, Math.min(1.0, value));

   try {
      // Detect connected screen
      self.detectConnectedScreen().then((screen) => {
         if (!screen) {
            self.logger.error(logPrefix + " No connected screen found for brightness change");
            return;
         }

         exec(`DISPLAY=${display} xrandr --output ${screen} --brightness ${brightness}`, (err) => {
            if (err) {
               self.logger.error(logPrefix + " Failed to set brightness: " + err);
            } else {
               self.logger.info(logPrefix + ` Brightness set to ${brightness} for screen ${screen}`);
            }
         });
      });
   } catch (err) {
      self.logger.error(logPrefix + " setBrightness error: " + err);
   }
};


vkiosksettings.prototype.savescreensettings = function (data) {
   const self = this;

   var brightness = (data['brightness']);
   //      self.logger.error(logPrefix + " setBrightness error: " + brightness);

   self.config.set('rotatescreen', {
      value: data['rotatescreen'].value,
      label: data['rotatescreen'].label
   });

   self.config.set('touchcorrection', {
      value: data['touchcorrection'].value,
      label: data['touchcorrection'].label
   });
   self.config.set('brightness', brightness)
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
   self.config.set('screensavertype', {
      value: data['screensavertype'].value,
      label: data['screensavertype'].label
   });
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
   }, 1500);

};

vkiosksettings.prototype.applyscreensettings = async function () {
   const self = this;

   await this.applyRotation();
   await this.applyTouchCorrection();
   this.applyCursorSetting();
   self.setBrightness();

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

         // Match all possible touch input types
         const matches = lines.filter(line =>
            /(touchscreen|touch|finger|multitouch|pen|stylus)/i.test(line)
         );

         if (matches.length === 0) {
            return resolve([]); // no touch-like devices
         }

         // Extract IDs and names
         const devices = matches.map(line => {
            const idMatch = line.match(/id=(\d+)/);
            const id = idMatch ? idMatch[1] : null;
            const name = line.replace(/\s*id=\d+.*/, "").trim();
            return { id, name };
         }).filter(dev => dev.id); // keep only valid ones

         self.logger.info(logPrefix + " Touch devices detected: " + JSON.stringify(devices));

         resolve(devices); // return all devices (array of {id, name})
      });
   });
};



// 1. Rotate screen
vkiosksettings.prototype.applyRotation = async function () {
   const self = this;
   const display = self.getDisplaynumber();
   const rotatescreen = self.config.get("rotatescreen").value;

   try {
      const screen = await self.detectConnectedScreen();
      if (!screen) {
         self.logger.error(logPrefix + " No connected screen detected, skipping rotation.");
         return;
      }
      exec(`DISPLAY=${display} xrandr --output ${screen} --rotate ${rotatescreen}`);
      self.logger.info(logPrefix + ` Rotation applied: ${rotatescreen}`);
   } catch (err) {
      self.logger.error(logPrefix + " applyRotation error: " + err);
   }
};

vkiosksettings.prototype.applyTouchCorrection = async function () {
   const self = this;
   const display = self.getDisplaynumber();
   const touchcorrection = self.config.get("touchcorrection").value;

   try {
      const touchDevices = await self.detectTouchscreen();
      if (!touchDevices || touchDevices.length === 0) {
         self.logger.info(logPrefix + " No touchscreen detected, skipping correction.");
         return;
      }

      let matrix = "1 0 0  0 1 0  0 0 1";
      switch (touchcorrection) {
         case "swap-lr": matrix = "0 -1 1  1 0 0  0 0 1"; break;
         case "swap-ud": matrix = "-1 0 1  0 -1 1  0 0 1"; break;
         case "swap-both": matrix = "0 1 0  -1 0 1  0 0 1"; break;
      }

      for (let dev of touchDevices) {
         exec(`DISPLAY=${display} xinput set-prop ${dev.id} "Coordinate Transformation Matrix" ${matrix}`,
            (error, stdout, stderr) => {
               if (error) {
                  if (stderr.includes("property") || stderr.includes("failed")) {
                     self.logger.warn(logPrefix + ` Touch device ${dev.name} (id=${dev.id}) does not support matrix transform`);
                  } else {
                     self.logger.error(logPrefix + ` Failed to apply correction to ${dev.name} (id=${dev.id}): ${error.message}`);
                  }
               } else {
                  self.logger.info(logPrefix + ` Touch correction applied: ${touchcorrection} to ${dev.name} (id=${dev.id})`);
               }
            });
      }
   } catch (err) {
      self.logger.error(logPrefix + " applyTouchCorrection error: " + err);
   }
};


// 3. Handle cursor hiding
vkiosksettings.prototype.applyCursorSetting = function () {
   const self = this;
   const display = self.getDisplaynumber();
   const hidecursor = self.config.get("hidecursor");

   try {
      // Stop any existing unclutter processes first
      exec("/bin/echo volumio | /usr/bin/sudo -S pkill -9 -f unclutter", { uid: 1000, gid: 1000 }, (err) => {
         if (err) self.logger.info(logPrefix + " No unclutter process to stop");

         if (hidecursor) {
            // Start unclutter as volumio user
            exec(`/bin/echo volumio | /usr/bin/sudo -S DISPLAY=${display} unclutter-xfixes -idle 3`, { uid: 1000, gid: 1000 }, (err2) => {
               if (err2) {
                  self.logger.error(logPrefix + " Error starting unclutter: " + err2);
               } else {
                  self.logger.info(logPrefix + " unclutter started as volumio user");
               }
            });
         } else {
            self.logger.info(logPrefix + " unclutter stopped");
         }
      });

   } catch (err) {
      self.logger.error(logPrefix + " applyCursorSetting error: " + err);
   }
};
