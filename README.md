# v8-perf

Notes and resources related to V8 and thus Node.js performance.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Topics](#topics)
  - [Data Types](#data-types)
  - [Compiler](#compiler)
  - [Language Features](#language-features)
  - [Garbage Collector](#garbage-collector)
  - [Memory Profiling](#memory-profiling)
  - [Inspection and Performance Profiling](#inspection-and-performance-profiling)
  - [Snapshots and Code Caching](#snapshots-and-code-caching)
  - [Runtime Functions](#runtime-functions)
- [V8 source and documentation](#v8-source-and-documentation)
  - [source](#source)
  - [source documentation](#source-documentation)
- [LICENSE](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Topics

### Data Types

The [data types](data-types.md) document explains what data types V8 uses under the hood to
store JavaScript data and how it relates to the performance of your code.

### Compiler

The [V8 compiler](compiler.md) document outlines the V8 compiler pipeline including the
Ignition Interpreter and TurboFan optimizing compiler. It explains how information about your
code is executed to allow optimizations, how and when deoptimizations occur and how features
like the CodeStubAssembler allowed reducing performance bottlenecks found in the [older
pipeline](crankshaft/compiler.md).

### Language Features

The [language features](language-features.md) document lists JavaScript language features and
provides info with regard to their performance mainly to provide assurance that performance of
most features is no longer an issue as it was with the previous compiler pipeline.

### Garbage Collector

The [V8 garbage collector](gc.md) document talks about how memory is organized on the V8 heap,
how garbage collection is performed and how it was parallelized as much as possible to avoid
pausing the main thread more than necessary.

### Memory Profiling

The [memory profiling](memory-profiling.md) document explains how JavaScript objects are
referenced to form a tree of nodes which the garbage collector uses to determine _collectable_
objects. It also outlines numerous techniques to profile memory leaks and allocations.

### Inspection and Performance Profiling

Inside the [inspection](inspection.md) document you will find techniques that allow you to
profile your Node.js or web app, how to produce flamegraphs and what flags and tools are
available to gain an insight into operations of V8 itself.

### Snapshots and Code Caching

[This document](snapshots+code-caching.md) includes information as to how V8 uses caching
techniques in order to avoid recompiling scripts during initialization and thus achieve faster
startup times.

### Runtime Functions

The [runtime functions](runtime-functions.md) document gives a quick intro into C++ functions
accessible from JavaScript that can be used to provide information of the V8 engine as well as
direct it to take a specific action like optimize a function on next call.

## V8 source and documentation

It's best to dig into the source to confirm assumptions about V8 performance first hand.

### source

- [home of V8 source code](https://code.google.com/p/v8/)
- [V8 code search](https://code.google.com/p/v8/codesearch)
- [V8 source code mirror on github](https://github.com/v8/v8/)

### source documentation

Documented V8 source code for specific versions of Node.js can be found on the [v8docs
page](https://v8docs.nodesource.com/).

## LICENSE

MIT
