<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](http://doctoc.herokuapp.com/)*

- [Data Types](#data-types)
  - [Efficiently Representing Values and Tagging](#efficiently-representing-values-and-tagging)
    - [Considerations](#considerations)
  - [Arrays](#arrays)
    - [Fast Elements](#fast-elements)
      - [Characteristics](#characteristics)
    - [Dictionary Elements](#dictionary-elements)
      - [Characteristics](#characteristics-1)
    - [Double Array Unboxing](#double-array-unboxing)
    - [Typed Arrays](#typed-arrays)
      - [Float64Array](#float64array)
    - [Considerations](#considerations-1)
  - [Strings](#strings)
  - [Resources](#resources)
  - [TODO](#todo)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Data Types

## Efficiently Representing Values and Tagging

[watch](http://youtu.be/UJPdhx5zTaw?t=15m35s) | [slide](http://v8-io12.appspot.com/index.html#34)

- most objects in heay are 4-byte aligned
- v8 passes around 32bit numbers to represent all values
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

## Arrays

[watch](http://youtu.be/UJPdhx5zTaw?t=17m25s) | [slide](http://v8-io12.appspot.com/index.html#38)

v8 has two methods for storing arrays.

### Fast Elements

- compact keysets
- linear storage buffer

#### Characteristics

- contiguous (non-sparse) 
- `0` based
- smaller than 100K elements

### Dictionary Elements

- hash table storage
- slow access

#### Characteristics

- sparse
- large

### Double Array Unboxing

[watch](http://youtu.be/UJPdhx5zTaw?t=20m20s) | [slide](http://v8-io12.appspot.com/index.html#45)

- Array's hidden class tracks element types
- if all doubles, array is unboxed
  - wrapped objects layed out in linear buffer of doubles
  - each element slot is 64-bit to hold a double
  - SMIs that are currently in Array are converted to doubles
  - very efficient access
  - storing requires no allocation as is the case for boxed doubles
  - causes hidden class change
- careless array manipulation may cause overhead due to boxing/unboxing [watch](http://youtu.be/UJPdhx5zTaw?t=21m50s) |
  [slide](http://v8-io12.appspot.com/index.html#47)

### Typed Arrays

[blog](http://mrale.ph/blog/2011/05/12/dangers-of-cross-language-benchmark-games.htm) |
[spec](https://www.khronos.org/registry/typedarray/specs/latest/)

- difference is in semantics of indexed properties
- v8 uses unboxed backing stores for such typed arrays

#### Float64Array

- gets 64-bit allocated for each element

### Considerations

- don't pre-allocate large arrays (`>100K` elements), instead grow as needed, to avoid them being considered sparse
- do pre-allocate small arrays to correct size to avoid allocations due to resizing
- don't delete elements
- don't load uninitialized or deleted elements [watch](http://youtu.be/UJPdhx5zTaw?t=19m30s) |
  [slide](http://v8-io12.appspot.com/index.html#43)
- use literal initializer for Arrays with mixed values
- don't store non-numeric valuse in numeric arrays
  - causes boxing and efficient code that was generated for manipulating values can no longer be used
- use typed arrays whenever possible

## Strings

- contain only data (no pointers)
- content not tagged

## Resources

- [video: breaking the javascript speed limit with v8](https://www.youtube.com/watch?v=UJPdhx5zTaw) |
  [slides](http://v8-io12.appspot.com/index.html#1)
- [tour of v8: garbage collection - 2013](http://jayconrod.com/posts/55/a-tour-of-v8-garbage-collection)
- [tour of v8: object representation - 2013](http://jayconrod.com/posts/52/a-tour-of-v8-object-representation)

## TODO

- add object representation content from tour of v8
