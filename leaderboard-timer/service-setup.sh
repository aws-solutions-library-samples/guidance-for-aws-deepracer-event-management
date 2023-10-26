#!/usr/bin/env bash

#install dependencies
npm install

#Setup as a service
sudo cp ./service-definition/deepracer-timer.service /etc/systemd/system/deepracer-timer.service

sudo systemctl daemon-reload
sudo systemctl start deepracer-timer.service
sudo systemctl enable deepracer-timer.service
sudo systemctl status deepracer-timer.service

#other possible commands
#sudo systemctl [status,start,stop,restart,enable,disable] deepracer-timer.service