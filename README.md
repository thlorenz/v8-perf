# v8-perf

Notes and resources related to v8 and thus Node.js performance.

- [data types](https://github.com/thlorenz/v8-perf/blob/master/data-types.md)
- [v8 compiler](https://github.com/thlorenz/v8-perf/blob/master/compiler.md)
- [v8 garbage collector](https://github.com/thlorenz/v8-perf/blob/master/gc.md)
- [memory profiling](https://github.com/thlorenz/v8-perf/blob/master/memory-profiling.md)
- [performance profiling](https://github.com/thlorenz/v8-perf/blob/master/performance-profiling.md)
- [runtime functions](https://github.com/thlorenz/v8-perf/blob/master/runtime-functions.md)

## v8 source and documentation

It's best to dig into the source to confirm assumptions about v8 performance first hand.

### source 

- [home of v8 source code](https://code.google.com/p/v8/)
- [v8 code search](https://code.google.com/p/v8/codesearch)
- [v8 source code mirror on github](https://github.com/v8/v8/)

### documentation

Documentation for specific v8 versions generated from the v8 source and included with the
[gh-pages](https://thlorenz.github.io/v8-dox/) of the v8-dox repo.

Below is a list of the documentation along with links to the code on github and the related Node.js version.

- [v8 3.11.10](https://thlorenz.github.io/v8-dox/build/v8-3.11.10/html/) | [code](https://github.com/v8/v8/tree/3.11.10) | [node 0.8.26](https://github.com/joyent/node/tree/v0.8.26)
- [v8 3.14.5](https://thlorenz.github.io/v8-dox/build/v8-3.14.5/html/)   | [code](https://github.com/v8/v8/tree/3.14.5)  | [node 0.10.28](https://github.com/joyent/node/tree/v0.10.28)
- [v8 3.25.30](https://thlorenz.github.io/v8-dox/build/v8-3.25.30/html/) | [code](https://github.com/v8/v8/tree/3.25.30) | [node 0.11.13](https://github.com/joyent/node/tree/v0.11.13)

The documentation includes code that contains links to related code, data types, etc. which is highly useful to explore
how the pieces fit together.

In case you want to customize the documentation, checkout the `gh-pages` branch of this repo, configure the [doxygen
template](https://github.com/thlorenz/v8-perf/blob/gh-pages/build/template.doxygen) and run `npm start` which will
rebuild the documentation. I'm open to pull requests that improve on it. *Requires [doxygen](http://www.stack.nl/~dimitri/doxygen/download.html) and [graphviz](http://www.graphviz.org/Download..php) to be installed on your machine*.

## Tests

Some tests were added to confirm some of the assumptions made in the docs, you can run them as follows:

```sh
git clone https://github.com/thlorenz/v8-perf.git && cd v8-perf
npm install
npm test
```

### Tools, Features used in Tests

- [**runtime functions**](https://github.com/thlorenz/v8-perf/blob/master/runtime-functions.md): via the `--allow-runtime-functions`
  flag, i.e. see [this test](https://github.com/thlorenz/v8-perf/blob/master/test/fast-elements.js)
