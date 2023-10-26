#!/bin/bash

usage()
{
    echo -e -n "\nUsage, run as root: $0 -h HOSTNAME [ -c SSMCODE -i SSMID -r AWS_REGION ]"
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
ssmCode=NULL
ssmId=NULL
ssmRegion=NULL
dremURL=NULL

timerPath=leaderboard-timer

# Create backup directory
homeDir=$(eval echo ~${SUDO_USER})
backupDir=${homeDir}/backup
if [ ! -d ${backupDir} ]; then
    mkdir ${backupDir}
fi

optstring=":h:p:c:i:r:d:"

while getopts $optstring arg; do
    case ${arg} in
        h) varHost=${OPTARG};;
        c) ssmCode=${OPTARG};;
        i) ssmId=${OPTARG};;
        r) ssmRegion=${OPTARG};;
        d) dremURL=${OPTARG};;
        ?) usage ;;
    esac
done

if [ $OPTIND -eq 1 ]; then
    echo -e -n "\nNo options selected.\n"
    usage
fi

# Update hostname
if [ $varHost != NULL ]; then
    echo -e -n "\nSet hostname: ${varHost}\n"
    oldHost=$HOSTNAME
    hostnamectl set-hostname ${varHost}
    cp /etc/hosts ${backupDir}/hosts.bak
    rm /etc/hosts
    cat ${backupDir}/hosts.bak | sed -e "s/${oldHost}/${varHost}/" > /etc/hosts
fi

# Install Node
echo -e -n "\nInstall Node\n"
rpiVersion=$(tr -d '\0' </proc/device-tree/model)
nodeVersion=v18.18.0

# Get the right version for the device we're on
if [[ $rpiVersion = *"Zero W"* ]]; then
    # Releases -> https://unofficial-builds.nodejs.org/download/release/
    rpiArch=armv6l
    curl -o node-${nodeVersion}-linux-${rpiArch}.tar.xz https://unofficial-builds.nodejs.org/download/release/${nodeVersion}/node-${nodeVersion}-linux-${rpiArch}.tar.xz
elif [[ $rpiVersion == *"Model B"* ]]; then
    rpiArch=arm64

    # Needed for SSM-agent
    sudo apt-get update && apt-get upgrade libc6

    # Node
    curl -o node-${nodeVersion}-linux-${rpiArch}.tar.xz https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}-linux-${rpiArch}.tar.xz
else
    echo "Not sure what kind of Pi this is.... sorry it didn't work out."
    exit 1
fi

# Install node
tar -xf node-${nodeVersion}-linux-${rpiArch}.tar.xz
cd node-${nodeVersion}-linux-${rpiArch}
rm -rf docs
rm README.md
sudo cp -rf * /usr/local
cd ..
rm -rf node-${nodeVersion}-linux-${rpiArch}.tar.xz node-${nodeVersion}-linux-${rpiArch}

# Install ssm-agent -> https://snapcraft.io/install/amazon-ssm-agent/ubuntu
echo -e -n "\nInstall SSM\n"
mkdir /tmp/ssm
sudo curl https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_arm/amazon-ssm-agent.deb -o /tmp/ssm/amazon-ssm-agent.deb
dpkg -i /tmp/ssm/amazon-ssm-agent.deb
rm -rf /tmp/ssm

# Enable, Configure and Start SSM if we have the right info
if [ ${ssmCode} != NULL ]; then
    echo -e -n "\nActivate SSM\n"
    systemctl enable amazon-ssm-agent
    service amazon-ssm-agent stop
    amazon-ssm-agent -register -code "${ssmCode}" -id "${ssmId}" -region "${ssmRegion}"
    service amazon-ssm-agent start
fi

# Start with the timer code
unzip ${timerPath}.zip
cd ${timerPath}

# Install dependencies
echo -e -n "\nInstalling timer dependencies\n"
npm install

# Update deepracer-timer.service with the correct $homeDir
# Using s!search!replace! for sed as there are '/' in the variables
echo -e -n "\nUpdate the path in the service-definition file\n"
cp ${homeDir}/${timerPath}/service-definition/deepracer-timer.service ${backupDir}/deepracer-timer.service.bak
rm ${homeDir}/${timerPath}/service-definition/deepracer-timer.service
cat ${backupDir}/deepracer-timer.service.bak | sed -e "s!/home/deepracer!${homeDir}!" -e "s!User=deepracer!User=${SUDO_USER}!" > ${homeDir}/${timerPath}/service-definition/deepracer-timer.service

# Update the DREM URL
echo -e -n "\nUpdate the DREM URL in timer.js\n"
cp ${homeDir}/${timerPath}/timer.js ${backupDir}/timer.js.bak
rm ${homeDir}/${timerPath}/timer.js
cat ${backupDir}/timer.js.bak | sed -e "s!dremURL!${dremURL}!" > ${homeDir}/${timerPath}/timer.js

# Setup timer as a service
echo -e -n "\nInstall and activate timer service\n"
sudo cp ${homeDir}/${timerPath}/service-definition/deepracer-timer.service /etc/systemd/system/deepracer-timer.service

sudo systemctl daemon-reload
sudo systemctl start deepracer-timer.service
sudo systemctl enable deepracer-timer.service
sudo systemctl status deepracer-timer.service

#other possible commands
#sudo systemctl [status,start,stop,restart,enable,disable] deepracer-timer.service

echo -e -n "\nDone!"
echo -e -n "\nTimer ${varHost} should be visible in DREM in ~5 minutes"
