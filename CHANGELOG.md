# Changelog

## [2.0.1](https://github.com/hbmartin/attio-ts-sdk/compare/attio-ts-sdk-v2.0.0...attio-ts-sdk-v2.0.1) (2026-02-09)


### Bug Fixes

* **attio:** keep filter types strict with parser bridge ([6631c1d](https://github.com/hbmartin/attio-ts-sdk/commit/6631c1d361ca6692bbca248f335add05af6e7e5c))
* **attio:** keep filter types strict with parser bridge ([ca67bcc](https://github.com/hbmartin/attio-ts-sdk/commit/ca67bcc22423e6cb6886f92d51eb577b386f00e5))
* **attio:** validate list and record filters with zod ([a9f7b26](https://github.com/hbmartin/attio-ts-sdk/commit/a9f7b26030a7e34ec00708dc5297e3a9de061cf8))
* **attio:** validate list and record filters with zod ([4734411](https://github.com/hbmartin/attio-ts-sdk/commit/473441120099223ed3ade5652ddede901f00003b))
* use AttioFilter type for ListEntryFilter and RecordFilter ([c988437](https://github.com/hbmartin/attio-ts-sdk/commit/c988437cf345e879e5425b9a8ae046730a3823c0))
* use AttioFilter type for ListEntryFilter and RecordFilter ([8e7e00e](https://github.com/hbmartin/attio-ts-sdk/commit/8e7e00e7fbe6de760067f825f31acbb0b4384a83))

## [2.0.0](https://github.com/hbmartin/attio-ts-sdk/compare/attio-ts-sdk-v1.2.1...attio-ts-sdk-v2.0.0) (2026-02-07)


### ⚠ BREAKING CHANGES

* The fetchPage callback signature for async pagination functions has changed to receive the AbortSignal:

### Features

* add async generator pagination and auto-pagination for queries ([01fd423](https://github.com/hbmartin/attio-ts-sdk/commit/01fd423f49c235c2577622d7d02ae961f11c655b))
* add async generator pagination and auto-pagination for queries ([8820089](https://github.com/hbmartin/attio-ts-sdk/commit/8820089bf808106df82e77c058ab7c04e6966cc3))
* add itemSchema support to create/update/upsert/getRecord ([2837710](https://github.com/hbmartin/attio-ts-sdk/commit/2837710e9714d390c9c06e1eb052713d578d6e88))
* add itemSchema support to queryRecords for type-safe validation ([a54e114](https://github.com/hbmartin/attio-ts-sdk/commit/a54e1142c49dd4261000c230887aacf17c3396d2))
* add itemSchema support to queryRecords for type-safe validation ([b1a4a98](https://github.com/hbmartin/attio-ts-sdk/commit/b1a4a983e5b51ec67584e33f299efd96b34dd52f))
* add missing filter operators and path-based filtering ([cae90c3](https://github.com/hbmartin/attio-ts-sdk/commit/cae90c343bc99219bca2e3953680fd5a0f57bc07))
* add missing filter operators and path-based filtering ([f77b6bd](https://github.com/hbmartin/attio-ts-sdk/commit/f77b6bd538a339e355f0a611fa4db6ef2dd43f24))
* forward AbortSignal to fetchPage callbacks for in-flight cancellation ([b99c13a](https://github.com/hbmartin/attio-ts-sdk/commit/b99c13a3c55a969b5b7c9a70a4f63640c6160486))
* make input types generic to enable proper type inference ([802b0d2](https://github.com/hbmartin/attio-ts-sdk/commit/802b0d2d02c390d86045f2189ede3d51065100fd))
* make input types generic to enable proper type inference ([2ee0a8c](https://github.com/hbmartin/attio-ts-sdk/commit/2ee0a8c7c7aa08a680563bcb8c86d3503bbfa59e))


### Bug Fixes

* forward AbortSignal to single-page queries for request cancellation ([087c19b](https://github.com/hbmartin/attio-ts-sdk/commit/087c19b61fd3de24727473e905592cc9d2d12533))
* forward AbortSignal to single-page queries for request cancellation ([04c06ee](https://github.com/hbmartin/attio-ts-sdk/commit/04c06ee8ac689004756547b1eb0aca39073fa387))
* re-establish normalizeRecords mock after resetAllMocks in tests ([9d8220e](https://github.com/hbmartin/attio-ts-sdk/commit/9d8220ec8643de432652783c75f1a58eba85e8c9))
* replace unsafe type assertion with Zod validation in queryListEntries ([a834377](https://github.com/hbmartin/attio-ts-sdk/commit/a834377d6da1d9481b312a369f69f95b7126c736))
* replace unsafe type assertion with Zod validation in queryListEntries ([175078a](https://github.com/hbmartin/attio-ts-sdk/commit/175078adbe3799a23234479d4179721f8591e570))
* validate records after normalization to ensure type safety ([098a488](https://github.com/hbmartin/attio-ts-sdk/commit/098a488f564d4211a32dadd047da0758076d079b))

## [1.2.1](https://github.com/hbmartin/attio-ts-sdk/compare/attio-ts-sdk-v1.2.0...attio-ts-sdk-v1.2.1) (2026-02-03)


### Bug Fixes

* make all enums nullable to handle null values from API ([b0bb56d](https://github.com/hbmartin/attio-ts-sdk/commit/b0bb56dd47aec168aee9cac230c7469ee49e596d))
* make all enums nullable to handle null values from API ([8e82e6e](https://github.com/hbmartin/attio-ts-sdk/commit/8e82e6e352c2ed3bf495f0f1dfa80a72fc252e35))

## [1.2.0](https://github.com/hbmartin/attio-ts-sdk/compare/attio-ts-sdk-v1.1.1...attio-ts-sdk-v1.2.0) (2026-02-03)


### Features

* make SDK compatible with Deno and other non-Node runtimes ([ce90bcb](https://github.com/hbmartin/attio-ts-sdk/commit/ce90bcb95cad5595c4a761a05a45079da5df0b24))
* make SDK compatible with Deno and other non-Node runtimes ([7d3c66e](https://github.com/hbmartin/attio-ts-sdk/commit/7d3c66e32201b4d0ac90a3744d5b080e5d801fd5))
* replace z.optional with z.nullish to accept null values from API ([e2e583c](https://github.com/hbmartin/attio-ts-sdk/commit/e2e583c6e66fc0b58b888439781333efa5740e19))
* replace z.optional with z.nullish to accept null values from API ([f6a5264](https://github.com/hbmartin/attio-ts-sdk/commit/f6a5264f6a792d41e57bd9f2369eed616d5dbd48))


### Bug Fixes

* add attw config to ignore cjs-resolves-to-esm for ESM-only package ([14b430e](https://github.com/hbmartin/attio-ts-sdk/commit/14b430e9d9cf238326ed9a523c1115b734b818e2))

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
