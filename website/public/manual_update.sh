#!/bin/bash

usage()
{
    echo "Usage: sudo $0 -h HOSTNAME -p PASSWORD [ -c SSMCODE -i SSMID -r AWS_REGION ] [ -s SSID -w WIFI_PASSWORD]"
    echo "If no details are provided for SSM the agent is installed but not activated"
    exit 0
}

# Check we have the privileges we need
if [ `whoami` != root ]; then
    echo "Please run this script as root or using sudo"
    exit 0
fi

oldHost=NULL
varHost=NULL
varPass=NULL
ssmCode=NULL
ssmId=NULL
ssid=NULL
wifiPass=NULL

backupDir=/home/deepracer/backup
if [ ! -d ${backupDir} ]; then
    mkdir ${backupDir}
fi

optstring=":h:p:c:i:r:s:w:"

while getopts $optstring arg; do
    case ${arg} in
        h) varHost=${OPTARG};;
        p) varPass=${OPTARG};;
        c) ssmCode=${OPTARG};;
        i) ssmId=${OPTARG};;
        r) ssmRegion=${OPTARG};;
        s) ssid=${OPTARG};;
        w) wifiPass=${OPTARG};;
        ?) usage ;;
    esac
done

if [ $OPTIND -eq 1 ]; then
    echo "No options selected."
    usage
fi

# Disable IPV6 on all interfaces
cp /etc/sysctl.conf ${backupDir}/sysctl.conf.bak
printf "net.ipv6.conf.all.disable_ipv6 = 1" >> /etc/sysctl.conf

# Sort out the Wifi (if we have SSID + Password)
if [ ${ssid} != NULL ] && [ ${wifiPass} != NULL ]; then
    echo "Please 'forget' the currently connected WiFi - a new service based connection will be created as part of the updates performed by this script."
    read -s -n 1 -p "Press any key to once done."
    echo

    mkdir /etc/deepracer-wifi
    cat > /etc/deepracer-wifi/start-wifi.sh << EOF
#!/bin/sh -e
#
# This should add the hidden DeepRacer network, configure it, then connect to it
#

nmcli c add type wifi con-name reinvent ifname mlan0 ssid ${ssid}
nmcli con modify reinvent wifi-sec.key-mgmt wpa-psk
nmcli con modify reinvent wifi-sec.psk ${wifiPass}
nmcli con up reinvent

exit 0
EOF
    chmod u+x /etc/deepracer-wifi/start-wifi.sh

    cat > /etc/deepracer-wifi/stop-wifi.sh << EOF
#!/bin/sh -e
#
# This should disconnect from the hidden DeepRacer network
#

nmcli con down reinvent

exit 0

EOF
    chmod u+x /etc/deepracer-wifi/stop-wifi.sh

    cat > /etc/systemd/system/deepracer-wifi.service << EOF
[Unit]
Description=DeepRacer Wifi Service
After=local-fs.target
After=network.target

[Service]
ExecStart=/etc/deepracer-wifi/start-wifi.sh
RemainAfterExit=true
Type=oneshot

[Install]
WantedBy=multi-user.target

EOF
    systemctl enable deepracer-wifi
    systemctl start deepracer-wifi

    echo 'DeepRacer Wifi service installed'
    echo 'Checking for connection.'

    while [ "$(hostname -I)" = "" ]; do
        echo -e "\e[1A\e[KNo network: $(date)"
        sleep 1
    done

    echo "..connected";
fi

# Update the DeepRacer console password
echo "Updating password to: $varPass"
tempPass=$(echo -n $varPass | sha224sum)
IFS=' ' read -ra encryptedPass <<< $tempPass
cp /opt/aws/deepracer/password.txt ${backupDir}/password.txt.bak
printf "${encryptedPass[0]}" > /opt/aws/deepracer/password.txt

# Check version and perform any version specific actions (looking at you 16.04)
. /etc/lsb-release
if [ $DISTRIB_RELEASE = "16.04" ]; then
    echo 'Ubuntu 16.04 detected'

    # awspat 03/31/2022 - adding warning for 16.04
    echo "There have been various issues with 16.04 and it has not been fully stable with this script"

    while true; do
        read -p "Please confirm you know what you are doing by running this script on 16.04 - type Y or N" yn
        case $yn in
            [Yy]* )
                # Add repo and key
                sh -c 'echo "deb http://packages.ros.org/ros/ubuntu $(lsb_release -sc) main" > /etc/apt/sources.list.d/ros-latest.list' && apt-key adv --keyserver 'hkp://keyserver.ubuntu.com:80' --recv-key C1CF6E31E6BADE8868B172B4F42ED6FBAB17C654 ;

                bundlePath=/opt/aws/deepracer/lib/webserver_pkg/static
                webserverPath=/opt/aws/deepracer/lib/webserver_pkg
                break ;;
            [Nn]* ) exit;;
            * ) echo "Please answer Y or N";;
        esac
    done

elif [ $DISTRIB_RELEASE = "20.04" ]; then
    echo 'Ubuntu 20.04 detected'

    bundlePath=/opt/aws/deepracer/lib/device_console/static
    webserverPath=/opt/aws/deepracer/lib/webserver_pkg/lib/python3.8/site-packages/webserver_pkg

else
    echo 'Not sure what version of OS, terminating.'
    exit 1
fi

echo 'Updating...'
apt clean && apt update
apt-get install -y aws-deepracer*

