'use strict'

const matrix = []
const TIMEOUT = 2E3
const OUTER_ITER = 1E3
const INNER_ITER = 10
var outer = 2

function minorHog() {
  // this is to show that function that allocate less have less width in the allocation profile
  const arr = []
  for (var i = 0; i < Math.pow(INNER_ITER, outer / 2); i++) {
    arr.push(`minor-hog | round: ${outer} | element: ${i}`)
  }
  matrix.push(arr)
}

function hog() {
  const arr = []
  for (var i = 0; i < Math.pow(INNER_ITER, outer); i++) {
    arr.push(`memory-hog | round: ${outer} | element: ${i}`)
  }
  matrix.push(arr)

  if (++outer < OUTER_ITER) {
    setTimeout(hog, TIMEOUT)
    setTimeout(minorHog, TIMEOUT / 10)
    setTimeout(() => {
      // anonymous hog
      for (var i = 0; i < Math.pow(INNER_ITER, outer * 0.8); i++) {
        arr.push(`anonymous-hog | round: ${outer} | element: ${i}`)
      }
      matrix.push(arr)
    }, TIMEOUT / 5)
  } else {
    console.log(matrix.length)
  }
}

hog()
