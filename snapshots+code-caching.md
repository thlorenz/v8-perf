# Snapshots and Code Caching

This document explains techniques used by V8 in order to avoid having to re-compile and
optimized JavaScript whenever an application that embeds it (i.e. Chrome or Node.js) starts up
fresh.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Code Caching](#code-caching)
  - [Chrome's Use of Code Caching](#chromes-use-of-code-caching)
  - [Resources](#resources)
- [Startup Snapshots](#startup-snapshots)
  - [Custom Startup Snapshots](#custom-startup-snapshots)
  - [Lazy Deserialization](#lazy-deserialization)
  - [Resources](#resources-1)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Code Caching

- lessens overhead of parsing + compiling script
- uses cached data to recreate previous compilation result
- exposed via V8's API to embedders
  - pass `v8::ScriptCompiler::kProduceCodeCache` as an option when compiling script
    - Note: V8 is deprecating `v8::ScriptCompiler::kProduceCodeCache` in favor of
      `v8::ScriptCompiler::GetCodeCache` 
  - cached data is attached to source object to be retrieved via
    `v8::ScriptCompiler::Source::GetCachedData`
  - can be persisted for later
  - later cache data can be attached to the source object and passed
    `v8::ScriptCompiler::kConsumeCodeCache` as an option to cause V8 to bypass compileing the
    code and deserialize the provided cache data instead
- V8 6.6 caches top level code as well as code generated _after_ script's top-level execution,
  which means that lazily compiled functions are included in the cache

### Chrome's Use of Code Caching

Since Chrome embeds V8 it can make use of Code Caching and does so as follows.

- cold load: page loaded for the first time and thus no cached data is available
- warm load: page loaded before and caches compiled code along with the script file in disk
  cache
  - to qualify, the last load needs to be within the last 72 hours and the script source be
    larger than 1KB
- hot load: page loaded twice before and thus can use the cached compiled code instead of
  parsing + compiling the script again

### Resources

- [Code caching - 2015](https://v8.dev/blog/code-caching)
- [Code caching after execution - 2018](https://v8.dev/blog/v8-release-66)
- [V8 ScriptRunner source](https://cs.chromium.org/chromium/src/third_party/blink/renderer/bindings/core/v8/v8_script_runner.cc?l=269&rcl=c59618d0f92b57e4dcfb903f3c99bb0574eac340)

## Startup Snapshots

### Custom Startup Snapshots

- V8 uses snapshots and lazy deserialization to _retrieve_ previously optimized code for builtin
  functions
- powerful snapshot API exposed to embedders via `v8::SnapshotCreator`
- among other things this API allows embedders to provide an additional script to customize a
  start-up snapshot
- new contexts created from the snapshot are initialized in a state obtained _after_ the script
  executed
- native C++ functions are recognized and encoded by the serializer as long as they have been
  registered with V8
- serializer cannot _directly_ capture state outside of V8, thus outside state needs to be
  attached to a JavaScript object via _embedder fields_

### Lazy Deserialization

[read](https://v8.dev/blog/lazy-deserialization)

- only about 30% of builtin functions are used on average
- deserialize builtin function from the snapshot when it is called the first time
- functions have _well-known_ positions within the snapshot's dedicated builtins area
- starting offset of each code object is kept in a dedicated section within builtins area
- additionally implemented lazy deserializations for bytecode handlers, which contain logic to
  execute each bytecode within Ignition interpreter
- enabled in V8 v6.4 resulting in average V8's heap size savings of 540 KB

### Resources

- [custom startup snapshots - 2015](https://v8.dev/blog/custom-startup-snapshots)
  somewhat out of date as embedder API changed and lazy deserialization was introduced
- [Energizing Atom with V8's custom start-up snapshot - 2017](https://v8.dev/blog/custom-startup-snapshots)
- [Lazy deserialization - 2018](https://v8.dev/blog/lazy-deserialization)
- [Speeding up Node.js startup using V8 snapshot](https://docs.google.com/document/d/1YEIBdH7ocJfm6PWISKw03szNAgnstA2B3e8PZr_-Gp4/edit)