# If changing hostname need to change the flag in network_config.py
# /opt/aws/deepracer/lib/deepracer_systems_pkg/lib/python3.8/site-packages/deepracer_systems_pkg/network_monitor_module/network_config.py
# SET_HOSTNAME_TO_CHASSIS_SERIAL_NUMBER = False
if [ $DISTRIB_RELEASE = "20.04" ]; then
    if [ $varHost != NULL ]; then
        oldHost=$HOSTNAME
        hostnamectl set-hostname ${varHost}
        cp /etc/hosts ${backupDir}/hosts.bak
        rm /etc/hosts
        cat ${backupDir}/hosts.bak | sed -e "s/${oldHost}/${varHost}/" > /etc/hosts

        cp /opt/aws/deepracer/lib/deepracer_systems_pkg/lib/python3.8/site-packages/deepracer_systems_pkg/network_monitor_module/network_config.py ${backupDir}/network_config.py.bak
        rm /opt/aws/deepracer/lib/deepracer_systems_pkg/lib/python3.8/site-packages/deepracer_systems_pkg/network_monitor_module/network_config.py
        cat ${backupDir}/network_config.py.bak | sed -e "s/SET_HOSTNAME_TO_CHASSIS_SERIAL_NUMBER = True/SET_HOSTNAME_TO_CHASSIS_SERIAL_NUMBER = False/" > /opt/aws/deepracer/lib/deepracer_systems_pkg/lib/python3.8/site-packages/deepracer_systems_pkg/network_monitor_module/network_config.py
    fi

    # Offtrack detection
    # TODO Make this optional
    echo 'Installing off track'
    wget https://d1rhbaf1udr7m1.cloudfront.net/packages/offtrack/aws-deepracer-core_2.0.x.x_amd64.deb
    wget https://d1rhbaf1udr7m1.cloudfront.net/packages/offtrack/aws-deepracer-device-console_2.0.x.x_amd64.deb

    sudo dpkg -i aws-deepracer-core_2.0.x.x_amd64.deb
    sudo dpkg -i aws-deepracer-device-console_2.0.x.x_amd64.deb

fi

echo 'Restarting services'
systemctl restart deepracer-core

# Install ssm-agent -> https://snapcraft.io/install/amazon-ssm-agent/ubuntu
mkdir /tmp/ssm
curl https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_amd64/amazon-ssm-agent.deb -o /tmp/ssm/amazon-ssm-agent.deb
dpkg -i /tmp/ssm/amazon-ssm-agent.deb
rm -rf /tmp/ssm

# Enable, Configure and Start SSM if we have the right info
if [ ${ssmCode} != NULL ]; then
    systemctl enable amazon-ssm-agent
    service amazon-ssm-agent stop
    amazon-ssm-agent -register -code "${ssmCode}" -id "${ssmId}" -region "${ssmRegion}"
    service amazon-ssm-agent start
fi

# Disable video stream by default
cp $bundlePath/bundle.js ${backupDir}/bundle.js.bak
rm $bundlePath/bundle.js
cat ${backupDir}/bundle.js.bak | sed -e "s/isVideoPlaying\: true/isVideoPlaying\: false/" > $bundlePath/bundle.js

# Disable system suspend
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

# Increase time before the console locks (helpful when troubleshooting) - 30 minutes
gsettings set org.gnome.desktop.session idle-delay 1800

# Disable network power saving
echo -e '#!/bin/sh\n/usr/sbin/iw dev mlan0 set power_save off\n' > /etc/network/if-up.d/disable_power_saving
chmod 755 /etc/network/if-up.d/disable_power_saving

# Enable SSH
service ssh start
ufw allow ssh

# Allow multiple logins on the console
cp /etc/nginx/sites-enabled/default ${backupDir}/default.bak
rm /etc/nginx/sites-enabled/default
cat ${backupDir}/default.bak | sed -e "s/auth_request \/auth;/#auth_request \/auth;/" > /etc/nginx/sites-enabled/default

# Change the cookie duration
cp $webserverPath/login.py ${backupDir}/login.py.bak
rm $webserverPath/login.py
cat ${backupDir}/login.py.bak | sed -e "s/datetime.timedelta(hours=1)/datetime.timedelta(hours=12)/" > $webserverPath/login.py

# Disable Gnome and other services
# - to enable gnome - systemctl set-default graphical
# - to start gnome -  systemctl start gdm3
systemctl set-default multi-user
systemctl stop bluetooth
systemctl stop cups-browsed

# Default running service list
# service --status-all | grep '\[ + \]'
#  [ + ]  acpid
#  [ + ]  alsa-utils
#  [ + ]  apparmor
#  [ + ]  apport
#  [ + ]  avahi-daemon
#  [ + ]  binfmt-support
#  [ + ]  bluetooth
#  [ + ]  console-setup
#  [ + ]  cron
#  [ + ]  cups-browsed
#  [ + ]  dbus
#  [ + ]  dnsmasq
#  [ + ]  fail2ban
#  [ + ]  grub-common
#  [ + ]  irqbalance
#  [ + ]  isc-dhcp-server
#  [ + ]  keyboard-setup
#  [ + ]  kmod
#  [ + ]  lightdm
#  [ + ]  network-manager
#  [ + ]  networking
#  [ + ]  nginx
#  [ + ]  ondemand
#  [ + ]  procps
#  [ + ]  rc.local
#  [ + ]  resolvconf
#  [ + ]  rsyslog
#  [ + ]  speech-dispatcher
#  [ + ]  ssh
#  [ + ]  thermald
#  [ + ]  udev
#  [ + ]  ufw
#  [ + ]  urandom
#  [ + ]  uuidd
#  [ + ]  watchdog
#  [ + ]  whoopsie

# Restart services
systemctl restart deepracer-core
service nginx restart

# Done
echo 'Remember to "forget" the wifi being used to update the car if it is not the wifi that will be used for the event.'
echo 'Please log into the car console and change the car LED colour to preference'
