# Language Features

This document lists JavaScript language features and provides info with regard to their
performance. In some cases it is explained why a feature used to be slow and how it was sped
up.

The bottom line is that most features that could not be optimized previously due to limitations
of crankshaft are now first class citizens of the new compiler chain and don't prevent
optimizations anymore.

Therefore write clean idiomatic code [as explained
here](https://github.com/thlorenz/v8-perf/blob/turbo/compiler.md#facit), and use all features
that the language provides.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Function Bind](#function-bind)
  - [Why Was Bind Slow?](#why-was-bind-slow)
  - [What Changed?](#what-changed)
  - [Recommendations](#recommendations)
  - [Resources](#resources)
- [instanceof and @@hasInstance](#instanceof-and-hasinstance)
  - [Recommendations](#recommendations-1)
  - [Resources](#resources-1)
- [Reflection API](#reflection-api)
  - [Resources](#resources-2)
- [Array Builtins](#array-builtins)
- [const](#const)
  - [Recommendations](#recommendations-2)
  - [Resources](#resources-3)
- [Iterating Maps and Sets via `for of`](#iterating-maps-and-sets-via-for-of)
  - [Why was it Slow?](#why-was-it-slow)
  - [What Changed?](#what-changed-1)
  - [Recommendations](#recommendations-3)
  - [Resources](#resources-4)
- [Iterating Maps and Sets via `forEach` and Callbacks](#iterating-maps-and-sets-via-foreach-and-callbacks)
  - [Why was it Slow?](#why-was-it-slow-1)
  - [What Changed?](#what-changed-2)
  - [Recommendations](#recommendations-4)
  - [Resources](#resources-5)
- [Iterating Object properties via for in](#iterating-object-properties-via-for-in)
  - [Incorrect Use of For In To Iterate Object Properties](#incorrect-use-of-for-in-to-iterate-object-properties)
  - [Correct Use of For In To Iterate Object Properties](#correct-use-of-for-in-to-iterate-object-properties)
  - [Why was it Fast?](#why-was-it-fast)
  - [What Changed?](#what-changed-3)
  - [Recommendations](#recommendations-5)
  - [Resources](#resources-6)
- [Object Constructor Subclassing and Class Factories](#object-constructor-subclassing-and-class-factories)
  - [Recommendations](#recommendations-6)
  - [Resources](#resources-7)
- [Tagged Templates](#tagged-templates)
  - [Resources](#resources-8)
- [Typed Arrays and ArrayBuffer](#typed-arrays-and-arraybuffer)
  - [Recommendations](#recommendations-7)
  - [Resources](#resources-9)
- [Object.is](#objectis)
  - [Resources](#resources-10)
- [Regular Expressions](#regular-expressions)
  - [Resources](#resources-11)
- [Destructuring](#destructuring)
  - [Recommendations](#recommendations-8)
  - [Resources](#resources-12)
- [Promises Async/Await](#promises-asyncawait)
  - [Resources](#resources-13)
- [Generators](#generators)
  - [Resources](#resources-14)
- [Proxies](#proxies)
  - [Recommendations](#recommendations-9)
  - [Resources](#resources-15)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Function Bind

### Why Was Bind Slow?

- performance of `Function.prototype.bind` and `bound` functions suffered from performance
  issues in crankshaft days
- language boundaries C++/JS were crossed both ways which is expensive (esp.  calling back from
  C++ into JS)
- two temporary arrays were created on every invocation of a bound function
- due to crankshaft limitations this couldn't be fixed easily there

### What Changed?

- entirely new approach to how _bound function exotic objects_ are implemented
- crossing C++/JS boundaries no longer needed
- pushing bound receiver and bound arguments directly and then calling target function allows
  further compile time optimizations and enables inlining the target function into the
  caller
- TurboFan inlines all mononomorphic calls to `bind` itself
- resulted in **~400x** speed improvement
- the performance of the React runtime,  which makes heavy use of `bind`, doubled as a result

### Recommendations

- developers should use bound functions freely wherever they apply without having to worry
  about performance penalties
- the two below snippets perform the same but arguably the second one is more readable and for the
  case of `arr.reduce` is the only way to pass `this` as it doesn't support passing it as a
  separate parameter like `forEach` and `map` do

```js
// passing `this` to map as separate parameter
arr.map(convert, this)

// binding `this` to the convert function directly
arr.map(convert.bind(this))
```

### Resources

- [A new approach to Function.prototype.bind - 2015](http://benediktmeurer.de/2015/12/25/a-new-approach-to-function-prototype-bind/)
- [Optimizing bound functions further - 2016](http://benediktmeurer.de/2016/01/14/optimizing-bound-functions-further/)
- [bound function exotic objects](https://tc39.github.io/ecma262/#sec-bound-function-exotic-objects)
- [V8 release v6.4 - 2017](https://v8project.blogspot.com/2017/12/v8-release-64.html)

## instanceof and @@hasInstance

- latest JS allows overriding behavior of `instanceOf` via the `@@hasInstance` _well known
  symbol_
- naively this requires a check if `@@hasInstance` is defined for the given object every time
  `instanceof` is invoked for it (in 99% of the cases it won't be defined)
- initially that check was skipped as long as no overrides were added EVER (global protector
  cell)
- Node.js `Writable` class used `@@hasInstance` and thus incurred huge performance bottleneck
  for `instanceof` ~100x, since now checks were no longer skipped
- optimizations weren't possible in these cases initially
- by avoiding to depend on global protector cell for TurboFan and allowing inlining `instancof`
  code this performance bottleneck has been fixed
- similar improvements were made in similar fashion to other _well-known symbols_ like
  `@@iterator` and `@@toStringTag`

### Recommendations

- developers can use `instanceof` freely without worrying about non-deterministic performance
  characteristics
- developers should think hard before overriding its behavior via `@@hasInstance` since this
  _magical behavior_ may confuse others, but using it will incur no performance penalties

### Resources

- [V8: Behind the Scenes (November Edition) - 2016](http://benediktmeurer.de/2016/11/25/v8-behind-the-scenes-november-edition/)
- [Investigating Performance of Object#toString in ES2015 - 2017](http://benediktmeurer.de/2017/08/14/investigating-performance-object-prototype-to-string-es2015/)

## Reflection API

- `Reflect.apply` and `Reflect.construct` received 17x performance boost in v8 v6.1 and
  therefore should be considered performant at this point

### Resources

- [V8 Release 6.1 - 2017](https://v8project.blogspot.com/2017/08/v8-release-61.html)

## Array Builtins

- `Array` builtins like `map`, `forEach`, `reduce`, `reduceRight`, `find`, `findIndex`, `some`
  and `every` can be inlined into TurboFan optimized code which results in considerable
  performance improvement
- optimizations are applied to all _major non-holey_ elements kinds for all `Array` builtins
- for all builtins, except `find` and `findIndex` _holey floating-point_ arrays don't cause
  bailouts anymore

- [V8: Behind the Scenes (February Edition) - 2017](http://benediktmeurer.de/2017/03/01/v8-behind-the-scenes-february-edition/)
- [V8 Release 6.1 - 2017](https://v8project.blogspot.com/2017/08/v8-release-61.html)
- [V8 release v6.5 - 2018](https://v8project.blogspot.com/2018/02/v8-release-65.html)

## const

- `const` has more overhead when it comes to temporal deadzone related checks since it isn't
  hoisted
- however the `const` keyword also guarantees that once a value is assigned to its slot it
  won't change in the future
- as a result TurboFan skips loading and checking `const` slot values slots each time they are
  accessed (_Function Context Specialization_)
- thus `const` improves performance, but only once the code was optimized

### Recommendations

- `const`, like `let` adds cost due to TDZ (temporal deadzone) and thus performs slightly worse
  in unoptimized code
- `const` performs a lot better in optimized code than `var` or `let`

### Resources

- [JavaScript Optimization Patterns (Part 2) - 2017](http://benediktmeurer.de/2017/06/29/javascript-optimization-patterns-part2/)

## Iterating Maps and Sets via `for of`

- `for of` can be used to walk any collection that is _iterable_
- this includes `Array`s, `Map`s, `Set`s, `WeakMap`s and `WeakSet`s

### Why was it Slow?

- set iterators where implemented via a mix of self-hosted JavaScript and C++
- allocated two objects per iteration step (memory overhead -> increased GC work)
- transitioned between C++ and JS on every iteration step (expensive)
- additionally each `for of` is implicitly wrapped in a `try/catch` block as per the language
  specification, which prevented its optimization due to crankshaft not ever optimizing
  functions which contained a `try/catch` statement

### What Changed?

- improved optimization of calls to `iterator.next()`
- avoid allocation of `iterResult` via _store-load propagation_, _escape analysis_ and _scalar
  replacement of aggregates_
- avoid allocation of the _iterator_
- fully implemented in JavaScript via [CodeStubAssembler](https://github.com/v8/v8/wiki/CodeStubAssembler-Builtins)
- only calls to C++ during GC
- full optimization now possible due to TurboFan's ability to optimize functions that include a
  `try/catch` statement

### Recommendations

- use `for of` wherever needed without having to worry about performance cost

### Resources

- [Faster Collection Iterators - 2017](http://benediktmeurer.de/2017/07/14/faster-collection-iterators/)
- [V8 Release 6.1 - 2017](https://v8project.blogspot.com/2017/08/v8-release-61.html)

## Iterating Maps and Sets via `forEach` and Callbacks

- both `Map`s and `Set`s provide a `forEach` method which allows iterating over it's items by
  providing a callback

### Why was it Slow?

- were mainly implemented in C++
- thus needed to transition to C++ first and to handle the callback needed to transition back
  to JavaScript (expensive)

### What Changed?

- `forEach` builtins were ported to the
  [CodeStubAssembler](https://github.com/v8/v8/wiki/CodeStubAssembler-Builtins) which lead to
  a significant performance improvement
- since now no C++ is in play these function can further be optimized and inlined by TurboFan

### Recommendations

- performance cost of using builtin `forEach` on `Map`s and `Set`s has been reduced drastically
- however an additional closure is created which causes memory overhead
- the callback function is created new each time `forEach` is called (not for each item but
  each time we run that line of code) which could lead to it running in unoptimized mode
- therefore when possible prefer `for of` construct as that doesn't need a callback function

### Resources

- [Faster Collection Iterators - Callback Based Iteration - 2017](http://benediktmeurer.de/2017/07/14/faster-collection-iterators/#callback-based-iteration)
- [V8 Release 6.1 - 2017](https://v8project.blogspot.com/2017/08/v8-release-61.html)

## Iterating Object properties via for in

### Incorrect Use of For In To Iterate Object Properties

```js
var ownProps = 0
for (const prop in obj) {
  if (obj.hasOwnProperty(prop)) ownProps++
}
```

- problematic due to `obj.hasOwnProperty` call
  - may raise an error if `obj` was created via `Object.create(null)`
  - `obj.hasOwnProperty` becomes megamorphic if `obj`s with different shapes are passed
- better to replace that call with `Object.prototype.hasOwnProperty.call(obj, prop)` as it is
  safer and avoids potential performance hit

### Correct Use of For In To Iterate Object Properties

```js
var ownProps = 0
for (const prop in obj) {
  if (Object.prototype.hasOwnProperty.call(obj, prop)) ownProps++
}
```

### Why was it Fast?

- crankshaft applied two optimizations for cases were only enumerable fast properties on
  receiver were considered and prototype chain didn't contain enumerable properties or other
  special cases like proxies
- _constant-folded_ `Object.hasOwnProperty` calls inside `for in` to `true` whenever
  possible, the below three conditions need to be met
  - object passed to call is identical to object we are enumerating
  - object shape didn't change during loop iteration
  - the passed key is the current enumerated property name
- enum cache indices were used to speed up property access

### What Changed?

- _enum cache_ needed to be adapted so TurboFan knew when it could safely use _enum cache
  indices_ in order to avoid deoptimization loop (that also affected crankshaft)
- _constant folding_ was ported to TurboFan
- separate _KeyAccumulator_ was introduced to deal with complexities of collecting keys for
  `for-in`
- _KeyAccumulator_ consists of fast part which support limited set of `for-in` actions and slow part which
  supports all complex cases like ES6 Proxies
- coupled with other TurboFan+Ignition advantages this led to ~60% speedup of the above case

### Recommendations

- `for in` coupled with the correct use of `Object.prototype.hasOwnProperty.call(obj, prop)` is
  a very fast way to iterate over the properties of an object and thus should be used for these
  cases

### Resources

- [Restoring for..in peak performance - 2017](http://benediktmeurer.de/2017/09/07/restoring-for-in-peak-performance/)
- [Require Guarding for-in](https://eslint.org/docs/rules/guard-for-in)
- [Fast For-In in V8 - 2017](https://v8project.blogspot.com/2017/03/fast-for-in-in-v8.html)

## Object Constructor Subclassing and Class Factories

- pure object subclassing `class A extends Object {}` by itself is not useful as `class B
  {}` will yield the same result even though [`class A`'s constructor will have different
  prototype chain than `class B`'s](https://github.com/thlorenz/d8box/blob/8ec3c71cb6bdd7fe8e32b82c5f19d5ff24c65776/examples/object-subclassing.js#L22-L23)
- however subclassing to `Object` is heavily used when implementing mixins via class factories
- in the case that no base class is desired we pass `Object` as in the example below

```js
function createClassBasedOn(BaseClass) {
  return class Foo extends BaseClass { }
}
class Bar {}

const JustFoo = createClassBasedOn(Object)
const FooBar = createClassBasedOn(Bar)
```

- TurboFan detects the cases for which the `Object` constructor is used as the base class and
  fully inlines object instantiation

### Recommendations

- class factories won't incur any extra overhead if no specific base class needs to be _mixed
  in_ and `Object` is passed to be extended from
- therefore use freely wherever if mixins make sense

### Resources

- [Optimize Object constructor subclassing - 2017](http://benediktmeurer.de/2017/10/05/connecting-the-dots/#optimize-object-constructor-subclassing)

## Tagged Templates

- [tagged templates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates)
  are optimized by TurboFan and can be used where they apply

### Resources

- [optimize tagged templates - 2017](http://benediktmeurer.de/2017/10/05/connecting-the-dots/#optimize-tagged-templates)

## Typed Arrays and ArrayBuffer

- typed arrays are highly optimized by TurboFan
- calls to [`Function.prototype.apply` with TypedArrays as a parameter](http://benediktmeurer.de/2017/10/05/connecting-the-dots/#fast-path-for-typedarrays-in-functionprototypeapply)
  were sped up which positively affected calls to `String.fromCharCode`
- [`ArrayBuffer` view checks](http://benediktmeurer.de/2017/10/05/connecting-the-dots/#optimize-arraybuffer-view-checks)
  were improved by optimizing `ArrayBuffer.isView` and `TypedArray.prototype[@@toStringTag]
- storing booleans inside TypedArrays was improved to where it now is identical to storing
  integers

### Recommendations

- TypedArrays should be used wherever possible as it allows v8 to apply optimizations faster
  and more aggressively than for instance with plain Arrays
- any remaining bottlenecks will be fixed ASAP as TypedArrays being fast is a prerequisite of
  Webgl performing smoothly

### Resources

- [Connecting the dots - 2017](http://benediktmeurer.de/2017/10/05/connecting-the-dots)

## Object.is

- one usecase of `Object.is` is to check if a value is `-0` via `Object.is(v, -0)`
- previously implemented as C++ and thus couldn't be optimized
- now implemented via fast CodeStubAssembler which improved performance by ~14x

### Resources

- [Improve performance of Object.is - 2017](http://benediktmeurer.de/2017/10/05/connecting-the-dots/#improve-performance-of-objectis)

## Regular Expressions

- migrated away from JavaScript to minimize overhead that hurt performance in previous
  implementation
- new design based on [CodeStubAssembler](compiler.md#codestubassembler)
- entry-point stub into RegExp engine can easily be called from CodeStubAssembler
- make sure to neither modify the `RegExp` instance or its prototype as that will interfere
  with optimizations applied to regex operations
- [named capture groups](https://developers.google.com/web/updates/2017/07/upcoming-regexp-features#named_captures)
  are supported starting with v8 v6.4

### Resources

- [Speeding up V8 Regular Expressions - 2017](https://v8project.blogspot.com/2017/01/speeding-up-v8-regular-expressions.html)
- [V8 release v6.4 - 2017](https://v8project.blogspot.com/2017/12/v8-release-64.html)
- [RegExp named capture groups - 2017](http://2ality.com/2017/05/regexp-named-capture-groups.html#named-capture-groups)


## Destructuring

- _array destructuring_ performance on par with _naive_ ES5 equivalent

### Recommendations

- employ destructuring syntax freely in your applications

### Resources

- [High-performance ES2015 and beyond - 2017](https://v8project.blogspot.com/2017/02/high-performance-es2015-and-beyond.html)

## Promises Async/Await

- native Promises in v8 have seen huge performance improvements as well as their use via
  `async/await`
- v8 exposes C++ API allowing to trace through Promise lifecycle which is used by Node.js API
  to provide insight into Promise execution
- DevTools async stacktraces make Promise debugging a lot easier
- DevTools _pause on exception_ breaks immediately when a Promise `reject` is invoked

### Resources

- [V8 Release 5.7 - 2017](https://v8project.blogspot.com/2017/02/v8-release-57.html)k

## Generators

- weren't optimizable in the past due to control flow limitations in Crankshaft
- new compiler chain generates bytecodes which de-sugar complex generator control flow into
  simpler local-control flow bytecodes
- these resulting bytecodes are easily optimized by TurboFan without knowing anything specific
  about generator control flow

### Resources

- [High-performance ES2015 and beyond - 2017](https://v8project.blogspot.com/2017/02/high-performance-es2015-and-beyond.html)

## Proxies

- [proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
  required 4 jumps between C++ and JavaScript runtimes in the previous v8 compiler
  implementation
- porting C++ bits to [CodeStubAssembler](compiler.md#codestubassembler) allows all execution
  to happen inside the JavaScript runtime, resulting in 0 jumps between runtimes
- this sped up numerous proxy operations
  - constructing proxies 49%-74% improvement
  - calling proxies upt to 500% improvement
  - [has trap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/has)
    71%-428% improvement, larger improvement when trap is present
  - [set trap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/set)
    27%-438% improvement, larger improvement when trap is set

### Recommendations

- while the use of proxies does incur an overhead, that overhead has been reduced drastically,
  but still should be avoided in hot code paths
- however use proxies whenever the problem you're trying to solve calls for it

### Resources

- [Optimizing ES2015 proxies in V8 - 2017](https://v8project.blogspot.com/2017/10/optimizing-proxies.html)
