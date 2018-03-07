# v8 Garbage Collector

_find the previous version of this document at
[crankshaft/gc.md](crankshaft/gc.md)_

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Goals, Techniques](#goals-techniques)
- [Cost of Allocating Memory](#cost-of-allocating-memory)
- [How objects are determined to be dead](#how-objects-are-determined-to-be-dead)
- [Two Generations](#two-generations)
  - [Generational Garbage Collector](#generational-garbage-collector)
- [Heap Organization in Detail](#heap-organization-in-detail)
  - [New Space aka Young Generation](#new-space-aka-young-generation)
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
    - [Considerations](#considerations)
- [Orinoco Garbage Collector](#orinoco-garbage-collector)
  - [Parallel Scavenger](#parallel-scavenger)
    - [Scavenger Phases](#scavenger-phases)
      - [Distribution of scavenger work across one main thread and two worker threads](#distribution-of-scavenger-work-across-one-main-thread-and-two-worker-threads)
    - [Results](#results)
  - [Techniques to Improve GC Performance](#techniques-to-improve-gc-performance)
    - [Memory Partition and Parallelization](#memory-partition-and-parallelization)
    - [Tracking Pointers](#tracking-pointers)
    - [Black Allocation](#black-allocation)
  - [Resources](#resources)
- [Old Generation Garbage Collector Deep Dive](#old-generation-garbage-collector-deep-dive)
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
- [Resources](#resources-1)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Goals, Techniques

- ensures fast object allocation, short garbage collection pauses and no memory fragmentation
- **stop-the-world**,
  [generational](http://www.memorymanagement.org/glossary/g.html#term-generational-garbage-collection) accurate garbage collector
- stops program execution when performing steps of garbage collections cycle that can only run
  synchronously
- many steps are performed in parallel, see [Orinoco Garbage
  Collector](#orinoco-garbage-collector) and only part of the object heap is processed in most
  garbage collection cycles to minimize impact on main thread execution
- wraps objects in `Handle`s in order to track objects in memory even if they get moved (i.e. due to being promoted)
- identifies dead sections of memory
- GC can quickly scan [tagged words](data-types.md#efficiently-representing-values-and-tagging)
- follows pointers and ignores SMIs and *data only* types like strings

## Cost of Allocating Memory

[watch](http://youtu.be/VhpdsjBUS3g?t=10m54s)

- cheap to allocate memory
- expensive to collect when memory pool is exhausted

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

### Generational Garbage Collector

- two garbage collectors are implemented, each focusing on _young_ and _old_ generation
  respectively
- young generation evacuation ([more details](#tospace-fromspace-memory-exhaustion))
  - objects initially allocated in _nursery_  of the _young generation_
  - objects surviving one GC are copied into _intermediate_ space of the _young generation_
  - objects surviving two GCs are moved into _old generation_

```
        young generation         |   old generation
                                 |
  nursery     |  intermediate    |
              |                  |
 +--------+   |     +--------+   |     +--------+
 | object |---GC--->| object |---GC--->| object |
 +--------+   |     +--------+   |     +--------+
              |                  |
```

## Heap Organization in Detail

### New Space aka Young Generation

- most objects allocated here
  - executable `Codes` are always allocated in Old Space
- fast allocation
  - simply increase allocation pointer to reserve space for new object
- fast garbage collection
- independent of other spaces
- between 1 and 8 MB

### Old Pointer Space

- contains objects that may have pointers to other objects
- objects surviving two collections while in **New Space** are moved here

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
- however some copy operations can run in parallel due to techniques like page isolation, see
  [Orinoco Garbage Collector](#orinoco-garbage-collector)

### ToSpace, FromSpace, Memory Exhaustion

[watch](http://youtu.be/VhpdsjBUS3g?t=13m40s) | [code](https://cs.chromium.org/chromium/src/v8/src/heap/spaces.h)

- ToSpace is used to allocate values i.e. `new`
- FromSpace is used by GC when collection is triggered
- ToSpace and FromSpace have **exact same size**
- large space overhead (need ToSpace and FromSpace) and therefore only suitable for small **New Space**
- when **New Space** allocation pointer reaches end of **New Space** v8 triggers minor garbage collection cycle
  called **scavenge** or [copying garbage
  collection](http://www.memorymanagement.org/glossary/c.html#term-copying-garbage-collection)
- scavenge algorithm similar to the [Halstead semispace copying collector](https://www.cs.cmu.edu/~guyb/papers/gc2001.pdf)
  to support parallel processing
  - in the past scavenge used to implement [Cheney's algorithm](http://en.wikipedia.org/wiki/Cheney's_algorithm) which is synchronous
  - [more details](http://jayconrod.com/posts/55/a-tour-of-v8-garbage-collection) *Generational collection* section

#### Sample Scavenge Scenario

ToSpace starts as unallocated memory.

- alloc A, B, C, D

```
| A | B | C | D | unallocated |
```

- alloc E (not enough space - exhausted **Young Generation** memory)
- triggers collection which partially blocks the main thread

##### Collection to free ToSpace

- swap labels of FromSpace and ToSpace
- as a result the empty (previous) FromSpace is now the ToSpace
- objects on FromSpace are determined to be live or dead
- dead ones are collected
- live ones are marked and copied (expensive) out of From Space and either
  - moved to ToSpace, compacted in the process to improve cache locality and considered
  _intermediates_ since they survived one GC
  - promoted to OldSpace if they were considered _intermediates_
- assuming B and D were dead

```
| A | C | unallocated        |
```

- now we can allocate E

#### Considerations

[watch](http://youtu.be/VhpdsjBUS3g?t=15m30s)

- every allocation brings us closer to GC pause
- even though as many steps of collection are performed in parallel, **every collection pauses our
  app**
- try to pre-alloc as much as possible ahead of time

## Orinoco Garbage Collector

[watch orinoco overview]([watch](https://youtu.be/EdFDJANJJLs?t=15m10s)) | [jank and concurrent GC](https://youtu.be/HDuSEbLWyOY?t=5m14s) |
[read](https://v8project.blogspot.com/2016/04/jank-busters-part-two-orinoco.html)

The Orinioco garbage collector was created in an attempt to lessen the time that our
application stops due to garbage collection by performing as many steps as possible in
parallel.

Numerous techniques like smart paging and use of concurrency friendly algorithms have been used
to both partially parallelize the Old Generation and Young Generation garbage collectors.

- mostly parallel and concurrent garbage collector without _strict_ generational boundaries
- most parts of GC taken off the main thread (56% less GC on main thread)
- optimized weak global handles
- unified heap for full garbage collection
- optimized v8's black allocation additions
- reduced peak memory consumption of on-heap peak memory by up to 40% and off-heap peak memory
  by 20% for low-memory devices by tuning several GC heuristics

### Parallel Scavenger

[read](https://v8project.blogspot.com/2017/11/orinoco-parallel-scavenger.html)

- introduced with v8 v6.2 which is part of Node.js v8
- older v8 versions used Cheney semispace copying garbage collector that divides young
  generation in two equal halves and [performed moving/copying of objects that survived GC
  synchronously](crankshaft/gc.md#tospace-fromspace-memory-exhaustion)
  - single threaded scavenger made sense on single-core environments, but at this point Chrome,
    Node.js and thus v8 runs in many multicore scenarios
- new algorithm similar to the [Halstead semispace copying collector](https://www.cs.cmu.edu/~guyb/papers/gc2001.pdf)
  except that v8 uses dynamic instead of static _work stealing_ across multiple threads

#### Scavenger Phases

As with the previous algorithm scavenge happens in four phases.
All phases are performed in parallel and interleaved on each task, thus maximizing utilization
of worker tasks.

1. scan for roots
    - majority of root set are the references from the old generation to the young generation
    - [remembered sets](#tracking-pointers) are maintained per page and thus naturally distributes
      the root sets among garbage collection threads
2. copy objects within the young generation
3. promote objects to the old generation
    - objects are processed in parallel
    - newly found objects are added to a global work list from which garbage collection threads can
      _steal_
4. update pointers

##### Distribution of scavenger work across one main thread and two worker threads

![parallel scavenger](https://1.bp.blogspot.com/-fqUIuq6zXEg/Wh2T1lAM5nI/AAAAAAAAA8M/g183HuHqOis6kENwJGt9ctloHEaXEQlagCLcBGAs/s1600/image4.png)
![threads](https://3.bp.blogspot.com/-IQcY0MHevKs/Wh2T08XW7wI/AAAAAAAAA8I/EluBNmwT2XIPZNkznSRUml6AmOJWZiJwQCLcBGAs/s1600/image3.png)


#### Results

- just a little slower than the optimized Cheney algorithm on very small heaps
- provides high throughput when heap gets larger with lots of life objects
- time spent on main thread by the scavenger was reduced by 20%-50%

### Techniques to Improve GC Performance

#### Memory Partition and Parallelization

- heap memory is partitioned into fixed-size chunks, called _pages_
- _young generation evacuation_ is achieved in parallel by copying memory based on pages
- _memory compaction_ parallelized on page-level
- young generation and old generation compaction phases don't depend on each other and thus are
  parallelized
- resulted in 75% reduction of compaction time

#### Tracking Pointers

[read](https://v8project.blogspot.com/2016/04/jank-busters-part-two-orinoco.html)

- GC tracks pointers to objects which have to be updated whenever an object is moved
- all pointers to old location need to be updated to object's new location
- v8 uses a _rembered set_ of _interesting pointers_ on the heap
- an object is _interesting_ if it may move during garbage collection or if it lives in heavily
  fragmented pages and thus will be moved during compaction
- _remembered sets_ are organized to simplify parallelization and ensure that threads get
  disjoint sets of pointers to update
- each page stores offsets to _interesting_ pointers originating from that page

#### Black Allocation

[read](https://v8project.blogspot.com/2016/04/jank-busters-part-two-orinoco.html)

- assumption: objects recently allocated in the old generation should at least survive the next
  old generation garbage collection and thus are _colored_ black
- _black objects_ are allocated on black pages which aren't swept
- speeds up incremental marking process and results in less garbage collection

### Resources

- [Getting Garbage Collection for Free](https://v8project.blogspot.com/2015/08/getting-garbage-collection-for-free.html)
  _maybe outdated except the scheduling part at the beginning_?
- [Jank Busters Part One](https://v8project.blogspot.com/2015/10/jank-busters-part-one.html)
  _outdated_?
- [Jank Busters Part Two: Orinoco](https://v8project.blogspot.com/2016/04/jank-busters-part-two-orinoco.html)
  _outdated_ except for paging, pointer tracking and black allocation?
- [V8 Release 5.3](https://v8project.blogspot.com/2016/07/v8-release-53.html)
- [V8 Release 5.4](https://v8project.blogspot.com/2016/09/v8-release-54.html)
- [Optimizing V8 memory consumption](https://v8project.blogspot.com/2016/10/fall-cleaning-optimizing-v8-memory.html)
- [Orinoco: young generation garbage collection](https://v8project.blogspot.com/2017/11/orinoco-parallel-scavenger.html)

## Old Generation Garbage Collector Deep Dive

- fast alloc
- slow collection performed infrequently and thus in most cases doesn't affect application
  performance as much as the more frequently performed _scavenge_
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

## Resources

- [video: accelerating oz with v8](https://www.youtube.com/watch?v=VhpdsjBUS3g)
- [v8-design](https://github.com/v8/v8/wiki/Design%20Elements#efficient-garbage-collection)
- [tour of v8: garbage collection - 2013](http://jayconrod.com/posts/55/a-tour-of-v8-garbage-collection)
- [memory management reference](http://www.memorymanagement.org/)
