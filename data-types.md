# Data Types

_find the previous version of this document at
[crankshaft/data-types.md](crankshaft/data-types.md)_

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Efficiently Representing Values and Tagging](#efficiently-representing-values-and-tagging)
  - [Considerations](#considerations)
- [Objects](#objects)
  - [Structure](#structure)
  - [Object Properties](#object-properties)
  - [Hash Tables](#hash-tables)
    - [HashTables and Hash Codes](#hashtables-and-hash-codes)
  - [Resources](#resources)
  - [Fast, In-Object Properties](#fast-in-object-properties)
    - [Assigning Properties inside Constructor Call](#assigning-properties-inside-constructor-call)
    - [Assigning More Properties Later](#assigning-more-properties-later)
    - [Assigning Same Properties in Different Order](#assigning-same-properties-in-different-order)
  - [In-object Slack Tracking](#in-object-slack-tracking)
  - [Methods And Prototypes](#methods-and-prototypes)
    - [Assigning Functions to Properties](#assigning-functions-to-properties)
    - [Assigning Functions to Prototypes](#assigning-functions-to-prototypes)
  - [Numbered Properties](#numbered-properties)
- [Arrays](#arrays)
  - [Fast Elements](#fast-elements)
  - [Dictionary Elements](#dictionary-elements)
    - [Packed vs. Holey Elements](#packed-vs-holey-elements)
    - [Elements Kinds](#elements-kinds)
      - [Elements Kind Lattice](#elements-kind-lattice)
  - [Double Array Unboxing](#double-array-unboxing)
  - [Typed Arrays](#typed-arrays)
    - [Float64Array](#float64array)
  - [Considerations](#considerations-1)
- [Strings](#strings)
- [Resources](#resources-1)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Efficiently Representing Values and Tagging

[watch](http://youtu.be/UJPdhx5zTaw?t=15m35s) | [slide](http://v8-io12.appspot.com/index.html#34)

[read](http://jayconrod.com/posts/52/a-tour-of-v8-object-representation) *Numbered properties: fast elements*

- most objects in heap are 4-byte aligned
- according to spec all numbers in JS are 64-bit floating doubles
- v8 passes around 32-bit numbers to represent all values for improved efficiency
- bottom bit reserved as tag to signify if value is a SMI (small integer) or a pointer to an object

[watch](http://youtu.be/UJPdhx5zTaw?t=10m05ss) | [slide](http://v8-io12.appspot.com/index.html#35)

```
| object pointer              | 1 |

or

| 31-bit-signed integer (SMI) | 0 |
```

- numbers bigger than 31 bits are boxed
- stored inside an object referenced via a pointer
- adds extra overhead (at a minimum an extra lookup)

### Considerations

- prefer SMIs for numeric values whenever possible

## Objects

### Structure

```
+-------------------+
|  Object           |    +----> +------------------+     +---->  +------------------+
|-------------------|    |      |  FixedArray      |     |       |  FixedArray      |
|  Map              |    |      |------------------|     |       |------------------|
|-------------------|    |      |  Map             |     |       |  Map             |
|  Extra Properties |----+      |------------------|     |       |------------------|
|-------------------|           |  Length          |     |       |  Length          |
|  Elements         |------+    |------------------|     |       |------------------|
|-------------------|      |    |  Property "poo"  |     |       |  Property "0"    |
|  Property "foo"   |      |    |------------------|     |       |------------------|
|-------------------|      |    |  Property "baz"  |     |       |  Property "1"    |
|  Property "bar"   |      |    +__________________+     |       +__________________+
+___________________+      |                             |
                           |                             |
                           |                             |
                           +-----------------------------+
```

- above shows most common optimized representation
- most objects contain all their properties in single block of memory `"foo", "bar"`
- all blocks have a `Map` property describing their structure
- named properties that don't fit are stored in overflow array `"poo", "baz"`
- numbered properties are stored in a separate contiguous array `"1", "2"`

### Object Properties

[read](http://jayconrod.com/posts/52/a-tour-of-v8-object-representation) *Some surprising properties of properties*

- object is a collection of properties aka *key-value pairs*
- property names are **always** strings
- any name used as property name that is not a string is stringified via `.toString()`, **even numbers**, so `1` becomes `"1"`
- **Arrays in JavaScript are just objects** with *magic* `length` property

### Hash Tables

- hash table used for *difficult* objects
- aka objects in *dictionary mode*
- accessing hash table property is much slower than accessing a field at a known offset
- if *non-symbol* string is used to access a property it is *uniquified* first
- v8 hash tables are large arrays containing keys and values
- initially all keys and values are `undefined`

#### HashTables and Hash Codes

- on *key-vaule pair* insertion the key's *hash code* is computed
- computing hash code and comparing keys for equality is commonly a fast operation
- still slow to execute these non-trivial routines on every property read/write
- data structures such as Map, Set, WeakSet and WeakMap use hash tables under the hood
- a _hash function_ returns a _hash code_ for given keys which is used to map them to a
  location in the hash table
- hash code is a random number (independent of object value) and thus needs to be stored
- storing the hash code as private symbol on the object, like was done previously, resulted in
  a variety of performance problems
  - led to slow megamorphic IC lookups of the hash code and
  - triggered hidden class transition in the key on storing the hash code
- performance issues were fixed (~500% improvement for Maps and Sets) by _hiding_ the hashcode
  and storing it in unused memory space that is _connected_ to the JSObject
  - if properties backing store is empty: directly stored in the offset of JSObject
  - if properties backing store is array: stored in extranous 21 bits of 31 bits to store array length
  - if properties backing store is dictionary: increase dictionary size by 1 word to store hashcode
    in dedicated slot at the beginning of the dictionary

### Resources

- [Optimizing hash tables: hiding the hash code - 2018](https://v8project.blogspot.com/2018/01/hash-code.html)

### Fast, In-Object Properties

[read](http://jayconrod.com/posts/52/a-tour-of-v8-object-representation) *Fast, in-object properties* |
[read](https://developers.google.com/v8/design#prop_access)

- v8 describes the structure of objects using maps used to create *hidden classes* and match data types
  - resembles a table of descriptors with one entry for each property
  - map contains info about size of the object
  - map contains info about pointers to constructors and prototypes
  - objects with same structure share same map
- objects created by the same constructor and have the **same set of properties assigned in the same order**
  - have regular logical structure and therefore regular structure in memory
  - share same map
- adding new property is handled via *transition* descriptor
  - use existing map
  - *transition* descriptor points at other map

#### Assigning Properties inside Constructor Call

```js
class Point {
  constructor(x, y) {
    // Map M0
    //  "x": Transition to M1 at offset 12

    this.x = x

    // Map M1
    //  "x": Field at offset 12
    //  "y": Transition to M2 at offset 16

    this.y = y

    // Map M2
    //  "x": Field at offset 12
    //  "y": Field at offset 16
  }
}
```

- `Point` starts out without any fields with `M0`
- `this.x =x` -> map pointer set to `M1` and value `x` is stored at offset `12` and `"x" Transition` descriptor added to `M0`
- `this.y =y` -> map pointer set to `M2` and value `y` is stored at offset `16` and `"y" Transition` descriptor added to `M1`

#### Assigning More Properties Later

```js
var p = new Point(1, 2)

// Map M2
//  "x": Field at offset 12
//  "y": Field at offset 16
//  "z": Transition at offset 20

p.z = z

// Map M3
//  "x": Field at offset 12
//  "y": Field at offset 16
//  "z": Field at offset 20
```

- assigning `z` later
  - create `M3`, a copy of `M2`
  - add `Transition` descriptor to `M2`
  - add `Field` descriptor to `M3`

#### Assigning Same Properties in Different Order

```js
class Point {
  constructor(x, y, reverse) {
    // Map M0
    //  "x": Transition to M1 at offset 12ak
    //  "y": Transition to M2 at offset 12
    if (reverse) {
      // variation 1

      // Map M1
      //  "x": Field at offset 12
      //  "y": Transition to M4 at offset 16

      this.x = x

      // Map M4
      //  "x": Field at offset 12
      //  "y": Field at offset 16

      this.y = y
    } else {
      // variation 2

      // Map M2
      //  "y": Field at offset 12
      //  "x": Transition to M5 at offset 16

      this.y = x

      // Map M5
      //  "y": Field at offset 12
      //  "x": Field at offset 16
      this.x = y
    }
  }
}
```

- both variations share `M0` which has two *transitions*
- not all `Point`s share same map
- in worse cases v8 drops object into *dictionary mode* in order to prevent huge number of maps to be allocated
  - when assigning random properties to objects from same constructor in random order
  - when deleting properties

### In-object Slack Tracking

[read](http://jayconrod.com/posts/52/a-tour-of-v8-object-representation) *In-object slack tracking*

- objects allocated by a constructor are given enough memory for 32 *fast* properties to be stored
- after certain number of objects (8) were allocated from same constructor
  - v8 traverses *transition tree* from initial map to determine size of largest of these initial objects
  - new objects of same type are allocated with exact amount of memory to store max number of properties
  - initial objects are resized (down)

### Methods And Prototypes

[read](http://jayconrod.com/posts/52/a-tour-of-v8-object-representation) *Methods and prototypes*

#### Assigning Functions to Properties

```js
function pointDistance(p) { /* calculates distance */ }

class Point {
  constructor(x, y) {
    // Map M0
    //  "x": Transition to M1 at offset 12

    this.x = x

    // Map M1
    //  "x": Field at offset 12
    //  "y": Transition to M2 at offset 16

    this.y = y

    // Map M2
    //  "x": Field at offset 12
    //  "y": Field at offset 16
    // "distance": Transition to M3 <pointDistance>

    this.distance = pointDistance

    // Map M3
    //  "x": Field at offset 12
    //  "y": Field at offset 16
    // "distance": Constant_Function <pointDistance>
  }
}
```

- properties pointing to `Function`s are handled via `constant functions` descriptor
- `constant_function` descriptor indicates that value of property is stored with descriptor itself rather than in the
  object
- pointers to functions are directly embedded into optimized code
- if `distance` is reassigned, a new map has to be created since the `Transition` breaks

#### Assigning Functions to Prototypes

```js
class Point {
  constructor(x, y) {
    this.x = x
    this.y = y
  }

  pointDistance() { /* calculates distance */ }
}
```

- v8 represents prototype methods (aka _class methods_) using `constant_function` descriptors
- calling prototype methods maybe a **tiny** bit slower due to overhead of the following:
  - check *receiver's* map (as with *own* properties)
  - check maps of *prototype chain* (extra step)
- the above lookup overhead won't make measurable performance difference and **shouldn't impact how you write code**

### Numbered Properties

[read](http://jayconrod.com/posts/52/a-tour-of-v8-object-representation) *Numbered properties: fast elements*

[see Arrays](#arrays)

- numbered properties are treated and ordered differently than others since any object can *behave* like an array
- *element* === any property whose key is non-negative integer
- v8 stores elements separate from named properties in an *elements kind* field (see [structure diagram](#structure))
- if object drops into *dictionary mode* for elements, access to named properties remains fast and vice versa
- maps don't need *transitions* to maps that are identical except for *element kinds*
- most elements are *fast elements* which are stored in a contiguous array

## Arrays

[watch](http://youtu.be/UJPdhx5zTaw?t=17m25s) | [slide](http://v8-io12.appspot.com/index.html#38)

[read](http://jayconrod.com/posts/52/a-tour-of-v8-object-representation) *Numbered properties: fast elements*

[read](https://v8project.blogspot.com/2017/08/fast-properties.html)

- v8 has two methods for storing arrays, *fast elements* and *dictionary elements*

### Fast Elements

[see Numbered Properties](#numbered-properties)

- compact keysets
- linear storage buffer
- contiguous (non-sparse)
- `0` based
- smaller than 64K

### Dictionary Elements

- hash table storage
- slow access
- sparse
- large

#### Packed vs. Holey Elements

- v8 makes distinction whether the elements backing store is packed or has holes
- holes in a backing store are created by deleting an indexed element
- missing properties are marked with special _hole_ value to keep Array functions performant
- however missing properties cause expensive lookups on prototype chain

#### Elements Kinds

[read](https://v8project.blogspot.com/2017/09/elements-kinds-in-v8.html)

- fast *elements kinds* in order of increasing generality:
  - fast SMIs (small integers)
  - fast doubles (Doubles stored in unboxed representation)
  - fast values (strings or other objects)

##### Elements Kind Lattice

```
+--------------------+
| PACKED_SMI_ELEMENT |---+
+--------------------+   |    +------------------------+
          |              +--->| PACKED_DOUBLE_ELEMENTS |---+
          ↓                   +------------------------+   |    +-------------------+
+--------------------+                   |                 +--->|  PACKED_ELEMENTS  |
| HOLEY_SMI_ELEMENTS |---+               ↓                      +-------------------+
+--------------------+   |    +------------------------+                   |
                         +--->|  HOLEY_DOUBLE_ELEMENTS |---+               ↓
                              +------------------------+   |    +-------------------+
                                                           +--->|  HOLEY_ELEMENTS   |
                                                                +-------------------+
```

### Double Array Unboxing

[watch](http://youtu.be/UJPdhx5zTaw?t=20m20s) | [slide](http://v8-io12.appspot.com/index.html#45)

- Array's hidden class tracks element types
- if all doubles, array is unboxed aka *upgraded to fast doubles*
  - wrapped objects layed out in linear buffer of doubles
  - each element slot is 64-bit to hold a double
  - SMIs that are currently in Array are converted to doubles
  - very efficient access
  - storing requires no allocation as is the case for boxed doubles
  - causes hidden class change
  - requires expensive copy-and-convert operation
- careless array manipulation may cause overhead due to boxing/unboxing [watch](http://youtu.be/UJPdhx5zTaw?t=21m50s) |
  [slide](http://v8-io12.appspot.com/index.html#47)

### Typed Arrays

[blog](http://mrale.ph/blog/2011/05/12/dangers-of-cross-language-benchmark-games.html) |
[spec](https://www.khronos.org/registry/typedarray/specs/latest/)

- difference is in semantics of indexed properties
- v8 uses unboxed backing stores for such typed arrays

#### Float64Array

- gets 64-bit allocated for each element

### Considerations

- once array is marked as holey it is holey forever
- don't pre-allocate large arrays (`>64K`), instead grow as needed, to avoid them being considered sparse
- do pre-allocate small arrays to correct size to avoid allocations due to resizing
- avoid creating holes, and thus don't delete elements
- don't load uninitialized or deleted elements [watch](http://youtu.be/UJPdhx5zTaw?t=19m30s) |
  [slide](http://v8-io12.appspot.com/index.html#43)
- use literal initializer for Arrays with mixed values
- don't store non-numeric values in numeric arrays
  - causes boxing and efficient code that was generated for manipulating values can no longer be used
- use typed arrays whenever possible especially when performing mathematical operations on an
  array of numbers
- when copying an array, you should avoid copying from the back (higher indices to lower
  indices) because this will almost certainly trigger dictionary mode
- avoid elements kind transitions, i.e. edge case of adding `-0, NaN, Infinity` to a SMI array
  as they are represented as doubles

## Strings

- string representation and how it maps to each bit

```
map |len |hash|characters
0123|4567|8901|23.........
```

- contain only data (no pointers)
- content not tagged
- immutable except for hashcode field which is lazily computed (at most once)

## Resources

- [video: breaking the javascript speed limit with v8](https://www.youtube.com/watch?v=UJPdhx5zTaw) |
  [slides](http://v8-io12.appspot.com/index.html#1)
- [tour of v8: garbage collection - 2013](http://jayconrod.com/posts/55/a-tour-of-v8-garbage-collection)
- [tour of v8: object representation - 2013](http://jayconrod.com/posts/52/a-tour-of-v8-object-representation)
- [v8-design](https://developers.google.com/v8/design#garb_coll)
- [Fast Properties in V8 - 2017](https://v8project.blogspot.com/2017/08/fast-properties.html)
- [“Elements kinds” in V8 - 2017](https://v8project.blogspot.com/2017/09/elements-kinds-in-v8.html)
- [video: V8 internals for JavaScript developers - 2018](https://www.youtube.com/watch?v=m9cTaYI95Zc)
