'use strict'

// From: https://cs.chromium.org/chromium/src/v8/test/mjsunit/opt-elements-kind.js

const FAST_SMI_ONLY       = 'fast smi only elements'
const FAST                = 'fast elements'
const FAST_DOUBLE         = 'fast double elements'
const DICTIONARY          = 'dictionary elements'
const FIXED_INT8         = 'fixed int8 elements'
const FIXED_UINT8         = 'fixed uint8 elements'
const FIXED_INT16         = 'fixed int16 elements'
const FIXED_UINT16        = 'fixed uint16 elements'
const FIXED_INT32         = 'fixed int32 elements'
const FIXED_UINT32        = 'fixed uint32 elements'
const FIXED_FLOAT32       = 'fixed float32 elements'
const FIXED_FLOAT64       = 'fixed float64 elements'
const FIXED_UINT8_CLAMPED = 'fixed uint8_clamped elements'

function getKind(obj) {
  if (%HasSmiElements(obj)) return FAST_SMI_ONLY
  if (%HasObjectElements(obj)) return FAST
  if (%HasDoubleElements(obj)) return FAST_DOUBLE 
  if (%HasDictionaryElements(obj)) return DICTIONARY 

  if (%HasFixedInt8Elements(obj)) {
    return FIXED_INT8
  }
  if (%HasFixedUint8Elements(obj)) {
    return FIXED_UINT8
  }
  if (%HasFixedInt16Elements(obj)) {
    return FIXED_INT16
  }
  if (%HasFixedUint16Elements(obj)) {
    return FIXED_UINT16
  }
  if (%HasFixedInt32Elements(obj)) {
    return FIXED_INT32
  }
  if (%HasFixedUint32Elements(obj)) {
    return FIXED_UINT32
  }
  if (%HasFixedFloat32Elements(obj)) {
    return FIXED_FLOAT32
  }
  if (%HasFixedFloat64Elements(obj)) {
    return FIXED_FLOAT64
  }
  if (%HasFixedUint8ClampedElements(obj)) {
    return FIXED_UINT8_CLAMPED
  }
}

function assertKind(t, obj, expected, msg = '') {
  const actual = getKind(obj)
  t.equal(actual, expected, `${msg} (elements kind: ${actual})`)
}

module.exports = {
    assertKind
  , getKind
  , FAST_SMI_ONLY      
  , FAST               
  , FAST_DOUBLE        
  , DICTIONARY         
  , FIXED_INT8        
  , FIXED_UINT8        
  , FIXED_INT16        
  , FIXED_UINT16       
  , FIXED_INT32        
  , FIXED_UINT32       
  , FIXED_FLOAT32      
  , FIXED_FLOAT64      
  , FIXED_UINT8_CLAMPED
}
