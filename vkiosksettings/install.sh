#!/bin/bash
echo "Installing Kiosk settings"

cat > /etc/systemd/system/vkiosksettings.service <<EOC
[Unit]
Description=vkiosksettings Daemon 
After=syslog.target
[Service]
Type=simple
WorkingDirectory=/data/plugins/user_interface/vkiosksettings
ExecStart=/data/plugins/user_interface/vkiosksettings/vkiosksettings.sh
Restart=yes
User=root
Group=root
TimeoutSec=1
[Install]
WantedBy=multi-user.target
EOC

systemctl daemon-reload
#required to end the plugin install
echo "plugininstallend"
