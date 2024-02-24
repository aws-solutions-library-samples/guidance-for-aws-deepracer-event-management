#!/usr/bin/env bash

USAGE()
{
    echo -e -n "\nUsage, run as root: $0 -h HOSTNAME -p PASSWORD [ -c SSMCODE -i SSMID -r AWS_REGION ] [ -s SSID -w WIFI_PASSWORD]"
    echo -e -n "\nIf no details are provided for SSM the agent is installed but not activated\n\n"
    exit 0
}

# Check we have the privileges we need
if [ `whoami` != root ]; then
    echo -e -n "\nPlease run this script as root using 'sudo'\n"
    exit 0
fi

oldHost=NULL
varHost=NULL
varPass=NULL
ssmCode=NULL
ssmId=NULL
ssmRegion=NULL
ssid=NULL
wifiPass=NULL

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
        ?) USAGE ;;
    esac
done

if [ $OPTIND -eq 1 ]; then
    echo -e -n "\nNo options selected.\n"
    USAGE
fi


# Disable IPV6 networking
DISABLE_IPV6() {
    echo -e -n "\nDISABLE_IPV6\n"

    # Disable IPV6 on all interfaces
    echo -e -n "\n- Disable IPV6"
    cp /etc/sysctl.conf ${backupDir}/sysctl.conf.bak
    printf "net.ipv6.conf.all.disable_ipv6 = 1" >> /etc/sysctl.conf
}

# Optionally create a WiFi connection service
CREATE_WIFI_SERVICE()
{
    echo -e -n "\nCREATE_WIFI_SERVICE\n"

    # Sort out the Wifi (if we have SSID + Password)
    if [ ${ssid} != NULL ] && [ ${wifiPass} != NULL ]; then
        echo -e -n "\n- Adding WiFi as a service: ${ssid}"

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

        echo -e -n "\nDeepRacer Wifi service installed"
        echo -e -n "Checking for connection."

        while [ "$(hostname -I)" = "" ]; do
            echo -e "\e[1A\e[KNo network: $(date)"
            sleep 1
        done

        echo -e -n "\n  ..connected\n\n";
    fi
}

# Set the device and car console password
SET_PASSWORD()
{
    echo -e -n "\nSET_PASSWORD\n"

    # Update the DeepRacer console password
    echo -e -n "\n- Updating password to: ${varPass}"
    tempPass=$(echo -n ${varPass} | sha224sum)
    IFS=' ' read -ra encryptedPass <<< ${tempPass}
    cp /opt/aws/deepracer/password.txt ${backupDir}/password.txt.bak
    sudo printf "${encryptedPass[0]}" > /opt/aws/deepracer/password.txt
}

# Update original AWS DeepRacer car software
DR_CAR_UPDATE()
{
    echo -e -n "\nDR_CAR_UPDATE\n"

    echo -e -n "\nUpdating DeepRacer car software...\n"

    # Update ROS cert
    curl https://repo.ros2.org/repos.key | apt-key add -

    # Get latest key from OpenVINO
    curl -o GPG-PUB-KEY-INTEL-SW-PRODUCTS https://apt.repos.intel.com/intel-gpg-keys/GPG-PUB-KEY-INTEL-SW-PRODUCTS.PUB
    sudo apt-key add GPG-PUB-KEY-INTEL-SW-PRODUCTS

    # Update Ubuntu - removed for now as it takes so long from the standard 20.04 build
    # echo -e -n "\nUpdating Ubuntu packages\n"
    # apt-get update
    # apt-get upgrade -y -o Dpkg::Options::="--force-overwrite"

    # Update DeepRacer packages
    echo -e -n "\nUpdate DeepRacer packages\n"
    apt-get update
    apt-get install -y aws-deepracer-* -o Dpkg::Options::="--force-overwrite"

    # Remove redundant packages
    echo -e -n "\nRemove redundant packages\n"
    apt -y autoremove
}

