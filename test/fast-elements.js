#!/usr/bin/env node --allow-natives-syntax 

'use strict';

var test = require('tap').test;

function hasFastElements(obj) {
  /*jshint ignore:start*/
  return %HasFastSmiElements(obj) ||
      %HasFastSmiOrObjectElements(obj) ||
      %HasFastObjectElements(obj) ||
      %HasFastDoubleElements(obj) ||
      %HasFastHoleyElements(obj);
  /*jshint ignore:end*/
}

test('\narray that was not pre-allocated but grown on demand', function (t) {
  var arr = [];
  //10,000,000
  var len = 10000000;

  while(len--) {
    arr.push(len);
  }

  t.ok(hasFastElements(arr), 'to 10,000,000 elements has fast elements')
  t.end()
})

test('\narrays that were pre-allocated to hold a specific number of elements', function (t) {
  var a = new Array(99999);
  var b = new Array(100000);
  
  t.ok(hasFastElements(a), 'to 99,999 elements has fast elements')
  t.ok(!hasFastElements(b), 'to 100,000 elements has no fast elements')
  t.end()
})
