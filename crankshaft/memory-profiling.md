<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](http://doctoc.herokuapp.com/)*

- [Theory](#theory)
  - [Objects](#objects)
    - [Shallow size](#shallow-size)
    - [Retained size](#retained-size)
      - [GC roots](#gc-roots)
    - [Storage](#storage)
    - [Object Groups](#object-groups)
  - [Retainers](#retainers)
  - [Dominators](#dominators)
  - [Causes for Leaks](#causes-for-leaks)
- [Tools](#tools)
  - [DevTools Timeline](#devtools-timeline)
      - [Drilling into Events](#drilling-into-events)
  - [DevTools Heap Profiler](#devtools-heap-profiler)
    - [Collecting a HeapDump for a Node.js app](#collecting-a-heapdump-for-a-nodejs-app)
      - [Ensuring GC](#ensuring-gc)
    - [Considerations to make code easier to debug](#considerations-to-make-code-easier-to-debug)
        - [Name your function declarations](#name-your-function-declarations)
    - [Views](#views)
      - [Color Coding](#color-coding)
      - [Summary View](#summary-view)
        - [Limiting included Objects](#limiting-included-objects)
      - [Comparison View](#comparison-view)
        - [Advanced Comparison Technique](#advanced-comparison-technique)
      - [Object Allocation Tracker](#object-allocation-tracker)
        - [Allocation Stack](#allocation-stack)
      - [Containment View](#containment-view)
        - [Entry Points](#entry-points)
      - [Dominators View](#dominators-view)
      - [Retainer View](#retainer-view)
    - [Constructors listed in Views](#constructors-listed-in-views)
      - [Closures](#closures)
- [Resources](#resources)
  - [blogs/tutorials](#blogstutorials)
  - [videos](#videos)
  - [slides](#slides)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Theory

### Objects

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#object-sizes)
[read](https://developer.chrome.com/devtools/docs/memory-analysis-101#object_sizes)

#### Shallow size

- memory held by object **itself**
- arrays and strings may have significant shallow size

#### Retained size

- memory that is freed once object itself is deleted due to it becoming unreachable from *GC roots*
- held by object *implicitly*

##### GC roots

- made up of *handles* that are created when making a reference from native code to a JS object ouside of v8
- found in heap snapshot under **GC roots > Handle scope** and **GC roots > Global handles**
- internal GC roots are window global object and DOM tree

#### Storage

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#javascript-object-representation)

[read](https://github.com/thlorenz/v8-perf/blob/master/data-types.md)

- primitives are leafs or terminating nodes
- strings stored in *VM heap* or externally (accessible via *wrapper object*)
- *VM heap* is heap dedicated to JS objects and managed byt v8 gargabe collector
- *native objects* stored outside of *VM heap*, not managed by v8 garbage collector and are accessed via JS *wrapper
  object*
- *cons string* object created by concatenating strings, consists of pairs of strings that are only joined as needed
- *arrays* objects with numeric keys, used to store large amount of data, i.e. hashtables (key-value-pair sets) are
  backed by arrays
- *map* object describing object kind and layout

#### Object Groups

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#object-groups)

- *native objects* group is made up from objects holding mutual references to each other
- not represented in JS heap -> have zero size
- wrapper objects created instead, each holding reference to corresponding *native object*
- object group holds wrapper objects creating a cycle
- GC releases object groups whose wrapper objects aren't referenced, but holding on to single wrapper will hold whole
  group of associated wrappers

### Retainers

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#objects-retaining-tree)
[read](https://developer.chrome.com/devtools/docs/memory-analysis-101#retaining_paths)

- shown at the  bottom inside heap snapshots UI
- *nodes/objects* labelled by name of constructor function used to build them
- *edges* labelled using property names
- *retaining path* is any path from *GC roots* to an object, if such a path doesn't exist the object is *unreachable*
  and subject to being garbage collected

### Dominators

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#dominators)
[read](https://en.wikipedia.org/wiki/Dominator_(graph_theory))
[read](https://developer.chrome.com/devtools/docs/memory-analysis-101#dominators)

- can be seen in [**Dominators** view](#dominators-view)
- tree structure in which each object has **one** dominator
- if *dominator* is deleted the *dominated* node is no longer reachable from *GC root*
- node **d** dominates a node **n** if every path from the start node to **n** must go through **d**

### Causes for Leaks

[read](http://addyosmani.com/blog/taming-the-unicorn-easing-javascript-memory-profiling-in-devtools/) *Understanding the Unicorn*

- logical errors in JS that keep references to objects that aren't needed anymore
  - number one error: event listeners that haven't been cleaned up correctly
- this causes an object to be considered live by the GC and thus prevents it from being reclaimed

## Tools

### DevTools Timeline

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#identifying-a-memory-problem-with-the-devtools-timeline)

- not available to use with Node.js ATM

![memory-timeline](https://github.com/thlorenz/v8-perf/blob/master/assets/devtools-memory-timeline.png)

- memory usage overview over time
- can be used to identify memory leaks and/or performance bottlenecks caused by a *busy* garbage collector
- top band shows events over time that caused memory usage to be affected
- **Records** shows these events in detail and allows drilling into them to see a stack trace
  - GC events are included as well (not shown in the picture)
- **Memory** shows memory usages colored coded
- **Details** (on the right) shows how long each event or each separate function call took

##### Drilling into Events

![memory-timeline-interaction](https://github.com/thlorenz/v8-perf/blob/master/assets/devtools-memory-timeline-01.gif)

### DevTools Heap Profiler

![memory-heapsnapshot](https://github.com/thlorenz/v8-perf/blob/master/assets/devtools-heapsnapshot.png)

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#heap-profiler)

#### Collecting a HeapDump for a Node.js app

- the [heapdump](https://github.com/bnoordhuis/node-heapdump) module supports Node.js `v0.6-v0.10`
- `require('heapdump')` in your module and cause it to write a heap snapshot via `kill -USR2 <pid>`
- before a heap dump is taken, v8 [performs two GC
  cycles](https://github.com/v8/v8/blob/21f01f64c420fffdb917c9890d03f1eb0c2c1ede/src/heap-snapshot-generator.cc#L2594-L2599)
  (also for [Node.js
  `v0.10`](https://github.com/joyent/node/blob/v0.10.29-release/deps/v8/src/profile-generator.cc#L3091-L3096))in order
  to remove collectable objects
- objects in the resulting heapdump are still referenced and thus couldn't be garbage collected

##### Ensuring GC

Although as mentioned above before a heapdump is taken all garbage is collected, I found that manually triggering
garbage collection and forcing the GC to compact yields better results. The reason for this is unclear to me.

Add the below snippet to your code which will only activate if you are exposing the garbage collector:

```js
// shortest
if (typeof gc === 'function') setTimeout(gc, 1000);

// longer in order to see indicators of gc being performed
if (typeof gc === 'function') {
  setTimeout(function doGC() { gc(); process.stdout.write(' gc ') }, 1000);
}
```

Then run your app with the appropriate flags to expose the gc and force compaction.

```
node --always-compact --expose-gc app.js
```

Now you can wait for the garbage collection to occur and take a heapdump right after.

Alternatively you can add a hook to your app, i.e. a route, that will trigger manual `gc` and invoke that before taking
a heapdump.

#### Considerations to make code easier to debug

The usefulness of the information presented in the below views depends on how you authored your code. Here are a few
rules to make your code more debuggable.

###### Name your function declarations

This requires little extra effort but makes is so much easier to track down which function is closing over an object and
thus prevents it from being collected. Unfortunately CoffeeScript generates JS that has unnamed functions due to a bug
in older Internet Explorers.

The below does **not** show as `foo` in the snapshot:

```js
var foo = function () {
  [..]
}
```

This one will:

```js
var foo = function foo() {
  [..]
}
```

This one as well:

```js
function foo() {
  [..]
}
```

#### Views

[overview](https://developer.chrome.com/devtools/docs/heap-profiling#basics)

##### Color Coding

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#looking-up-color-coding)

Properties and values are colored according to their types.

- *a:property* regular propertye, i.e. `foo.bar`
- *0:element* numeric index property, i.e. `arr[0]`
- *a:context var* variable in function context, accessible by name from inside function closure
- *a:system prop* added by JS VM and not accessible from JS code, i.e. v8 internal objects
- yellow objects are referenced by JS
- red objects are detached nodes which are referenced by yellow background object

##### Summary View

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#summary-view)

- shows top level entries, a row per constructor
- columns for distance of the object to the *GC root*, number of object instances, shallow size and retained size.
- `@` character is objects’ unique ID, allowing you to compare heap snapshots on per-object basis

###### Limiting included Objects

- to the right of the View selector you can limit the objects by class name i.e. the name of the constructor function
- to the right of the class filter you can choose which objects to include in your summary (defaults to all)
  - select *objects allocated between heapdump 1 and heapdump 2* to identify objects that are still around in *heapdump
    3* but shouldn't be
  - another way to archieve similar results is by comparing two heapdumps (see below)

##### Comparison View

- compares multiple snapshots to each other
- shows diff of both and delta in ref counts and freed and newly allocated memory
- used to find leaked objects
- after starting and completing (or canceling) the action, no garbage related to that action should be left
- note that garbage is collected each time a snapshot is taken, therefore remaining items are still referenced


1. Take bottom line snapshot
2. Perform operation that might cause a leak
3. Perform reverse operation and/or ensure that action `2` is complete and therefore all objects needed to perform it
   should no longer be needed
4. Take second snapshot
5. Compare both snapshots
  - select a Snapshot, then *Comparison* on the left and another Snapshot to compare it to on the right
  - the *Size Delta* will tell you how much memory couldn't be collected


![compare-snapshots](https://github.com/thlorenz/v8-perf/blob/master/assets/devtools-compare-snapshots.png)

###### Advanced Comparison Technique

[slides](https://speakerdeck.com/addyosmani/javascript-memory-management-masterclass?slide=102)

Use at least three snapshots and compare those.

1. Take bottom line snapshot *Checkpoint 1*
2. Perform operation that might cause a leak
3. Take snapshot *Checkpoint 2*
4. Perform same operation as in *2.*
5. Take snapshot *Checkpoint 3*


- all memory needed to perform action the first time should have been collected by now
- any objects allocated between *Checkpoint 1* and *Checkpoint 2* should be no longer present in *Checkpoint 3*
- select *Snapshot 3* and from the dropdown on the right select *Objects allocated between Snapshot 1 and 2*
- ideally you see no *Objects* that are created by your application (ignore memory that is unrelated to your action,
  i.e. *(compiled code)*)
- if you see any *Objects* that shouldn't be there but are in doubt create a 4th snapshot and select *Objects allocated
  between Snapshot 1 and 2* as shown in the picture below

![4-snapshots](https://github.com/thlorenz/v8-perf/blob/master/assets/devtools-4-snapshots.png)

##### Object Allocation Tracker

[watch](http://youtu.be/LaxbdIyBkL0?t=50m33s)

- **not supported by Node.js** ATM
- now **preferred over snapshot comparisons** especially to track down memory leaks
- *blue* bars show memory allocations
- *grey* bars show memory deallocations

###### Allocation Stack

[slides](https://speakerdeck.com/addyosmani/javascript-memory-management-masterclass?slide=102)
[watch](http://youtu.be/LaxbdIyBkL0?t=51m30s)

- only available when using *Object Allocation Tracker*
- needs to be enabled in settings *General/Profiler/Record heap allocation stack traces*
- shows stack traces of executed code that led to the object being allocated

![allocation-stack](https://github.com/thlorenz/v8-perf/blob/master/assets/devtools-allocation-stack.png)

##### Containment View

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#containment-view)

- birds eye view of apps object structure
- low level, allows peeking inside function closures and look at VM internal objects
- used to determine what keeps objects from being collected

###### Entry Points

- *GC roots* actual GC roots used by garbage collector
- *DOMWindow objects* (not present when profiling Node.js apps)
- *Native objects* (not present when profiling Node.js apps)

Additional entry points only present when profiling a Node.js app:

- *1::* global object
- *2::* global object
- *[4] Buffer* reference to Node.js Buffers

##### Dominators View

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#dominators-view)

- only available once *Settings/General/Profiler/Show advanced heap snapshot properties* is checked and browser
  refreshed afterwards
- shows dominators tree of heap
- similar to containment view but lacks property names since dominator may not have direct reference to all objects it
  dominates
- useful to identify memory accumulation points
- also used to ensure that objects are well contained instead of hanging around due to GC not working properly

##### Retainer View

- always shown at bottom of the UI
- displays retaining tree of currently selected object
- retaining tree has references going outward, i.e. inner item references outer item

#### Constructors listed in Views

[read](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#memory-profiling-faq)

- *(global property)* intermediate object between global object and an object refereced by it
- *(roots)* root entries in retaining view are entities that reference the selected object
- *(closure)* count of references to a group of objects through function closures
- *(array, string, number, regexp)* list of object types with properties which reference an Array, String, Number or
  regular expression
- *(compiled code)* *SharedFunctionInfos* have no context and standibetween functions that do have context
- *(system)* references to builtin functions mainly `Map` (TODO: confirm and more details)

##### Closures

[read](http://zetafleet.com/blog/google-chromes-heap-profiler-and-memory-timeline)

- source of unintentional memory retention
- v8 will not clean up **any** memory of a closure untiil **all** members of the closure have gone out of scope
- therefore they should be used sparingly to avoid unnecessary [semantic
  garbage](https://en.wikipedia.org/wiki/Garbage_(computer_science))

## Resources


### blogs/tutorials

Keep in mind that most of these are someehwat out of date albeit still useful.

- [chrome-docs memory profiling](https://developer.chrome.com/devtools/docs/javascript-memory-profiling)
  - [related demos](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#supporting-demos) including [more resources](https://developer.chrome.com/devtools/docs/javascript-memory-profiling#community-resources)
- [chrome-docs Memory Analysis 101](https://developer.chrome.com/devtools/docs/memory-analysis-101) overlaps with chrome-docs memory profiling
- [chrome-docs heap profiling](https://developer.chrome.com/devtools/docs/heap-profiling) overlaps with chrome-docs memory profiling
- [Chasing Leaks With The Chrome DevTools Heap Profiler Views](https://plus.google.com/+AddyOsmani/posts/D3296iL3ZRE)
  - [heap profiler in chrome dev tools](http://rein.pk/using-the-heap-profiler-in-chrome-dev-tools/)
  - [performance-optimisation-with-timeline-profiles](http://addyosmani.com/blog/performance-optimisation-with-timeline-profiles/) time line data cannot be pulled out of a Node.js app currently, therfore skipping this for now
- [timeline and heap profiler](http://zetafleet.com/blog/google-chromes-heap-profiler-and-memory-timeline)
- [chromium blog](http://blog.chromium.org/2011/05/chrome-developer-tools-put-javascript.html)
- [Easing JavaScript Memory Profiling In Chrome DevTools](http://addyosmani.com/blog/taming-the-unicorn-easing-javascript-memory-profiling-in-devtools/)
- [Effectively Managing Memory at Gmail scale](http://www.html5rocks.com/en/tutorials/memory/effectivemanagement/)
- [javascript memory management masterclass](https://speakerdeck.com/addyosmani/javascript-memory-management-masterclass)
- [fixing memory leaks in drupal's editor](https://www.drupal.org/node/2159965)
- [writing fast memory efficient javascript](http://www.smashingmagazine.com/2012/11/05/writing-fast-memory-efficient-javascript/)
- [imgur avoiding a memory leak situation in JS](http://imgur.com/blog/2013/04/30/tech-tuesday-avoiding-a-memory-leak-situation-in-js/)

### videos

- [The Breakpoint Ep8: Memory Profiling with Chrome DevTools](https://www.youtube.com/watch?v=L3ugr9BJqIs)
- [Google I/O 2013 - A Trip Down Memory Lane with Gmail and DevTools](https://www.youtube.com/watch?v=x9Jlu_h_Lyw#t=1448)

### slides

- [Finding and debugging memory leaks in JavaScript with Chrome DevTools](http://www.slideshare.net/gonzaloruizdevilla/finding-and-debugging-memory-leaks-in-javascript-with-chrome-devtools)
- [eliminating memory leaks in Gmail](https://docs.google.com/presentation/d/1wUVmf78gG-ra5aOxvTfYdiLkdGaR9OhXRnOlIcEmu2s/pub?start=false&loop=false&delayms=3000#slide=id.g1d65bdf6_0_0)
