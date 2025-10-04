//display_configuration - balbuze September 2025
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
const boot_screen_rotation = "/data/plugins/user_interface/display_configuration/rotation.cfg";
const logPrefix = "Display-configuration --- ";
// Define the display_configuration class
module.exports = display_configuration;


function display_configuration(context) {
   var self = this;
   self.context = context;
   self.commandRouter = self.context.coreCommand;
   self.logger = self.commandRouter.logger;
   this.context = context;
   this.commandRouter = this.context.coreCommand;
   this.logger = this.context.logger;
   this.configManager = this.context.configManager;
};

display_configuration.prototype.onVolumioStart = function () {
   var self = this;
   var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
   this.config = new (require('v-conf'))();
   this.config.loadFile(configFile);
   return libQ.resolve();
};

display_configuration.prototype.getConfigurationFiles = function () {
   var self = this;
   return ['config.json'];
};

display_configuration.prototype.onStop = function () {
   var self = this;
   var defer = libQ.defer();
   self.removeRotationConfig();
   defer.resolve();
   return defer.promise;
};

display_configuration.prototype.onStart = function () {
   const self = this;
   const defer = libQ.defer();

   self.socket = io.connect('http://localhost:3000');
   self.fixXauthority();

   // Delay to ensure X server is ready

   setTimeout(async function () {
      self.checkIfPlay();
      const display = self.getDisplaynumber();
      await self.applyscreensettingsboot();
      self.monitorLid(); // start monitoring lid events
   }, 100);

   defer.resolve();
   return defer.promise;
};

display_configuration.prototype.onRestart = function () {
   var self = this;
   //
};

display_configuration.prototype.onInstall = function () {
   var self = this;

   //Perform your installation tasks here
};

display_configuration.prototype.onUninstall = function () {
   var self = this;
   self.removeRotationConfig();

};

