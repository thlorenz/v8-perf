#!/usr/bin/env node --allow-natives-syntax 

'use strict';

/**
 * ## 32-bit architecture
 *
  * 32-bit slot separation to hold a signed integer:
  *
  * - 1 bit to tag it as value
  * - 1 bit for sign
  * - 30 bits for actual value
  *
  * ### Producing 30 bits actual value
  *
  * #### In Detail (each left shift `<<` multiplies value by 2):
  *
  * ```
  *   pad > ((1 << 30) - 1).toString(2)
  *   '111111111111111111111111111111'
  *
  *   pad > ((1 << 30) - 1).toString(2).length
  *   30
  *
  *   pad > ((1 << 30) - 1).toString(10)
  *   '1073741823'
  *
  *   pad > (-(1 << 30)).toString(10)
  *   '-1073741824'
  * ```
  *
  * #### Short
  *
  * pad > console.log('min: %d, max: %d', -Math.pow(2, 30), Math.pow(2, 30) - 1)
  * min: -1073741824, max: 1073741823
  *
  * ## 64-bit architecture
  *
  * - on x64 SMIs are 32-bit signed integers represented at higher half of 64-bit value
  * - format: [32 bit signed int] [31 bits zero padding] 0
  *
  * #### Short
  *
  * pad > console.log('min: %d, max: %d', -Math.pow(2, 31), Math.pow(2, 31) - 1)
  * min: -2147483648, max: 2147483647
  *
  */

var test = require('tape');

function isInteger(val) {
  /*jshint ignore:start*/
  return %_IsSmi(val);
  /*jshint ignore:end*/
}

var is64Bit = /64/.test(process.arch);

var min, max;
if (is64Bit) {
  min = -2147483648;
  max = 2147483647;
} else {
  min = -1073741824;
  max = 1073741823;
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