# Set the device hostname
SET_HOSTNAME()
{
    echo -e -n "\nSET_HOSTNAME\n"

    # If changing hostname need to change the flag in network_config.py
    # ${systemPath}/site-packages/deepracer_systems_pkg/network_monitor_module/network_config.py
    # SET_HOSTNAME_TO_CHASSIS_SERIAL_NUMBER = False

    echo -e -n "\n- Set hostname: ${varHost}"
    oldHost=$HOSTNAME
    hostnamectl set-hostname ${varHost}
    cp /etc/hosts ${backupDir}/hosts.bak
    rm /etc/hosts
    cat ${backupDir}/hosts.bak | sed -e "s/${oldHost}/${varHost}/" > /etc/hosts

    cp ${systemPath}/network_monitor_module/network_config.py ${backupDir}/network_config.py.bak
    rm ${systemPath}/network_monitor_module/network_config.py
    cat ${backupDir}/network_config.py.bak | sed -e "s/SET_HOSTNAME_TO_CHASSIS_SERIAL_NUMBER = True/SET_HOSTNAME_TO_CHASSIS_SERIAL_NUMBER = False/" > ${systemPath}/network_monitor_module/network_config.py
}

# Disable software_update
DISABLE_DR_UPDATE()
{
    echo -e -n "\nDISABLE_DR_UPDATE\n"

    echo -e -n "\n- Disable software update"
    cp ${systemPath}/software_update_module/software_update_config.py ${backupDir}/software_update_config.py.bak
    rm ${systemPath}/software_update_module/software_update_config.py
    cat ${backupDir}/software_update_config.py.bak | sed -e "s/ENABLE_PERIODIC_SOFTWARE_UPDATE = True/ENABLE_PERIODIC_SOFTWARE_UPDATE = False/" > ${systemPath}/software_update_module/software_update_config.py
}

# Install and optionally activate AWS SSM agent
SSM_ACTIVATION()
{
    echo -e -n "\nSSM_ACTIVATION\n"

    # Install SSM Agent - https://github.com/aws/amazon-ssm-agent
    # DeepRacer -> https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_amd64/amazon-ssm-agent.deb
    # RPi 64 -> https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_arm64/amazon-ssm-agent.deb
    # RPi 32 -> https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_arm/amazon-ssm-agent.deb

    echo -e -n "\n- Install SSM"
    mkdir /tmp/ssm
    curl https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_${ARCH}/amazon-ssm-agent.deb -o /tmp/ssm/amazon-ssm-agent.deb
    dpkg -i /tmp/ssm/amazon-ssm-agent.deb
    rm -rf /tmp/ssm

    # Enable, Configure and Start SSM if we have the right info
    if [ ${ssmCode} != NULL ]; then
        echo -e -n "\n- Activate SSM"
        systemctl enable amazon-ssm-agent
        service amazon-ssm-agent stop
        amazon-ssm-agent -register -code "${ssmCode}" -id "${ssmId}" -region "${ssmRegion}"
        service amazon-ssm-agent start

        echo -e -n "\nCar ${varHost} should be visible in DREM in ~5 minutes\n"
    fi
}

# Tweaks that only apply to the AWS DeepRacer car
DR_CAR_TWEAKS()
{
    echo -e -n "\nDR_CAR_TWEAKS\n"

    # Disable system suspend
    echo -e -n "\n- Disable system suspend"
    systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

    # Increase time before the console locks (helpful when troubleshooting) - 30 minutes
    echo -e -n "\n- Increase console time out"
    gsettings set org.gnome.desktop.session idle-delay 1800

    # Disable network power saving
    echo -e -n "\n- Disable network power saving"
    echo -e '#!/bin/sh\n/usr/sbin/iw dev mlan0 set power_save off\n' > /etc/network/if-up.d/disable_power_saving
    chmod 755 /etc/network/if-up.d/disable_power_saving

    # Enable SSH
    echo -e -n "\n- Enable SSH"
    service ssh start
    ufw allow ssh

    # Disable Gnome and other services
    # - to enable gnome - systemctl set-default graphical
    # - to start gnome -  systemctl start gdm3
    echo -e -n "\n- Disable unused services"
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
}

