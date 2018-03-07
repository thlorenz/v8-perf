# Ignition and TurboFan Compiler Pipeline

_find the previous version of this document at
[crankshaft/compiler.md](crankshaft/compiler.md)_

Fully activated with v8 version 5.9. Earliest LTS Node.js release with a TurboFan activated
pipleline is Node.js v8.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Goals](#goals)
- [Simplified Pipeline](#simplified-pipeline)
  - [Basic Steps](#basic-steps)
  - [Pipeline as Part of New V8 Architecture](#pipeline-as-part-of-new-v8-architecture)
  - [Detailed Phases of Frontend, Optimization and Backend Stages](#detailed-phases-of-frontend-optimization-and-backend-stages)
- [Advantages Over Old Pipeline](#advantages-over-old-pipeline)
  - [Smaller Performance Cliffs](#smaller-performance-cliffs)
  - [Startup Time Improved](#startup-time-improved)
  - [Memory Usage Reduced](#memory-usage-reduced)
  - [Baseline Performance Improved](#baseline-performance-improved)
  - [New Language Features](#new-language-features)
    - [New Language Features Support And Transpilers](#new-language-features-support-and-transpilers)
  - [Resources](#resources)
- [Ignition Interpreter](#ignition-interpreter)
- [Collecting Feedback via ICs](#collecting-feedback-via-ics)
  - [Monomorphism vs. Polymorphism](#monomorphism-vs-polymorphism)
  - [Feedback Lattice](#feedback-lattice)
  - [Information Stored in Function Closures](#information-stored-in-function-closures)
- [TurboFan](#turbofan)
- [Speculative Optimization](#speculative-optimization)
  - [`add` Example of Ignition and Feedback Vector](#add-example-of-ignition-and-feedback-vector)
    - [Bytecode annotated](#bytecode-annotated)
    - [Feedback Used To Optimize Code](#feedback-used-to-optimize-code)
- [Deoptimization](#deoptimization)
  - [Bailout](#bailout)
    - [Example of x86 Assembly Code including Checks and Bailouts](#example-of-x86-assembly-code-including-checks-and-bailouts)
  - [Lazy Cleanup of Optimized Code](#lazy-cleanup-of-optimized-code)
  - [Deoptimization Loop](#deoptimization-loop)
  - [Causes for Deoptimization](#causes-for-deoptimization)
    - [Modifying Object Shape](#modifying-object-shape)
      - [Considerations](#considerations)
    - [Class Definitions inside Functions](#class-definitions-inside-functions)
      - [Considerations](#considerations-1)
      - [Resources](#resources-1)
  - [Inlining Functions](#inlining-functions)
- [Background Compilation](#background-compilation)
- [Sea Of Nodes](#sea-of-nodes)
  - [Advantages](#advantages)
- [CodeStubAssembler](#codestubassembler)
  - [What is the CodeStubAssember aka CSA?](#what-is-the-codestubassember-aka-csa)
  - [Why is it a Game Changer?](#why-is-it-a-game-changer)
    - [Improvements via CodeStubAssembler](#improvements-via-codestubassembler)
- [Recommendations](#recommendations)
- [Resources](#resources-2)
  - [Slides](#slides)
  - [Videos](#videos)
  - [More Resources](#more-resources)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Goals

[watch](https://youtu.be/HDuSEbLWyOY?t=7m22s)

> Speed up real world performance for modern JavaScript, and enable developers to build a
> faster future web.

- fast startup vs. peak performance
- low memory vs. max optimization
- Ignition Interpreter allows to run code with some amount of optimization very quickly and has
  very low memory footprint
- TurboFan makes functions that run a lot fast, sacrificing some memory in the process
- designed to support entire JavaScript language and make it possible to quickly add new
  features and to optimize them fast and incrementally

## Simplified Pipeline

[slide: pipeline 2010](https://docs.google.com/presentation/d/1_eLlVzcj94_G4r9j9d_Lj5HRKFnq6jgpuPJtnmIBs88/edit#slide=id.g2134da681e_0_163) |
[slide: pipeline 2014](https://docs.google.com/presentation/d/1_eLlVzcj94_G4r9j9d_Lj5HRKFnq6jgpuPJtnmIBs88/edit#slide=id.g2134da681e_0_220) |
[slide: pipeline 2016](https://docs.google.com/presentation/d/1_eLlVzcj94_G4r9j9d_Lj5HRKFnq6jgpuPJtnmIBs88/edit#slide=id.g2134da681e_0_249) |
[slide: pipeline 2017](https://docs.google.com/presentation/d/1_eLlVzcj94_G4r9j9d_Lj5HRKFnq6jgpuPJtnmIBs88/edit#slide=id.g2134da681e_0_125)

Once crankshaft was taken out of the mix the below pipeline was possible

<img alt="simplified pipeline" src="http://benediktmeurer.de/images/2016/v8-new-pipeline-20161125.png" width="70%">

### Basic Steps

1. Parse JavaScript into an [AST (abstract syntax tree)](https://en.wikipedia.org/wiki/Abstract_syntax_tree)
2. Generate bytecode from that AST
3. Turn bytecode into sequence of bytecodes by the BytecodeGenerator, which is part of the [Ignition Interpreter](https://v8project.blogspot.com/2016/08/firing-up-ignition-interpreter.html)
  - sequences are divided on a per function basis
4. Execute bytecode sequences via Ignition and collect feedback via inline caches
  - feedback used by Ignition itself to speed up subsequent interpretation of the bytecode
  - feedback used for speculative optimization by TurboFan when code is optimized
5. _Speculatively_ optimize and compile bytecode using collected feedback to generate optimized machine code
  for the current architecture

### Pipeline as Part of New V8 Architecture

<img alt="new v8 pipeline detailed" src="http://benediktmeurer.de/images/2017/architecture-20170301.png" width="70%">

### Detailed Phases of Frontend, Optimization and Backend Stages

[slide](https://docs.google.com/presentation/d/1H1lLsbclvzyOF3IUR05ZUaZcqDxo7_-8f4yJoxdMooU/edit#slide=id.g18ceb14729_0_135)

<img alt="phases" src="http://benediktmeurer.de/images/2017/turbofan-20171213.png" width="70%">

## Advantages Over Old Pipeline

[watch old architecture](https://youtu.be/HDuSEbLWyOY?t=8m51s) | [watch new architecture](https://youtu.be/HDuSEbLWyOY?t=9m21s)

- reduces memory and startup overhead significantly
- AST no longer source of truth that compilers need to agree on
- AST much simpler and smaller in size
- TurboFan uses Ignition bytecode directly to optimize (no re-parse needed)
- bytecode is 25-50% the size of equivalent baseline machine code
- combines cutting-edge IR (intermediate representation) with multi-layered translation +
  optimization pipeline
- relaxed [sea of nodes](#sea-of-nodes) approach allows more effective reordering and optimization when generating
  CFG
- to achieve that fluid code motion, control flow optimizations and precise numerical range
  analysis are used
- clearer separation between JavaScript, v8 and the target architectures allows cleaner, more
  robust generated code and adds flexibility
- generates better quality machine code than Crankshaft JIT
- crossing from JS to C++ land has been minimized using techniques like CodeStubAssembler
- as a result optimizations can be applied in more cases and are attempted more aggressively
- for the same reason (and due to other improvements) TurboFan inlines code more aggressively,
  leading to even more performance improvements

### Smaller Performance Cliffs

- for most websites the optimizing compiler isn't important and could even hurt performance
  (speculative optimizations aren't cheap)
- pages need to load fast and unoptimized code needs to run fast _enough_, esp. on mobile
  devices
- previous v8 implementations suffered from _performance cliffs_
  - optimized code ran super fast (focus on peak performance case)
  - baseline performance was much lower
  - as a result one feature in your code that caused deoptimization would affect your app's
    performance dramatically, i.e. 100x difference
- TurboFan improves this as
  - widens fast path to ensure that optimized code is more flexible and can accept more types
    of arguments
  - reduces code memory overhead by reusing code generation parts of TurboFan to build Ignition
    interpreter
  - improves slow path

### Startup Time Improved

[watch](https://youtu.be/M1FBosB5tjM?t=43m25s)

- bytecode smaller and faster to generate than machine code (crankshaft)
- bytecode better suited for smaller icache (low end mobile)
- code parsed + AST converted to bytecode only once and optimized from bytecode
- data driven ICs reduced slow path cost (collected in feedback form, previously collected in code form)

### Memory Usage Reduced

[watch](https://youtu.be/M1FBosB5tjM?t=47m20s)

- most important on mobile
- Ignition code up to 8x smaller than Full-Codegen code (crankshaft)

### Baseline Performance Improved

[watch](https://youtu.be/M1FBosB5tjM?t=37m)

- no longer relying on optimizing compiler for _sufficiently_ fast code
- thus improved baseline performance allows delaying optimization until more feedback is collected
- leads to less time and resources spent optimizing

### New Language Features

[watch](https://youtu.be/M1FBosB5tjM?t=29m3s) | [watch](https://youtu.be/EdFDJANJJLs?t=20m) | [watch](https://youtu.be/HDuSEbLWyOY?t=11m22s)

- can address optimization killers that Crankshaft couldn't b/c it never supported fundamental techniques needed to do so
- as a result no specific syntax (like `try/catch`) inside a function will cause it not being optimized
- other subtle optimization killers that made performance unpredictable are no longer an issue and if they are they can be easily fixed in TF
  - passing `undefined` as first parameter to `Math.max.apply`
  - mixing strict and sloppy modes
- easier to support future JavaScript features as the JavaScript frontend is clearly separated
  from the architecture dependent backends
- new language features are not useful by just being implemented
- need to be fast (at least matching transpiled code), related optimizations are easier with
  new pipeline
- need to support debugging and be inspectable, this is achieved via better integration with
  Chrome DevTools
- new language features are easier optimized which makes them useable after much shorter time
  after they are introduced to v8 (previously performance issues for new features prevented
  their use in code that needed to run fast)
- performance of ES6 features relative to the ES5 baseline operations per second tracked at [sixspeed](http://incaseofstairs.com/six-speed/)
- at this point ES6 features are almost on par with ES5 versions of same code for most cases

#### New Language Features Support And Transpilers

[watch how to leverage babel optimally](https://youtu.be/HDuSEbLWyOY?t=15m5s)| [read deploying es2015 code](https://philipwalton.com/articles/deploying-es2015-code-in-production-today/)

- using features directly, instead of transpiling, results in smaller code size [watch](https://youtu.be/HDuSEbLWyOY?t=13m)
- additionally less parse time for untranspiled code and easier optimized
- use [babel-preset-env](https://github.com/babel/babel/tree/master/packages/babel-preset-env) to specify browsers to target
- therefore transpile es2015+ selectively

### Resources

- [Digging into the TurboFan JIT](https://v8project.blogspot.com/2015/07/digging-into-turbofan-jit.html)

## Ignition Interpreter

[watch](https://youtu.be/EdFDJANJJLs?t=13m16s) | [read](https://v8project.blogspot.com/2016/08/firing-up-ignition-interpreter.html)

- uses TurboFan's low-level architecture-independent macro-assembly instructions to generate
  bytecode handlers for each _opcode_
- TurboFan compiles these instructions to target architecture including low-level instruction
  selection and machine register allocation
- bytecode passes through inline-optimization stages as it is generated
  - common patterns replaced with faster sequences
  - redundant operations removed
  - minimize number of register transfers
- this results in highly optimized and small interpreter code which can execute the bytecode instructions
  and interact with rest of v8 VM in low overhead manner
- Ignition Interpreter uses a [register machine](https://en.wikipedia.org/wiki/Register_machine)
  with each bytecode specifying inputs and outputs as explicit register operands
- holds its local state in _interpreter registers_
  - some map to _real_ CPU registers
  - others map to specific slots in native machine _stack memory_
- last computed value of each bytecode is kept in special _accumulator_ register minimizing
  load/store operations (from/to explicit registers)
- current stack frame is identified by stack pointer
- program counter points to currently executed instruction in the bytecode

## Collecting Feedback via ICs

[watch hidden classes/maps](https://youtu.be/u7zRSm8jzvA?t=6m12s) | [watch](https://youtu.be/u7zRSm8jzvA?t=8m20s) | [watch feedback workflow](https://youtu.be/u7zRSm8jzvA?t=14m58s)

[Inline Caches implemented in JavaScript](http://mrale.ph/blog/2012/06/03/explaining-js-vms-in-js-inline-caches.html)

- gather knowledge about types while program runs
- feedback collected via data-driven approach
- uses _FeedbackVector_ attached to every function, responsible to record and manage all
  execution feedback to later speed up its execution
- _FeedbackVector_ linked from function closure and contains slots to store different kinds
  of feedback
- we can inspect what's inside the _FeedbackVector_ of a function in a debug build of d8 by
  passing the `--allow-natives-syntax` flag and calling `%DebugPrint(fn)`
- if monomorphic compare maps and if they match just load prop at offset in memory, i.e. `mov eax, [eax+0xb]`
- IC feedback slots reserved when AST is created, see them via `--print-ast`, i.e. `Slot(0) at 29`
- collect typeinfo for ~24% of the function's ICs before attempting optimization
- feedback vectors aren't embedded in optimized code but map ids or specific type checks, like for SMIs
- see optimization + IC info via [`--trace-opt`](inspection.md#tracing-optimizations)
- evaluate ICs via the  [`--trace-ic` flag](inspection.md#tracing-inline-caches)

### Monomorphism vs. Polymorphism

[watch](http://youtu.be/UJPdhx5zTaw?t=31m30s) | [slide](http://v8-io12.appspot.com/index.html#61)

- operations are monomorphic if hidden classes of arguments are **always** same
- all others are polymorphic at best and megamorphic at worst
- polymorphic: 2-4 different types seen
- monomorphic operations are easier optimized


### Feedback Lattice

- the feedback [lattice](https://en.wikipedia.org/wiki/Lattice#Science,_technology,_and_mathematics)
  describes the possible states of feedback that can be collected about the type of a function
  argument
- all states but _Any_ are considered _monomorphic_ and _Any_ is considered _polymorphic_
- states can only change in one direction, thus going back from _Number_ to _SignedSmall_ is
  not possible for instance

<img alt="feedback lattice" src="http://benediktmeurer.de/images/2017/lattice-20171213.png" width="60%">

### Information Stored in Function Closures

```
+-------------+
|   Closure   |-------+-------------------+--------------------+
+-------------+       |                   |                    |
                      ↓                   ↓                    ↓
               +-------------+  +--------------------+  +-----------------+
               |   Context   |  | SharedFunctionInfo |  | Feedback Vector |
               +-------------+  +--------------------+  +-----------------+
                                          |             | Invocation Count|
                                          |             +-----------------+
                                          |             | Optimized Code  |
                                          |             +-----------------+
                                          |             |    Binary Op    |
                                          |             +-----------------+
                                          |
                                          |             +-----------------+
                                          +-----------> |    Byte Code    |
                                                        +-----------------+
```

- function _Closure_ links to _Context_, _SharedFunctionInfo_ and _FeedbackVector_
- Context: contains values for the _free variables_  of the function
  and provides access to global object
  - [free variables](https://en.wikipedia.org/wiki/Free_variables_and_bound_variables)
    are variables that are neither local nor paramaters to the function, i.e. they are in scope
    of the function but declared outside of it
- SharedFunctionInfo: general info about the function like source position and bytecode
- FeedbackVector: collects feedback via ICs as explained above

## TurboFan

[watch TurboFan history](https://youtu.be/EdFDJANJJLs?t=10m22s) | [watch TurboFan goals](https://youtu.be/EdFDJANJJLs?t=11m44s)

TurboFan is a simple compiler + backend responsible for the following:

- instruction selection + scheduling
  - innovative scheduling algorithm makes use of reordering freedom ([sea of nodes]()) to move
    code out of loops into less frequently executed paths
- register allocation
- code generation
- generates fast code via _speculative optimization_ from the feedback collected while running
  unoptimized bytecode
- architecture specific optimizations exploit features of each target platform for best quality
  code

TurboFan is not just an optimizing compiler:

- interpreter bytecode handlers run on top of TurboFan
- builtins benefit from TurboFan
- code stubs / IC subsystem runs on top of TurboFan
- web assembly code generation (also runs on top of TurboFan)

## Speculative Optimization

[watch](http://youtu.be/VhpdsjBUS3g?t=18m53s)

- recompiles and optimizes hot code identified by the runtime profiler
- compiler speculates that kinds of values seen in the past will be see in the future as well
- generates optimized code just for those cases which is not only smaller but also executes at
  peak speed

### `add` Example of Ignition and Feedback Vector

```
   Bytecode                Interpreter State             Machine Stack

+--------------+          +-------------------+         +--------------+
| StackCheck   | <----+   |   stack pointer   |---+     |   receiver   |
+--------------+      |   +-------------------+   |     +--------------+
|   Ldar a1    |      +-- | program counter   |   |     |      a0      |
+--------------+          +-------------------+   |     +--------------+
| Add a0, [0]  |          |   accumulator     |   |     |      a1      |
+--------------+          +-------------------+   |     +--------------+
|   Return     |                                  |     | return addr. |
+--------------+                                  |     +--------------+
                                                  |     |   context    |
                                                  |     +--------------+
                                                  |     |   closure    |
                                                  |     +--------------+
                                                  +---> | frame pointer|
                                                        +--------------+
                                                        |      ...     |
                                                        +--------------+
```

#### Bytecode annotated

```asm
StackCheck    ; check for stack overflow
Ldar a1       ; load a1 into accumulator register
Add a0, [0]   ; load value from a0 register and add it to value in accumulator register
Return        ; end execution, return value in accum. reg. and tranfer control to caller
```

#### Feedback Used To Optimize Code

[slides](https://docs.google.com/presentation/d/1wZVIqJMODGFYggueQySdiA3tUYuHNMcyp_PndgXsO1Y/edit#slide=id.g19e50fc32a_1_24)

- the `[0]` of `Add a0, [0]` refers to _feedback vector slot_ where Ignition stores profiling
  info which later is used by TurboFan to optimize the function
- `+` operator needs to perform a huge amount of checks to cover all cases, but if we assume
  that we always add numbers we don't have to handle those other cases
- additionally numbers don't call side effects and thus the compiler knows that it can
  eliminate the expression as part of the optimization

## Deoptimization

[slides](https://docs.google.com/presentation/d/1Z6oCocRASCfTqGq1GCo1jbULDGS-w-nzxkbVF7Up0u0/edit#slide=id.p) |
[slides](https://docs.google.com/presentation/d/1wZVIqJMODGFYggueQySdiA3tUYuHNMcyp_PndgXsO1Y/edit#slide=id.g19ee040be6_0_180) |
[watch](http://youtu.be/UJPdhx5zTaw?t=36m50s)

- optimizations are speculative and assumptions are made
- if assumption is violated
  - function deoptimized
  - execution resumes in Ignition bytecode
  - in short term execution slows down
  - normal to occur
  - more info about about function collected
  - _better_ optimization attempted
  - if assumptions are violated again, deoptimized again and start over
- too many deoptimizations cause function to be sent to *deoptimization hell*
  - considered not optimizable and no optimization is **ever** attempted again
- assumptions are verified as follows:
  - _code objects_ are verified via a `test` in the _prologue_ of the generated machine code for a
    particular function
  - argument types are verified before entering the function body

### Bailout

[watch bailout example](https://youtu.be/u7zRSm8jzvA?t=26m43s) | [watch walk through TurboFan optimized code with bailouts](https://youtu.be/u7zRSm8jzvA?t=19m36s)

- when assumptions made by optimizing compiler don't hold it bails out to deoptimized code
- on bail out the code object is _thrown_ away as it doesn't handle the current case
- _trampoline_ to unoptimized code (stored in SharedFunctionInfo) used to _jump_ and continue
  execution

#### Example of x86 Assembly Code including Checks and Bailouts

```asm
; x64 machine code generated by TurboFan for the Add Example above
; expecting that both parameters and the result are Smis

leaq rcx, [rip+0x0]             ; load memory address of instruction pointer into rcx
movq rcx, [rcx-0x37]            ; copy code object stored right in front into rcx
testb [rcx+0xf], 0x1            ; check if code object is valid
jnz CompileLazyDeoptimizedCode  ; if not bail out via a jump

[ .. ]                          ; push registers onto stack

cmpq rsp, [r13+0xdb0]           ; enough space on stack to execute code?
jna StackCheck                  ; if not we're sad and raise stack overflow

movq rax, [rbp+0x18]            ; load x into rax
test al, 0x1                    ; check tag bit to ensure x is small integer
jnz Deoptimize                  ; if not bail

movq rbx, [rbp+0x10]            ; load y into rbx
testb rbx, 0x1                  ; check tag bit to ensure y is small integer
jnz Deoptimize                  ; if not bail

[ .. ]                          ; do some nifty conversions via shifts
                                ; and store results in rdx and rcx

addl rdx, rcx                   ; perform add including overflow check
jo Deoptimize                   ; if overflowed bail

[ .. ]                          ; cleanup and return to caller
```

### Lazy Cleanup of Optimized Code

[read](https://v8project.blogspot.com/2017/10/lazy-unlinking.html)

- code objects created during optimization are no longer useful after deoptimization
- on deoptimization embedded fields of code object are invalidated, however code object itself
  is kept alive
- for performance reasons unlinking of code object is postponed until next invocation of the
  function in question

### Deoptimization Loop

[read](https://v8project.blogspot.com/2018/02/v8-release-65.html)

- occurred when optimized code deoptimized and there was _no way to learn what went wrong_
- one cause was altering the shape of the array in the callback function of a second order
  array builtin, i.e. by changing it's length
- TurboFan kept trying to optimized and gave up after ~30 attempts
- starting with v8 v6.5 this is detected and array built in is no longer inlined at that site
  on future optimization attempts

### Causes for Deoptimization

#### Modifying Object Shape

[watch](http://youtu.be/VhpdsjBUS3g?t=21m00s)

- added fields (order matters) to object generate id of hidden class
- adding more fields later on generates new class id which results in code using Point that now gets Point' to be
  deoptimized

[watch](http://youtu.be/VhpdsjBUS3g?t=21m45s)
[watch](http://youtu.be/UJPdhx5zTaw?t=12m18s)

```js
function Point(x, y) {
  this.x = x;
  this.y = y;
}

var p = new Point(1, 2); // => hidden Point class created

// ....

p.z = 3;                 // => another hidden class (Point') created
```

- `Point` class created, code still deoptimized
- functions that have `Point` argument are optimized
- `z` property added which causes `Point'` class to be created
- functions that get passed `Point'` but were optimized for `Point` get deoptimized
- later functions get optimized again, this time supporting `Point` and `Point'` as argument
- [detailed explanation](http://v8-io12.appspot.com/index.html#30)

##### Considerations

- avoid hidden class changes
- initialize all members in **constructor function** and **in the same order**

#### Class Definitions inside Functions

```js
function createPoint(x, y) {
  class Point {
    constructor(x, y) {
      this.x = x
      this.y = y
    }

    distance(other) {
      const dx = Math.abs(this.x - other.x)
      const dy = Math.abs(this.y - other.y)
      return dx + dy
    }
  }

  return new Point(x, y)
}
function usePoint(point) {
  // do something with the point
}
```

- defining a class inside `createPoint` results in its definition to be executed on each
  `createPoint` invocation
- executing that definition causes a new prototype to be created along with methods and
  constructor
- thus each new point has a different prototype and thus a different object shape
- passing these objects with differing prototypes to `usePoint` makes that function
  become polymorphic
- v8 gives up on polymorphism after it has seen **more than 4** different object shapes, and enters
  megamorphic state
- as a result `usePoint` won't be optimized
- pulling the `Point` class definition out of the `createPoint` function fixes that issue as
  now the class definition is only executed once and all point prototypes match
- the performance improvement resulting from this simple change is substantial, the exact
  speedup factor depends on the `usePoint` function
- when class or prototype definition is collected it's hidden class (associated maps) are
  collected as well
- need to re-learn hidden classes for short living objects including metadata and all feedback
  collected by inline caches
- references to maps and JS objects from optimized code are considered weak to avoid memory
  leaks

##### Considerations

- always declare classes at the script scope, i.e. _never inside functions_ when it is
  avoidable

##### Resources

- [optimization patterns part1](http://benediktmeurer.de/2017/06/20/javascript-optimization-patterns-part1/)
- [The case of temporary objects in Chrome](http://benediktmeurer.de/2016/10/11/the-case-of-temporary-objects-in-chrome/)

### Inlining Functions

[watch](https://youtu.be/u7zRSm8jzvA?t=26m12s)

- smart heuristics, i.e. how many times was the function called so far

## Background Compilation

[read](https://v8project.blogspot.com/2018/03/background-compilation.html)

- part of the compilation pipeline that doesn't acess objects on the JavaScript heap run on a
  background thread
- via some optimization to the bytecode compiler and how AST is stored and accessed, almost all
  of the compilation of a script happens on a background thread
- only short AST internalizatoin and bytecode finalization happens on main thread

## Sea Of Nodes

[slides](https://docs.google.com/presentation/d/1sOEF4MlF7LeO7uq-uThJSulJlTh--wgLeaVibsbb3tc/edit#slide=id.g5499b9c42_074) |
[slides](https://docs.google.com/presentation/d/1sOEF4MlF7LeO7uq-uThJSulJlTh--wgLeaVibsbb3tc/edit#slide=id.g5499b9c42_0105) |
[read](http://darksi.de/d.sea-of-nodes/)

- doesn't include total order of program, but _control dependencies_ between operations
- instead expresses many possible legal orderings of code
- most efficient ordering and placement can be derived from the _nodes_
  - depends on control dominance, loop nesting, register pressure
- _graph reductions_ applied to further optimize
- total ordering (traditional CFG) is built from that, so code can be generated and registers
  allocated
- entrypoints are TurboFan optimizing compiler and WASM Compiler

### Advantages

[slide](https://docs.google.com/presentation/d/1H1lLsbclvzyOF3IUR05ZUaZcqDxo7_-8f4yJoxdMooU/edit#slide=id.g18ceb14729_0_92)

Flexibility of sea of nodes approach enables the below optimizations.

- better redundant code elimination due to more code motion
- loop peeling
- load/check elimination
- escape analysis [watch](https://youtu.be/KiWEWLwQ3oI?t=7m25s) | [watch](https://youtu.be/KiWEWLwQ3oI?t=17m25s)
  - eliminates non-escaping allocations
  - aggregates like `const o = { foo: 1, bar: 2}` are replaces with scalars like
    `const o_foo = 1; const o_bar = 2`
- representation selection
  - optimizing of number representation via type and range analysis
  - [slides](https://docs.google.com/presentation/d/1sOEF4MlF7LeO7uq-uThJSulJlTh--wgLeaVibsbb3tc/edit#slide=id.g5499b9c42_094)
- redundant store elimination
- control flow elimination
  - turns branch chains into switches
- allocation folding and write barrier elimination
- verify var is only assigned once (SSA - single static assignment)
    - compiler may move the assignment anywhere, i.e. outside a loop
    - may remove redundant checks

## CodeStubAssembler

[watch](https://youtu.be/M1FBosB5tjM?t=23m38s) |
[read](https://v8project.blogspot.com/2017/11/csa.html) |
[slides](https://docs.google.com/presentation/d/1u6bsgRBqyVY3RddMfF1ZaJ1hWmqHZiVMuPRw_iKpHlY/edit#slide=id.g17a3a2e7fd_0_114) |
[slides](https://docs.google.com/presentation/d/1u6bsgRBqyVY3RddMfF1ZaJ1hWmqHZiVMuPRw_iKpHlY/edit#slide=id.p)

### What is the CodeStubAssember aka CSA?

- defines a portable assembly language built on top of TurboFan's backend and adds a C++ based
  API to generate highly portable TurboFan machine-level IR directly
- can generate highly efficient code for parts of slow-paths in JS without crossing to C++
  runtime
- API includes very low-level operations (pretty much assembly), _primitive_ CSA instructions
  that translate directly into one or two assembly instructions
- Macros include fixed set of pre-defined CSA instructions corresponding to most commonly used
  assembly instructions

![CSA pipeline](https://1.bp.blogspot.com/-mWTltdSfO1c/Wg2f-CyCWqI/AAAAAAAAA5E/VOKT8nTzxpQMsZ0Wt-mzB1ivYU2NLg_-gCLcBGAs/s1600/csa.png)
_CSA and JavaScript compilation pipelines_

### Why is it a Game Changer?

The CSA allows much faster iteration when implementing and optimizing new language features due
to the following characteristics.

- CSA includes type verification at IR level to catch many correctness bugs at compile time
- CSA's instruction selector ensures that optimal code is generated on all platforms
- CSA's performs register allocations automatically
- CSA understands API calling conventions, both standard C++ and internal v8 register-based,
  i.e. entry-point stubs into C++ can easily be called from CSA,  making trivial to
  interoperate between CSA generated code and other parts of v8
- CSA-based built in functionality can easily be inlined into Ignition bytecode handlers to
  improve its performance
- builtins are coded in that DSL (no longer [self hosted](https://en.wikipedia.org/wiki/Self-hosting))
- very fast property accesses

#### Improvements via CodeStubAssembler

[slide](https://docs.google.com/presentation/d/1H1lLsbclvzyOF3IUR05ZUaZcqDxo7_-8f4yJoxdMooU/edit#slide=id.g18ceb14721_0_50)

CSA is the basis for fast builtins and thus was used to speed up multiple builtins. Below are a
few examples.

-  [faster Regular Expressions](./js-feature-improvements.md#regular-expressions) sped up by
   removing need to switch between C++ and JavaScript runtimes
- `Object.create` has predictable performance by using CodeStubAssembler
- `Function.prototype.bind` achieved final boost when ported to CodeStubAssembler for a total
  60,000% improvement
- `Promise`s where ported to CodeStubAssembler which resulted in 500% speedup for `async/await`

## Recommendations

[watch](https://youtu.be/M1FBosB5tjM?t=52m54s) |
[watch](https://youtu.be/HDuSEbLWyOY?t=10m36s) |
[slide](https://docs.google.com/presentation/d/1_eLlVzcj94_G4r9j9d_Lj5HRKFnq6jgpuPJtnmIBs88/edit#slide=id.g2134da681e_0_577)

- performance of your code is improved
- less _anti patterns_ aka _you are holding it wrong_
- write idiomatic, declarative JavaScript as in _easy to read_ JavaScript with good data structures and algorithms, including all language features (even functional ones) will execute with predictable, good performance
- instead focus on your application design
- now can handle exceptions where it makes sense as `try/catch/finally` no longer ruins the performance of a function
- use appropriate collections as their performance is on par with the raw use of Objects for same task
  - Maps, Sets, WeakMaps, WeakSets used where it makes sense results in easier maintainable JavaScript as they offer specific functionality to iterate over and inspect their values
- avoid engine specific workarounds aka _CrankshaftScript_, instead file a bug report if you discover a bottleneck

## Resources

- [V8: Behind the Scenes (November Edition) - 2016](http://benediktmeurer.de/2016/11/25/v8-behind-the-scenes-november-edition/)
- [V8: Behind the Scenes (February Edition - 2017)](http://benediktmeurer.de/2017/03/01/v8-behind-the-scenes-february-edition/)
- [An Introduction to Speculative Optimization in V8 - 2017](http://benediktmeurer.de/2017/12/13/an-introduction-to-speculative-optimization-in-v8/)
- [High-performance ES2015 and beyond - 2017](https://v8project.blogspot.com/2017/02/high-performance-es2015-and-beyond.html)
- [Launching Ignition and TurboFan - 2017](https://v8project.blogspot.com/2017/05/launching-ignition-and-turbofan.html)
- [lazy unlinking of deoptimized functions - 2017](https://v8project.blogspot.com/2017/10/lazy-unlinking.html)
- [Taming architecture complexity in V8 — the CodeStubAssembler - 2017](https://v8project.blogspot.com/2017/11/csa.html)
- [V8 release v6.5 - 2018](https://v8project.blogspot.com/2018/02/v8-release-65.html)
- [Background compilation - 2018](https://v8project.blogspot.com/2018/03/background-compilation.html)
- [Sea of Nodes - 2015](http://darksi.de/d.sea-of-nodes/)

### Slides

- [CodeStubAssembler: Redux - 2016](https://docs.google.com/presentation/d/1u6bsgRBqyVY3RddMfF1ZaJ1hWmqHZiVMuPRw_iKpHlY/edit#slide=id.p)
- [Deoptimization in V8 - 2016](https://docs.google.com/presentation/d/1Z6oCocRASCfTqGq1GCo1jbULDGS-w-nzxkbVF7Up0u0/edit#slide=id.p)
- [Turbofan IR - 2016](https://docs.google.com/presentation/d/1Z9iIHojKDrXvZ27gRX51UxHD-bKf1QcPzSijntpMJBM/edit#slide=id.p)
- [TurboFan: A new code generation architecture for V8 - 2017](https://docs.google.com/presentation/d/1_eLlVzcj94_G4r9j9d_Lj5HRKFnq6jgpuPJtnmIBs88/edit#slide=id.p)
- [Fast arithmetic for dynamic languages - 2016](https://docs.google.com/presentation/d/1wZVIqJMODGFYggueQySdiA3tUYuHNMcyp_PndgXsO1Y/edit#slide=id.p)
- [An overview of the TurboFan compiler - 2016](https://docs.google.com/presentation/d/1H1lLsbclvzyOF3IUR05ZUaZcqDxo7_-8f4yJoxdMooU/edit#slide=id.p)
- [TurboFan JIT Design - 2016](https://docs.google.com/presentation/d/1sOEF4MlF7LeO7uq-uThJSulJlTh--wgLeaVibsbb3tc/edit#slide=id.p)

### Videos

- [performance improvements in latest v8 - 2017](https://youtu.be/HDuSEbLWyOY?t=4m58s)
- [v8 and how it listens to you - ICs and FeedbackVectors - 2017](https://www.youtube.com/watch?v=u7zRSm8jzvA)
- [Escape Analysis in V8 - 2018](https://www.youtube.com/watch?v=KiWEWLwQ3oI)

### More Resources

- [TurboFan wiki](https://github.com/v8/v8/wiki/TurboFan)