display_configuration.prototype.getUIConfig = function () {
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


display_configuration.prototype.refreshUI = function () {
   const self = this;

   setTimeout(function () {
      var respconfig = self.commandRouter.getUIConfigOnPlugin('user_interface', 'display_configuration', {});
      respconfig.then(function (config) {
         self.commandRouter.broadcastMessage('pushUiConfig', config);
      });
      self.commandRouter.closeModals();
   }, 100);
}

display_configuration.prototype.setUIConfig = function (data) {
   var self = this;
   //Perform your installation tasks here
};

display_configuration.prototype.getConf = function (varName) {
   var self = this;
   //Perform your installation tasks here
};

display_configuration.prototype.setConf = function (varName, varValue) {
   var self = this;
   //Perform your installation tasks here
};

// Define once
display_configuration.prototype.getDisplaynumber = function () {
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

display_configuration.prototype.detectConnectedScreen = function () {
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

display_configuration.prototype.writeRotationConfig = function (screen, orientation, fbRotate) {
   const self = this;

   return new Promise((resolve, reject) => {
      // Always overwrite with the new values
      const content =
         `set screen=video=${screen}:panel_orientation=${orientation}\n` +
         `set efifb=video=efifb\n` +
         `set fbcon=rotate:${fbRotate}\n`;

      // Spawn tee to write into the file
      const child = spawn("tee", [boot_screen_rotation], { stdio: ["pipe", "ignore", "pipe"] });

      let stderr = "";
      child.stderr.on("data", chunk => {
         stderr += chunk.toString();
      });

      child.on("close", code => {
         if (code !== 0) {
            self.logger.error(logPrefix + ` tee exited with code ${code} stderr: ${stderr.trim()}`);
            return reject(new Error(stderr.trim() || `tee exit ${code}`));
         }
         self.logger.info(
            logPrefix +
            ` Rotation config saved for Grub: screen=${screen}, orientation=${orientation}, fbcon=${fbRotate}`
         );
         resolve();
      });

      // send the content into tee's stdin
      child.stdin.write(content);
      child.stdin.end();
   });
};

display_configuration.prototype.removeRotationConfig = function () {
   const self = this;

   return new Promise((resolve, reject) => {
      fs.unlink(boot_screen_rotation, (err) => {
         if (err) {
            if (err.code === "ENOENT") {
               self.logger.warn(logPrefix + ` Rotation config not found: ${boot_screen_rotation}`);
               return resolve();
            }
            self.logger.error(logPrefix + ` Failed to remove rotation config: ${err.message}`);
            return reject(err);
         }

         self.logger.info(logPrefix + ` Rotation config removed: ${boot_screen_rotation}`);
         self.commandRouter.pushToastMessage(
            "error",
            "Plugin stopped!!!",
            "Please Reboot now!."
         );
         resolve();
      });
   });
};


display_configuration.prototype.fixXauthority = function () {
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

display_configuration.prototype.drmForcesOrientation = null;


// Function to check and store
display_configuration.prototype.checkDrmOrientation = async function (screen) {
   const self = this;

   try {
      const dmesgOutput = await new Promise((resolve) => {
         exec("dmesg | grep drm", (error, stdout) => {
            if (error) return resolve("");
            resolve(stdout);
         });
      });

      const drmLine = dmesgOutput.split("\n").find(line =>
         new RegExp(`\\[drm\\].*connector ${screen} panel_orientation to 1`).test(line)
      );

      self.drmForcesOrientation = !!drmLine; // store true/false
      if (self.drmForcesOrientation) {
         self.logger.info(logPrefix + ` Kernel forces orientation for ${screen} (line: "${drmLine.trim()}")`);
      } else {
         self.logger.info(logPrefix + ` No forced DRM orientation detected for ${screen}`);
      }

   } catch (err) {
      self.logger.error(logPrefix + " checkDrmOrientation error: " + err.message);
      self.drmForcesOrientation = false;
   }

   return self.drmForcesOrientation;
};


display_configuration.prototype.ensureXscreensaver = function () {
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

display_configuration.prototype.monitorLid = function () {
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



display_configuration.prototype.checkIfPlay = function () {
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
display_configuration.prototype.sleepScreen = function () {
   const self = this;
   const display = self.getDisplaynumber();
   const screensavertype = self.config.get("screensavertype").value;
   const timeout = self.config.get("timeout");

   try {
      if (screensavertype === "dpms") {
         // Put screen to sleep via DPMS
         exec(`/usr/bin/xset -display ${display} s 0 0 +dpms dpms 0 0 ${timeout}`);
         self.logger.info(logPrefix + " sleepScreen: DPMS → screen off in " + timeout + "s");

      } else if (screensavertype === "xscreensaver") {
         // stop keepalive when we want xscreensaver active
         if (self._xscreensaverInterval) {
            clearInterval(self._xscreensaverInterval);
            self._xscreensaverInterval = null;
         }

         // Ensure xscreensaver daemon is running
         exec(`pgrep xscreensaver || (DISPLAY=${display} xscreensaver -no-splash &)`, (error) => {
            if (error) {
               self.logger.error(logPrefix + " sleepScreen: failed to ensure xscreensaver is running → " + error);
            }
         });

         // Then activate the screensaver
         exec(`DISPLAY=${display} xscreensaver-command -activate`, (error) => {
            if (error) {
               self.logger.warn(logPrefix + " sleepScreen: xscreensaver not running or failed → " + error.message);
               return;
            }
            self.logger.info(logPrefix + " sleepScreen: xscreensaver activated (screen blanked)");
         });

      } else {
         self.logger.warn(logPrefix + " sleepScreen: Unknown screensaver type, doing nothing");
      }
   } catch (err) {
      self.logger.error(logPrefix + " sleepScreen error: " + err);
   }
};

display_configuration.prototype.wakeupScreen = function () {
   const self = this;
   const display = self.getDisplaynumber();
   const screensavertype = self.config.get("screensavertype").value;

   try {
      if (screensavertype === "dpms") {

         // Wake DPMS screen
         exec(`/usr/bin/xset -display ${display} -dpms`);
         self.logger.info(logPrefix + " wakeupScreen: DPMS → screen on");

      } else if (screensavertype === "xscreensaver") {
         // tell xscreensaver to disable blanking (instead of killing)
         exec(`DISPLAY=${display} xscreensaver-command -deactivate`, (error) => {
            if (error) {
               self.logger.error(logPrefix + " wakeupScreen: Failed to deactivate xscreensaver → " + error);
            } else {
               self.logger.info(logPrefix + " wakeupScreen: xscreensaver deactivated (screen on)");
            }
         });

         // periodically deactivate xscreensaver to keep screen awake
         if (!self._xscreensaverInterval) {
            self._xscreensaverInterval = setInterval(() => {
               exec(`pgrep -x xscreensaver`, (checkErr, stdout) => {
                  if (checkErr || !stdout) {
                     // Not running → skip silently
                     self.logger.debug(logPrefix + " keepAlive: xscreensaver not running, skipping deactivate");
                     return;
                  }

                  exec(`DISPLAY=${display} xscreensaver-command -deactivate`, (error) => {
                     if (error) {
                        self.logger.warn(logPrefix + " keepAlive: xscreensaver deactivate failed → " + error.message);
                     } else {
                        self.logger.debug(logPrefix + " keepAlive: xscreensaver deactivated");
                     }
                  });
               });
            }, 2100); // every ~2s
         }


      } else {
         self.logger.warn(logPrefix + " wakeupScreen: Unknown screensaver type, doing nothing");
      }
   } catch (err) {
      self.logger.error(logPrefix + " wakeupScreen error: " + err);
   }
};


/*
display_configuration.prototype.xscreensettings = function (data) {
   const self = this;
   const defer = libQ.defer();

   const display = self.getDisplaynumber();

   exec(`pkill -f xscreensaver-settings || true`);
   exec("pkill -9 xscreensaver || true")

   // exec(`DISPLAY=${display} xscreensaver-command -deactivate`);

   const cmd = `DISPLAY=${display} xscreensaver-settings`;
   exec(cmd, { uid: 1000, gid: 1000 }, (error, stdout, stderr) => {
      if (error) {
         self.logger.error(logPrefix + ": Failed to start xscreensaver-settings: " + error);
         defer.reject(error);
      } else {
         self.logger.info(logPrefix + `: xscreensaver-settings started on display ${display}`);
         defer.resolve();
      }
   });

   return defer.promise;
};

*/display_configuration.prototype.xscreensettings = function (data) {
   const self = this;
   const defer = libQ.defer();
   const display = self.getDisplaynumber();

   // 1. Kill any previous instances (daemon + settings GUI)
   exec("pkill -f xscreensaver-settings; pkill -f xscreensaver", (killErr) => {
      if (killErr) {
         self.logger.warn(logPrefix + " xscreensettings: no previous xscreensaver processes to kill");
      } else {
         self.logger.info(logPrefix + " xscreensettings: previous xscreensaver processes killed");
      }

      // 2. Start daemon cleanly
      exec(`DISPLAY=${display} xscreensaver -no-splash &`, { uid: 1000, gid: 1000 }, (error) => {
         if (error) {
            self.logger.error(logPrefix + ": Failed to start xscreensaver daemon: " + error);
         } else {
            self.logger.info(logPrefix + ": xscreensaver daemon started");
         }

         // 3. Deactivate so the screen is "on" when settings open
         exec(`DISPLAY=${display} xscreensaver-command -deactivate`, (error) => {
            if (error) {
               self.logger.warn(logPrefix + " xscreensettings: Failed to deactivate xscreensaver → " + error);
            } else {
               self.logger.info(logPrefix + " xscreensettings: xscreensaver deactivated (screen on)");
            }
         });

         // 4. Finally launch the settings GUI
         const cmd = `DISPLAY=${display} xscreensaver-settings`;
         exec(cmd, { uid: 1000, gid: 1000 }, (error, stdout, stderr) => {
            if (error) {
               self.logger.error(logPrefix + ": Failed to start xscreensaver-settings: " + error);
               defer.reject(error);
            } else {
               self.logger.info(logPrefix + `: xscreensaver-settings started on display ${display}`);
               defer.resolve();
            }
         });
      });
   });

   return defer.promise;
};


display_configuration.prototype.setBrightnessSoft = function () {
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
               self.logger.info(logPrefix + ` Brightness set to ${brightness * 100}% for screen ${screen}`);
            }
         });
      });
   } catch (err) {
      self.logger.error(logPrefix + " setBrightness error: " + err);
   }
};

//not use yet!!!! Needs to set backlight=native in grub.cfg
display_configuration.prototype.setBrightness = function () {

   const self = this;
   const backlightDir = "/sys/class/backlight";
   var percent = self.config.get('brightness') * 100
   //     self.logger.warn(logPrefix + " percent "+percent);


   return new Promise((resolve, reject) => {
      fs.readdir(backlightDir, (err, devices) => {
         if (err || !devices || devices.length === 0) {
            self.logger.warn(logPrefix + " No backlight device found, brightness control unavailable. Falling back to Soft Brightness");
            self.setBrightnessSoft();
            return resolve(false);
         }

         // Pick the first device (can extend to handle multiple)
         const device = devices[0];
         const maxPath = path.join(backlightDir, device, "max_brightness");
         const curPath = path.join(backlightDir, device, "brightness");

         fs.readFile(maxPath, "utf8", (err, data) => {
            if (err) {
               self.logger.error(logPrefix + " Failed to read max_brightness: " + err);
               return reject(err);
            }

            const maxBrightness = parseInt(data.trim(), 10);
            if (isNaN(maxBrightness) || maxBrightness <= 0) {
               self.logger.error(logPrefix + " Invalid max_brightness value");
               return reject(new Error("Invalid max_brightness"));
            }

            // Clamp percent
            let pct = Math.max(0, Math.min(100, parseInt(percent, 10)));
            const newValue = Math.round((pct / 100) * maxBrightness);

            exec(`echo ${newValue} | sudo tee ${curPath}`, (error, stdout, stderr) => {
               if (error) {
                  self.logger.error(logPrefix + " Failed to set brightness: " + stderr || error.message);
                  return reject(error);
               }

               self.logger.info(logPrefix + ` Brightness set to ${pct}% (${newValue}/${maxBrightness}) on ${device}`);
               resolve(true);
            });
         });
      });
   });
};



display_configuration.prototype.savescreensettings = function (data) {
   const self = this;

   var brightness = (data['brightness']);
   //      self.logger.error(logPrefix + " setBrightness error: " + brightness);
   const [rotation, fbconv, po] = data['rotatescreen'].value.split(":");

   self.config.set('rotatescreen', {
      value: rotation,
      fbconv: fbconv,
      po: po,
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
            "success",
            "Settings applied!"
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

      if (data['screensavertype'].value === 'dpms') {
         exec("pkill -f xscreensaver-settings || true");
         exec("pkill -f xscreensaver || true");
      }

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
   }, 100);

};


display_configuration.prototype.applyscreensettingsboot = async function () {
   const self = this;

   // detect screen before using it
   const screen = await this.detectConnectedScreen();

   await this.checkDrmOrientation(screen);

   if (this.drmForcesOrientation) {
      self.logger.warn(
         logPrefix + ` Kernel already forces orientation → skipping xrandr`
      );
   } else {
      await this.applyRotation();
      self.logger.info(logPrefix + ` Panel Rotation applied`);
   }

   await this.applyTouchCorrection();
   this.applyCursorSetting();
   self.setBrightness();
};


display_configuration.prototype.applyscreensettings = async function () {
   const self = this;

   await this.applyRotation();
   await this.applyTouchCorrection();
   this.applyCursorSetting();
   self.setBrightness();

};


display_configuration.prototype.detectTouchscreen = function () {
   const self = this;
   const display = self.getDisplaynumber();

   return new Promise((resolve, reject) => {
      exec(`DISPLAY=${display} xinput list`, (error, stdout, stderr) => {
         if (error) {
            return reject(`xinput error: ${stderr || error.message}`);
         }

         const lines = stdout.split("\n");

         // Match all possible touchscreen or touchpad candidates
         const matches = lines.filter(line =>
            /touch|touchscreen|finger|multitouch|stylus|goodix|synp|elan|ft5406|maxtouch|wacom|ntrg|egalax|ilitek|touchpad|mouse/i.test(line)
         );

         if (matches.length === 0) {
            return resolve([]); // none found
         }

         // Extract IDs and names
         const devices = matches.map(line => {
            const idMatch = line.match(/id=(\d+)/);
            const id = idMatch ? idMatch[1] : null;
            const name = line.replace(/\s*id=\d+.*/, "").trim();
            return { id, name };
         }).filter(dev => dev.id);

         self.logger.info(logPrefix + " Touch-related devices detected: " + JSON.stringify(devices));
         resolve(devices); // return ALL devices
      });
   });
};

/**
 * Helper: find device id from xinput by name
 */
display_configuration.prototype.getDeviceId = async function (deviceName) {
   try {
      const { stdout } = await execAsync(`xinput list | grep -F '${deviceName}'`);
      const match = stdout.match(/id=(\d+)/);
      return match ? match[1] : null;
   } catch {
      return null;
   }
};

// 1. Rotate screen
display_configuration.prototype.applyRotation = async function () {
   const self = this;
   const display = self.getDisplaynumber();

   const rotateConf = self.config.get("rotatescreen") || {};
   const rotatescreen = rotateConf.value || "normal";

   // fallback mapping if fields are missing
   const rotationMap = {
      normal: { fbconv: 0, po: "normal" },
      inverted: { fbconv: 2, po: "upside_down" },
      right: { fbconv: 1, po: "right_side_up" },
      left: { fbconv: 3, po: "left_side_up" }
   };

   const map = rotationMap[rotatescreen] || rotationMap["normal"];
   const fbconv = rotateConf.fbconv !== undefined ? rotateConf.fbconv : map.fbconv;
   const orientation = rotateConf.po || map.po;   // <-- always used for grub config

   const screen = await self.detectConnectedScreen();

   //await this.checkDrmOrientation(screen);
   let runtimeRotate = rotatescreen;

   // 2. Later reuse the stored value
   if (this.drmForcesOrientation) {
      // If kernel already forces orientation, flip the runtime xrandr direction
      if (rotatescreen === "normal") {
         runtimeRotate = "inverted";
      } else if (rotatescreen === "left") {
         runtimeRotate = "right";
      } else if (rotatescreen === "right") {
         runtimeRotate = "left";
      } else if (rotatescreen === "inverted") {
         runtimeRotate = "normal";
      }

      self.logger.warn(
         logPrefix + ` Kernel forces orientation for ${screen} → adjusting xrandr fake orientation`
      );
   }

   // Always update boot config with original orientation
   try {
      await this.writeRotationConfig(screen, orientation, fbconv);
   } catch (err) {
      self.logger.error(logPrefix + " applyRotation grub error: " + err);
   }

   //  Apply runtime rotation (possibly adjusted if kernel forces one)
   try {
      if (!screen) {
         self.logger.error(logPrefix + " No connected screen detected, skipping rotation.");
         return;
      }
      exec(`DISPLAY=${display} xrandr --output ${screen} --rotate ${runtimeRotate}`);
      self.logger.info(logPrefix + ` Runtime rotation applied: ${runtimeRotate} | Boot config (po=${orientation}, fbconv=${fbconv})`);
   } catch (err) {
      self.logger.error(logPrefix + " applyRotation error: " + err);
   }
};

// Run a shell command and return output
function runCommand(cmd) {
   return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
         if (error) return reject(new Error(stderr || error.message));
         resolve(stdout);
      });
   });
}

