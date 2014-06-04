# v8 runtime functions

- v8 JS lib uses minimal set of C+ runtime functions (callable from JavaScript)
- lots of these have names starting with `%` and are visible
- others aren't visible as they are only called by generated code
  - [test for these can be found here](https://github.com/v8/v8/tree/master/test/mjsunit/runtime-gen)

## Usage

- allow access via `--allow-natives-syntax`
- [example test using runtime
  functions](https://github.com/thlorenz/v8-perf/blob/0d32979a42a05b4d8aa97bf42d017c7a02e9d8e3/test/fast-elements.js#L9-L13)
- examples on how to use them can be found inside [v8
  tests](https://github.com/v8/v8/search?q=--allow-natives-syntax+size%3A%3E400&type=Code) (size set to `>400` to filter
  out generated runtime functions)

## Resources

- [very sparce/useless doc on v8 wiki](https://code.google.com/p/v8/wiki/RuntimeFunctions)
