#!/usr/bin/env node --allow-natives-syntax 

'use strict';

var test = require('tap').test;

function isInteger(val) {
  /*jshint ignore:start*/
  return %_IsSmi(val);
  /*jshint ignore:end*/
}

var is64Bit = /64/.test(process.arch);

var min, max;
if (is64Bit) {
  max = 2147483647;
  min = -2147483648;
} else {
  max = 1073741823;
  min = -1073741824;
}


test('\nintegers inside min/max ranges on a ' + process.arch + ' system' , function (t) {
  t.ok(isInteger(min), 'min number is SMI')
  t.ok(isInteger(max), 'max number is SMI')
  t.end()
})

test('\nintegers outside min/max ranges on a ' + process.arch + ' system' , function (t) {
  t.ok(!isInteger(min - 1), 'number smaller than min is not a SMI')
  t.ok(!isInteger(max + 1), 'number larger than max is not a SMI')
  t.end()
})
