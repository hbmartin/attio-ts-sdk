# Changelog

## [1.1.1](https://github.com/hbmartin/attio-ts-sdk/compare/attio-ts-sdk-v1.1.0...attio-ts-sdk-v1.1.1) (2026-02-03)


### Bug Fixes

* **codegen:** resolve date format mismatch for timestamp fields ([d4c171d](https://github.com/hbmartin/attio-ts-sdk/commit/d4c171d87f779d0bd3d31f0bb48b5f946651827e))
* **codegen:** resolve date format mismatch for timestamp fields ([f2a7589](https://github.com/hbmartin/attio-ts-sdk/commit/f2a7589d4520b77eae6f72edc26458c1a77e3b95))

## [1.1.0](https://github.com/hbmartin/attio-ts-sdk/compare/attio-ts-sdk-v1.0.0...attio-ts-sdk-v1.1.0) (2026-02-02)


### Features

* **attio:** add ergonomics helpers and sdk ([70f753f](https://github.com/hbmartin/attio-ts-sdk/commit/70f753f24c104574d7f1d118b87786d1998153ff))
* **attio:** add ergonomics helpers and sdk ([ba7f0ee](https://github.com/hbmartin/attio-ts-sdk/commit/ba7f0eeb28a9fb37502e88b593a6632d6bbe0cc7))
* **attio:** improve type safety and add Zod validation ([373d22e](https://github.com/hbmartin/attio-ts-sdk/commit/373d22e4af84fd0d85019286a686e71c00cad2b2))
* **attio:** improve type safety and add Zod validation ([6979a50](https://github.com/hbmartin/attio-ts-sdk/commit/6979a501473e1fae034b34a1b3f23ab07c77459e))
* **tasks:** add options parameter to deleteTask ([977a11a](https://github.com/hbmartin/attio-ts-sdk/commit/977a11ae18998c043ccf38d072427377d14ab2a7))


### Bug Fixes

* **cache:** handle undefined authToken in hashToken ([033d41d](https://github.com/hbmartin/attio-ts-sdk/commit/033d41de4d6aaa2dcb8d79debe0243e4e73dbf54))
* **cache:** honor config changes in getMetadataCacheManager ([61a253d](https://github.com/hbmartin/attio-ts-sdk/commit/61a253def216d87b1899b02b167c9ba06abb85a8))
* **metadata:** delete invalid cache entry when schema parsing fails ([f111aae](https://github.com/hbmartin/attio-ts-sdk/commit/f111aae5da96167e15d6fab8349a177602955a65))
* **metadata:** treat cache parsing failure as cache miss ([bf42f16](https://github.com/hbmartin/attio-ts-sdk/commit/bf42f16ede8af7c4332609dfa1fb77a61e75f534))
* **metadata:** treat cache parsing failure as cache miss ([a0e67c0](https://github.com/hbmartin/attio-ts-sdk/commit/a0e67c0bdc7a30bd0172c280ccaabf629fee80a6))
* **metadata:** use consistent AttioResponseError for cache schema validation ([e706acf](https://github.com/hbmartin/attio-ts-sdk/commit/e706acf356856fd66608d5085efcb148a534f629))
* **tasks:** return API result from deleteTask instead of boolean ([3f98ef9](https://github.com/hbmartin/attio-ts-sdk/commit/3f98ef9217fb906eb0d079391827e12a31e49861))
* **types:** align wrappers with generated request shapes ([50a804d](https://github.com/hbmartin/attio-ts-sdk/commit/50a804d24d2dfd9dfca1b9ea6666781ca46b1645))
* **types:** align wrappers with generated request shapes ([477507a](https://github.com/hbmartin/attio-ts-sdk/commit/477507a0c18ee46f73244372d05f65dc3cc352e2))
* **types:** wrap AbortSignalConstructor in declare global block ([2cc6249](https://github.com/hbmartin/attio-ts-sdk/commit/2cc62495892f3da00d89255e999dfa5a1ff2a505))

## 1.0.0 (2026-01-22)


### Bug Fixes

* **record-utils:** return parsedRaw instead of raw in normalizeRecord ([e2342b8](https://github.com/hbmartin/attio-ts-sdk/commit/e2342b89fd1df60e7e85ef18d40dde79c1af1e81))
* throw AttioRetryError when retries are exhausted ([c86984c](https://github.com/hbmartin/attio-ts-sdk/commit/c86984c1932aa0f19864cdb1b3d9f1f0b92f4dd1))
* throw AttioRetryError when retries are exhausted ([d50a236](https://github.com/hbmartin/attio-ts-sdk/commit/d50a2364278dc7bdbe206bce386f5402e1b043dd))
* validate record input with parseObject ([60b5b3d](https://github.com/hbmartin/attio-ts-sdk/commit/60b5b3da5d15fe40fc29b6202d104cdf79399ae7))