// Get screen resolution from xrandr
async function getScreenGeometry(screen) {
   try {
      const output = await runCommand(`xrandr | grep "^${screen}"`);
      const match = output.match(/(\d+)x(\d+)/);
      if (match) {
         return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
      }
   } catch {
      return { width: 0, height: 0 };
   }
   return { width: 0, height: 0 };
}

// Grab a single touch event (requires user tap)
async function getSampleTouch(devId) {
   try {
      const cmd = `timeout 2 xinput test-xi2 ${devId} | grep -m1 "valuator"`;
      const line = await runCommand(cmd);
      const coords = line.match(/valuator\[0\]=([0-9.]+).*valuator\[1\]=([0-9.]+)/);
      if (coords) {
         return { x: parseFloat(coords[1]), y: parseFloat(coords[2]) };
      }
   } catch {
      return null;
   }
   return null;
}

// Detect if touchscreen axes are inverted vs. screen
display_configuration.prototype.detectTouchInversion = async function (devId, screen) {
   const geom = await getScreenGeometry(screen);
   const touch = await getSampleTouch(devId);

   if (!geom.width || !geom.height || !touch) {
      this.logger.warn(logPrefix + " Could not detect inversion (missing geometry or touch).");
      return { invertX: false, invertY: false };
   }

   let invertX = false;
   let invertY = false;

   // If touching near left → reported near max X → inverted
   if (touch.x > geom.width * 0.8) invertX = true;
   // If touching near top → reported near max Y → inverted
   if (touch.y > geom.height * 0.8) invertY = true;

   this.logger.info(logPrefix + ` Inversion detected: invertX=${invertX}, invertY=${invertY}`);
   return { invertX, invertY };
};


