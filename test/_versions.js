#!/usr/bin/env node

var colors = require('ansicolors')
  , format = require('util').format
  , os = require('os');

var specs = { cpus: Object.keys(os.cpus()).length, platform: os.platform(), host: os.hostname() }
  , v = process.versions

var msg = 
    format(colors.cyan('node') + ' %s', colors.yellow('v' + v.node))
  + format(colors.cyan(' | v8') + ' %s | ' + colors.cyan('uv') + ' %s', colors.yellow('v' + v.v8), colors.yellow('v' + v.uv))
  + format(' | %s cpus | %s platform | %s', colors.green(specs.cpus), colors.green(specs.platform), colors.green(specs.host))

console.log(msg + '\n');
