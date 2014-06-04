<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](http://doctoc.herokuapp.com/)*

- [v8 Garbage Collector](#v8-garbage-collector)
  - [Goals, Techniques](#goals-techniques)
  - [Cost of Allocating Memory](#cost-of-allocating-memory)
  - [How objects are determined to be dead](#how-objects-are-determined-to-be-dead)
  - [Two Generations](#two-generations)
  - [Heap Organization in Detail](#heap-organization-in-detail)
    - [New Space](#new-space)
    - [Old Pointer Space](#old-pointer-space)
    - [Old Data Space](#old-data-space)
    - [Large Object Space](#large-object-space)
    - [Code Space](#code-space)
    - [Cell Space, Property Cell Space, Map Space](#cell-space-property-cell-space-map-space)
    - [Pages](#pages)
  - [Young Generation](#young-generation)
    - [ToSpace, FromSpace, Memory Exhaustion](#tospace-fromspace-memory-exhaustion)
      - [Sample Scavenge Scenario](#sample-scavenge-scenario)
        - [Collection to free ToSpace](#collection-to-free-tospace)
      - [Write Barriers](#write-barriers)
        - [Write Barrier Crankshaft Optimizations](#write-barrier-crankshaft-optimizations)
      - [Considerations](#considerations)
  - [Old Generation](#old-generation)
    - [Collection Steps](#collection-steps)
    - [Mark Sweep and Mark Compact](#mark-sweep-and-mark-compact)
      - [Mark](#mark)
      - [Marking State](#marking-state)
        - [Depth-First Search](#depth-first-search)
      - [Handling Deque Overflow](#handling-deque-overflow)
      - [Sweep and Compact](#sweep-and-compact)
      - [Sweep](#sweep)
      - [Compact](#compact)
    - [Incremental Mark and Lazy Sweep](#incremental-mark-and-lazy-sweep)
      - [Incremental Marking](#incremental-marking)
      - [Lazy Sweeping](#lazy-sweeping)
  - [Causes For GC Pause](#causes-for-gc-pause)
  - [Resources](#resources)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# v8 Garbage Collector

## Goals, Techniques

- ensures fast object allocation, short garbage collection pauses and no memory fragmentation
- **stop-the-world**,
  [generational](http://www.memorymanagement.org/glossary/g.html#term-generational-garbage-collection) accurate garbage collector
- stops program execution when performing garbage collections cycle
- processes only part of the object heap in most garbage collection cycles to minimize impact of above
- wraps objects in `Handle`s in order to track objects in memory even if they get moved (i.e. due to being promoted)
- identifies dead sections of memory
- GC can quickly scan [tagged words](data-types.md#efficiently-representing-values-and-tagging)
- follows pointers and ignores SMIs and *data only* types like strings

## Cost of Allocating Memory

[watch](http://youtu.be/VhpdsjBUS3g?t=10m54s)

- cheap to allocate memory
- expensive to collect when memory pool is exausted

## How objects are determined to be dead

*an object is live if it is reachable through some chain of pointers from an object which is live by definition,
everything else is garbage*

- considered dead when object is unreachable from a root node
- i.e. not referenced by a root node or another live object
- global objects are roots (always accessible)
- objects pointed to by local variables are roots (stack is scanned for roots)
- DOM elements are roots (may be weakly referenced)

## Two Generations 

[watch](http://youtu.be/VhpdsjBUS3g?t=11m24s)

- object heap segmented into two parts (well kind of, [see below](#heap-organization-in-detail))
- **New Space** in which objects aka **Young Generation** are created
- **Old Space** into which objects that survived a GC cycle aka **Old Generation** are promoted

## Heap Organization in Detail

### New Space

- most objects allocated here
  - executable `Codes` are always allocated in Old Space
- fast allocation
  - simply increase allocation pointer to reserve space for new object
- fast garbage collection
- independent of other spaces
- between 1 and 8 MB

### Old Pointer Space

- contains objects that may have pointers to other objects
- objects surviving **New Space** long enough are moved here
  
### Old Data Space

- contains *raw data* objects -- **no pointers**
  - strings
  - boxed numbers
  - arrays of unboxed doubles
- objects surviving **New Space** long enough are moved here

### Large Object Space

- objects exceeding size limits of other spaces
- each object gets its own [`mmap`](http://www.memorymanagement.org/glossary/m.html#mmap)d region of memory
- these objects are never moved by GC

### Code Space

- code objects containing JITed instructions
- only space with executable memory with the exception of **Large Object Space**

### Cell Space, Property Cell Space, Map Space

- each of these specialized spaces places constraints on size and the type of objects they point to
- simplifies collection

### Pages

- each space divided into set of pages
- page is **contiguous** chunk of memory allocated via `mmap`
- page is 1MB in size and 1MB aligned 
  - exception **Large Object Space** where page can be larger
- page contains header 
  - flags and meta-data
  - marking bitmap to indicate which objects are alive
- page has slots buffer
  - allocated in separate memory
  - forms list of objects which may point to objects stored on the page aka [*remembered
    set*](http://www.memorymanagement.org/glossary/r.html#remembered.set)


## Young Generation

*most performance problems related to young generation collections*

- fast allocation
- fast collection performed frequently via [stop and
  copy](http://www.memorymanagement.org/glossary/s.html#term-stop-and-copy-collection) - [two-space
  collector](http://www.memorymanagement.org/glossary/t.html#term-two-space-collector)

### ToSpace, FromSpace, Memory Exhaustion

[watch](http://youtu.be/VhpdsjBUS3g?t=13m40s)

- ToSpace is used to allocate values i.e. `new`
- FromSpace is used by GC when collection is triggered
- ToSpace and FromSpace have **exact same size**
- large space overhead (need ToSpace and FromSpace) and therefore only suitable for small **New Space**
- when **New Space** allocation pointer reaches end of **New Space** v8 triggers minor garbage collection cycle
  called **scavenge** or [copying garbage
  collection](http://www.memorymanagement.org/glossary/c.html#term-copying-garbage-collection)
- scavenge implements [Cheney's algorithm](http://en.wikipedia.org/wiki/Cheney's_algorithm)
- [more details](http://jayconrod.com/posts/55/a-tour-of-v8-garbage-collection) *Generational collection* section

#### Sample Scavenge Scenario

ToSpace starts as unallocated memory.

- alloc A, B, C, D

```
| A | B | C | D | unallocated |
```

- alloc E (not enough space - exhausted **Young Generation** memory)
- triggers collection which blocks the main thread

##### Collection to free ToSpace

- swap labels of FromSpace and ToSpace
- as a result the empty (previous) FromSpace is now the ToSpace
- objects on FromSpace are determined to be live or dead
- dead ones are collected
- live ones are marked and copied (expensive) out of From Space and either
  - moved to ToSpace and compacted in the process to improve cache locality
  - promoted to Old Space
- assuming B and D were dead

```
| A | C | unallocated        |
```

- now we can allocate E

#### Write Barriers

[read](http://jayconrod.com/posts/55/a-tour-of-v8-garbage-collection) *Write barriers: the secret ingredient*

[barrier](http://www.memorymanagement.org/glossary/b.html#term-barrier-1) | [write
barrier](http://www.memorymanagement.org/glossary/w.html#term-write-barrier) | [read
barrier](http://www.memorymanagement.org/glossary/r.html#term-read-barrier)

**Problem**: how does GC know an object in **New Space** is alive if it is only pointed to from an object in **Old Space** without
scanning **Old Space** all the time?

- *store buffer* maintains list of pointers from **Old Space** to **New Space**
- on new allocation of object, no other object points to it
- when pointer of object in **New Space** is written to field of object in **Old Space**, record location of that field in store
  buffer
- above is archieved via a *write barrier* which is a bit of code that detects and records these pointers
- *write barriers* are expensive, but don't act as often (writes are less frequent than reads)

##### Write Barrier Crankshaft Optimizations

- most execution time spent in optimized code
- crankshaft may statically prove object is in New Space and thus write barriers can be omitted for them
- crankshaft allocates objects on stack when only local references to them exist -> no write barriers for stack
- `old->new` pointers are rare, so optimizing for detecting `new->new` and `old->old` pointers quickly
  - since pages are aligned on 1 MB boundary object's page is found quickly by masking off the low 20 bits of its address
  - page headers have flags indicating which space they are in
  - above allows checking which space object is in with a few instructions
- once `old->new` pointer is found, record location of it at end of store buffer
  - *store buffer* entries are sorted and deduped periodically and entries no longer pointing to **New Space** are removed

#### Considerations

[watch](http://youtu.be/VhpdsjBUS3g?t=15m30s)

- every allocation brings us closer to GC pause
- **collection pauses our app**
- try to pre-alloc as much as possible ahead of time

## Old Generation

- fast alloc
- slow collection performed infrequently
- `~20%` of objects survive into **Old Generation**

### Collection Steps

[watch](http://youtu.be/VhpdsjBUS3g?t=12m30s)

- parts of collection run concurrent with mutator, i.e. runs on same thread our JavaScript is executed on
- [incremental marking/collection](http://www.memorymanagement.org/glossary/i.html#term-incremental-garbage-collection)
- [mark-sweep](http://www.memorymanagement.org/glossary/m.html#term-mark-sweep): return memory to system
- [mark-compact](http://www.memorymanagement.org/glossary/m.html#term-mark-compact): move values

### Mark Sweep and Mark Compact

[read](http://jayconrod.com/posts/55/a-tour-of-v8-garbage-collection) *Mark-sweep and Mark-compact*

- used to collect **Old Space** which may contain +100 MB of data
- scavenge impractical for more than a few MBs
- two phases 
  - Mark
  - Sweep or Compact

#### Mark

- all objects on heap are discovered and marked
- objects can start at any *word aligned* offset in page and are at least two words long
- each page contains marking bitmap (one bit per allocatable word)
- results in memory overhead `3.1% on 32-bit, 1.6% on 64-bit systems`
- when marking completes all objects are either considered dead *white* or alive *black*
- that info is used during sweeping or compacting phase

#### Marking State

- pairs of bits represent object's *marking state*
  - **white**: not yet discovered by GC
  - **grey**: discovered, but not all of its neighbors were processed yet
  - **black**: discovered and all of its neighbors were processed
- **marking deque**: separately allocated buffer used to store objects being processed

##### Depth-First Search

- starts with clear marking bitmap and all *white* objects
- objects reachable from roots become *grey* and pushed onto *marking deque*
- at each step GC pops object from *marking deque*, marks it *black* 
- then marks it's neighboring *white* objects *grey* and pushes them onto *marking deque*
- exit condition: *marking deque* is empty and all discovered objects are *black*

#### Handling Deque Overflow

- large objects i.e. long arrays may be processed in pieces to avoid **deque** overflow
- if *deque* overflows, objects are still marked *grey*, but not pushed onto it
- when *deque* is empty again GC scans heap for *grey* objects, pushes them back onto *deque* and resumes marking

#### Sweep and Compact

- both work at **v8** page level == 1MB contiguous chunks (different from [virtual memory
  pages](http://www.memorymanagement.org/glossary/p.html#page))

#### Sweep

- iterates across page's *marking bitmap* to find ranges of unmarked objects
- scans for contiguous ranges of dead objects
- converts them to free spaces
- adds them to free list
- each page maintains separate free lists
  - for small regions `< 256 words`
  - for medium regions `< 2048 words`
  - for large regions `< 16384 words`
  - used by scavenge algorithm for promoting surviving objects to **Old Space**
  - used by compacting algorithm to relocate objects 

#### Compact

[read](http://jayconrod.com/posts/55/a-tour-of-v8-garbage-collection) *Mark-sweep and Mark-compact*
last paragraph

- reduces actual memory usage by migrating objects from fragmented pages to free spaces on other pages
- new pages may be allocated
- evacuated pages are released back to OS

### Incremental Mark and Lazy Sweep

[read](http://jayconrod.com/posts/55/a-tour-of-v8-garbage-collection) *Incremental marking and lazy sweeping*

#### Incremental Marking

- algorithm similar to regular marking
- allows heap to be marked in series of small pauses `5-10ms` each (vs. `500-1000ms` before)
- activates when heap reaches certain threshold size
- when active an incremental marking step is performed on each memory allocation

#### Lazy Sweeping

- occurs after each incremental marking
- at this point heap knows exactly how much memory could be freed
- may be ok to delay sweeping, so actual page sweeps happen on *as-needed* basis 
- GC cycle is complete when all pages have been swept at which point incremental marking starts again

## Causes For GC Pause

[watch](http://youtu.be/VhpdsjBUS3g?t=16m30s)

- calling `new` a lot and keeping references to created objects for longer than necessary
  - client side **never `new` within a frame**

[watch](http://youtu.be/VhpdsjBUS3g?t=17m15s)

- running unoptimized code
  - causes memory allocation for implicit/immediate results of calculations even when not assigned
  - if it was optimized, only for final results gets memory allocated (intermediates stay in registers? -- todo confirm)

## Resources

- [video: accelerating oz with v8](https://www.youtube.com/watch?v=VhpdsjBUS3g) |
  [slides](http://commondatastorage.googleapis.com/io-2013/presentations/223.pdf)
- [v8-design](https://developers.google.com/v8/design#garb_coll)
- [tour of v8: garbage collection - 2013](http://jayconrod.com/posts/55/a-tour-of-v8-garbage-collection)
- [memory management reference](http://www.memorymanagement.org/)
