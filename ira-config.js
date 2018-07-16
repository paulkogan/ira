// Copyright 2017, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

// Hierarchical node.js configuration with command-line arguments, environment
// variables, and files.
const nconf = module.exports = require('nconf');
const path = require('path');

nconf
  // 1. Command-line arguments
  .argv()
  // 2. Environment variables
  .env([
    'DEV_ENDPOINT',
    'DEV_DBNAME',
    'DEV_USER',
    'DEV_PASSWORD',
    'PROD_ENDPOINT',
    'PROD_DBNAME',
    'PROD_USER',
    'PROD_PASSWORD',
    'NODE_ENV',
    'PORT',
    'DATA_BACKEND',
    'GCLOUD_PROJECT'
  ])

  /* user: deployConfig.get('MYSQL_USER'),
  password: deployConfig.get('MYSQL_PASSWORD'),
  host: deployConfig.get('MYSQL_ENDPOINT'),
  database: deployConfig.get('MYSQL_DBNAME'),*/


  // 3. Config file
  .file({ file: path.join(__dirname, 'config.json') })
  // 4. Defaults
  .defaults({

  });

// Check for required settings
checkConfig('NODE_ENV');
//console.log("in ira-config, the endpoint is "+nconf.get('DEV_ENDPOINT'))

  if (nconf.get('NODE_ENV') === 'dev') {
    checkConfig('DEV_ENDPOINT');
    checkConfig('DEV_USER');
    checkConfig('DEV_PASSWORD');
    checkConfig('DEV_DBNAME');



  }

function checkConfig (setting) {
  if (!nconf.get(setting)) {
    throw new Error('You must set ${setting} as an environment variable or in config.json!');
  }
}
