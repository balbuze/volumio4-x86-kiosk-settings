#!/bin/bash
echo "Installing Kiosk settings"

sudo apt update
sudo apt install -y unclutter-xfixes xscreensaver xscreensaver-data-extra xscreensaver-gl-extra

#required to end the plugin install
echo "plugininstallend"
