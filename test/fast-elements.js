#!/usr/bin/env node --allow-natives-syntax

'use strict'

const test = require('tape')
const {
    assertKind
  , FAST_SMI_ONLY
  , FAST_DOUBLE
  , FAST
  , DICTIONARY
} = require('./util/element-kind')

// https://cs.chromium.org/chromium/src/v8/src/objects/js-array.h?type=cs&q=kmaxFast&l=90
const kMaxFastArrayLength = 32 * 1024 * 1024

test('\narray that was not pre-allocated but grown on demand', function(t) {
  const arr = []
  let len = kMaxFastArrayLength + 1

  while (len--) {
    arr.push(len)
  }

  assertKind(t, arr, FAST_SMI_ONLY, `to ${kMaxFastArrayLength + 1} elements, is fast`)
  arr[1] = undefined
  const msg = (
    `to ${kMaxFastArrayLength + 1} elements, becomes fast ` +
    `(no longer Smi only) when assigning a slot to 'undefined'`
  )
  assertKind(t, arr, FAST, msg)
  t.end()
})

function fillSmis(arr, max = arr.length) {
  for (let i = 0; max > i && i < arr.length; i++) arr[i] = i
}

function fillDoubles(arr) {
  for (let i = 0; i < arr.length; i++) arr[i] = i * 0.1
}

test('\narrays that were pre-allocated to hold a specific number of elements', function(t) {
  const a = new Array(kMaxFastArrayLength)
  const b = new Array(kMaxFastArrayLength + 1)

  assertKind(t, a, FAST_SMI_ONLY, `to ${a.length}, is initially fast smis`)
  assertKind(t, b, DICTIONARY, `to ${b.length}, is initially slow`)

  fillSmis(b, 1E6)
  assertKind(t, b, DICTIONARY, `to ${b.length}, and filled partially with Smis, is still slow`)

  fillSmis(b, b.length)
  assertKind(t, b, FAST_SMI_ONLY, `to ${b.length} and filled completely with Smis, becomes fast smis`)

  fillDoubles(a, 10)
  assertKind(t, a, FAST_DOUBLE, `to ${a.length}, and filled partially with Doubles becomes fast doubles`)
  t.end()
})