// 2. rotate touchsscreenn
display_configuration.prototype.applyTouchCorrection = async function () {
   const self = this;
   const display = self.getDisplaynumber();
   const screen = await self.detectConnectedScreen();
   const touchcorrection = this.config.get("touchcorrection").value;
   const rotatescreen = (this.config.get("rotatescreen")?.value) || "normal";

   // Inline helper
   const runCommand = (cmd) =>
      new Promise((resolve, reject) => {
         exec(cmd, (error, stdout, stderr) => {
            if (error) return reject(new Error(stderr || error.message));
            resolve(stdout);
         });
      });

   // rotation matrices (screen orientation)
   const rotationMatrices = {
      normal:   [ [1,0,0], [0,1,0], [0,0,1] ],
      inverted: [ [-1,0,1], [0,-1,1], [0,0,1] ],
      left:     [ [0,-1,1], [1,0,0], [0,0,1] ],
      right:    [ [0,1,0], [-1,0,1], [0,0,1] ]
   };

   // multiply two 3x3 matrices: result = A * B
   function multiplyMatrix(A, B) {
      const R = [[0,0,0],[0,0,0],[0,0,0]];
      for (let i=0;i<3;i++) {
         for (let j=0;j<3;j++) {
            let s = 0;
            for (let k=0;k<3;k++) s += A[i][k] * B[k][j];
            R[i][j] = s;
         }
      }
      return R;
   }

   function matrixToString(m) {
      return `${m[0][0]} ${m[0][1]} ${m[0][2]}  ${m[1][0]} ${m[1][1]} ${m[1][2]}  ${m[2][0]} ${m[2][1]} ${m[2][2]}`;
   }

   try {
      const touchDevices = await self.detectTouchscreen();
      if (!touchDevices || touchDevices.length === 0) {
         self.logger.info(logPrefix + " No touchscreen detected, skipping correction.");
         return;
      }

      // load persisted maps/inversions (objects)
      const mappedObj = self.config.get("touch_mapped_output") || {};
      const inversionMap = self.config.get("touch_inversion_by_id") || {};

      for (let dev of touchDevices) {
         try {
            // ensure dev.id is string key (config keys are strings)
            const devKey = String(dev.id);

            if (touchcorrection === "automatic") {
               // 1) map device to output if not already mapped to this screen
               if (mappedObj[devKey] !== screen) {
                  await runCommand(`DISPLAY=${display} xinput --map-to-output ${dev.id} ${screen}`);
                  mappedObj[devKey] = screen;
                  self.config.set("touch_mapped_output", mappedObj);
                  self.logger.info(`${logPrefix} Mapped ${dev.name} (id=${dev.id}) → ${screen} and saved mapping`);
               } else {
                  self.logger.info(`${logPrefix} ${dev.name} (id=${dev.id}) already mapped to ${screen}`);
               }

               // 2) detect inversion per-device if not saved
               let inversion = inversionMap[devKey];
               if (!inversion) {
                  // detectTouchInversion should return {invertX:boolean, invertY:boolean} or null/false
                  inversion = await self.detectTouchInversion(dev.id, screen);
                  if (!inversion) inversion = { invertX: false, invertY: false };
                  inversionMap[devKey] = inversion;
                  self.config.set("touch_inversion_by_id", inversionMap);
                  self.logger.info(`${logPrefix} Detected inversion for ${dev.name} id=${dev.id}: ${JSON.stringify(inversion)}`);
               } else {
                  self.logger.info(`${logPrefix} Using stored inversion for ${dev.name} id=${dev.id}: ${JSON.stringify(inversion)}`);
               }

               // 3) build inversion matrix (hardware correction)
               let inversionMatrix = [ [1,0,0],[0,1,0],[0,0,1] ];
               if (inversion.invertX && inversion.invertY) {
                  inversionMatrix = [ [-1,0,1],[0,-1,1],[0,0,1] ];
               } else if (inversion.invertX) {
                  inversionMatrix = [ [-1,0,1],[0,1,0],[0,0,1] ];
               } else if (inversion.invertY) {
                  inversionMatrix = [ [1,0,0],[0,-1,1],[0,0,1] ];
               }

               // 4) combine rotation (screen) and hardware inversion.
               // Order: rotationMatrix * inversionMatrix  (first fix device, then rotate to screen)
               const rotMatrix = rotationMatrices[rotatescreen] || rotationMatrices.normal;
               const finalMatrix = multiplyMatrix(rotMatrix, inversionMatrix);
               const matrixStr = matrixToString(finalMatrix);

               // 5) apply final matrix
               try {
                  await runCommand(`DISPLAY=${display} xinput set-prop ${dev.id} "Coordinate Transformation Matrix" ${matrixStr}`);
                  self.logger.info(`${logPrefix} Auto correction applied to ${dev.name} (id=${dev.id}) → matrix=${matrixStr}`);
               } catch (e) {
                  // fallback: warn but keep map-to-output (mapping preserved)
                  self.logger.warn(`${logPrefix} Failed to apply matrix to ${dev.name} (id=${dev.id}). Mapping kept. Error: ${e.message}`);
               }

            } else {
               // Manual modes — still map to output if we have previous mapping or prefer to map always for touchpad/touchscreen
               if (mappedObj[devKey] !== screen) {
                  // optional: map once even in manual mode (keeps input confined to screen)
                  await runCommand(`DISPLAY=${display} xinput --map-to-output ${dev.id} ${screen}`);
                  mappedObj[devKey] = screen;
                  self.config.set("touch_mapped_output", mappedObj);
                  self.logger.info(`${logPrefix} (manual) Mapped ${dev.name} (id=${dev.id}) → ${screen}`);
               }

               // Manual matrix selection
               let matrix = "1 0 0  0 1 0  0 0 1";
               switch (touchcorrection) {
                  case "swap-lr": matrix = "0 -1 1  1 0 0  0 0 1"; break;
                  case "swap-ud": matrix = "-1 0 1  0 -1 1  0 0 1"; break;
                  case "swap-both": matrix = "0 1 0  -1 0 1  0 0 1"; break;
                  case "none": default: break;
               }

               await runCommand(
                  `DISPLAY=${display} xinput set-prop ${dev.id} "Coordinate Transformation Matrix" ${matrix}`
               );
               self.logger.info(`${logPrefix} Manual correction applied: ${touchcorrection} → ${dev.name} (id=${dev.id})`);
            }

         } catch (err) {
            self.logger.error(`${logPrefix} Failed to handle device ${dev.name} (id=${dev.id}): ${err.message}`);
         }
      } // end for devices
   } catch (err) {
      self.logger.error(logPrefix + " applyTouchCorrection error: " + (err && err.message ? err.message : err));
   }
};


// 3. Handle cursor hiding
display_configuration.prototype.applyCursorSetting = function () {
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