CAR_TWEAKS()
{
    echo -e -n "\nCAR_TWEAKS\n"
    # Disable video stream by default
    echo -e -n "\n- Disable video stream"
    cp ${bundlePath}/bundle.js ${backupDir}/bundle.js.bak
    rm ${bundlePath}/bundle.js
    cat ${backupDir}/bundle.js.bak | sed -e "s/isVideoPlaying\: true/isVideoPlaying\: false/" > ${bundlePath}/bundle.js

    # Allow multiple logins on the console
    echo -e -n "\n- Enable multiple logins to the console"
    cp /etc/nginx/sites-enabled/default ${backupDir}/default.bak
    rm /etc/nginx/sites-enabled/default
    cat ${backupDir}/default.bak | sed -e "s/auth_request \/auth;/#auth_request \/auth;/" > /etc/nginx/sites-enabled/default

    # Change the cookie duration
    echo -e -n "\n- Update the cookie duration"
    cp ${webserverPath}/login.py ${backupDir}/login.py.bak
    rm ${webserverPath}/login.py
    cat ${backupDir}/login.py.bak | sed -e "s/datetime.timedelta(hours=1)/datetime.timedelta(hours=12)/" > $webserverPath/login.py

    # Replace the login page
    echo -e -n "\n- Replace the login.html page"
    cp ${templatesPath}/login.html ${backupDir}/login.html.bak
    rm ${templatesPath}/login.html
    mv login.html ${templatesPath}/login.html
}

# Check the operating system version and architecture
# Possible OS versions
# Ubuntu 16.04 (unsupported), 20.04, 22.04

# Possible hardware
# amd64 (Intel ATOM - AWS DeepRacer)
# arm64 (Raspberry 4)

# Check version
DEVICE=dr       # [dr, rpi]
ARCH=amd64      # [amd64, arm64]

. /etc/lsb-release
if [ $DISTRIB_RELEASE = "16.04" ]; then
    echo -e -n "\n- Ubuntu 16.04 detected"
    echo -e -n "\nPlease update your car to at least 20.04 -> https://docs.aws.amazon.com/deepracer/latest/developerguide/deepracer-ubuntu-update.html\n"
    exit 1

elif [ $DISTRIB_RELEASE = "20.04" ] || [ $DISTRIB_RELEASE = "22.04" ]; then
    echo -e -n "\n- Ubuntu 20.04 or 22.04 detected"

    pythonPath=python3.8
    if [ $DISTRIB_RELEASE = "22.04" ]; then
        pythonPath=python3.10
    fi
    echo -e -n "\n pythonPath = ${pythonPath}\n"
    # Set some paths
    bundlePath=/opt/aws/deepracer/lib/device_console/static
    systemPath=/opt/aws/deepracer/lib/deepracer_systems_pkg/lib/${pythonPath}/site-packages/deepracer_systems_pkg
    templatesPath=/opt/aws/deepracer/lib/device_console/templates
    webserverPath=/opt/aws/deepracer/lib/webserver_pkg/lib/${pythonPath}/site-packages/webserver_pkg

    # Create backup directory
    homeDir=$(eval echo ~${SUDO_USER})
    backupDir=${homeDir}/backup
    if [ ! -d ${backupDir} ]; then
        echo -e -n "\n- Creating backup directory: ${backupDir}"
        mkdir ${backupDir}
    fi

    # What are we running on?
    hw=$(tr -d '\0' </proc/device-tree/model)
    if [[ $hw == *"Raspberry Pi 4"* ]]; then
        echo -e -n "\n- Raspberry Pi"
        DEVICE=rpi
        ARCH=arm64
    fi

    # All cars
    if [ $varHost != NULL ]; then
        SET_HOSTNAME
    fi
    SET_PASSWORD
    SSM_ACTIVATION

    # AWS DeepRacer only
    if [ $DEVICE = "dr" ]; then
        DISABLE_IPV6
        CREATE_WIFI_SERVICE
        DR_CAR_UPDATE
        DISABLE_DR_UPDATE
        DR_CAR_TWEAKS
    fi

    # Raspberry Pi only
    # if [ $DEVICE = "rpi" ]; then
    # fi

    # All cars
    CAR_TWEAKS

else
    echo -e -n "\nSorry, not sure what we're running here, terminating.\n"
    exit 1
fi

# Restart services
echo -e -n "\nRestarting services\n"
systemctl restart deepracer-core
service nginx restart

echo -e -n "\nDone!"
