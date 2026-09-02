> Release Date: 02/09/2026

## Major Changes

- **Improved ptrace handling** : Added better handling for `SIGCONT` and `PTRACE_SYSCALL`, with improved continuation error detection and logging. [`c64d319`](https://github.com/MeowDump/MeowZygisk/commit/c64d31992bb849f56c8502a96f3653eae1cdded9), [`23a4713`](https://github.com/MeowDump/MeowZygisk/commit/23a4713bc168a60a2981aca90acbc111a7f0da36), [`881e3d2`](https://github.com/MeowDump/MeowZygisk/commit/881e3d2b37944e486df75a848f6d793bb9ca442e)

- **Refactored module registration and hooking** : Reworked module registration and hook-function handling, including checks for `ReZygiskd` before installing hooks. [`0dd1ef9`](https://github.com/MeowDump/MeowZygisk/commit/0dd1ef9c3d2a4d41a78d2435d6c5c74af863e8df), [`1acd8f2`](https://github.com/MeowDump/MeowZygisk/commit/1acd8f207cde7a4637617537617e6f48dc923d4c), [`f4303c4`](https://github.com/MeowDump/MeowZygisk/commit/f4303c451b9cf266da8434721798aee610ffaf5e)

- **Added process memory utilities** : Introduced utility functions for process memory manipulation with additional input validation for read/write operations. [`5f5d3eb`](https://github.com/MeowDump/MeowZygisk/commit/5f5d3eb90fce258714867c0333db1bc9a79bdbed), [`412289c`](https://github.com/MeowDump/MeowZygisk/commit/412289c3a245e9bac855b41eb6f6e4dc72b29a0f)

- **Added runtime and language support** : Added runtime management and expanded language support with Arabic, Chinese, and Russian translations. [`ff9148c`](https://github.com/MeowDump/MeowZygisk/commit/ff9148c08ed8c2b5e0e0337b7e12395a5fb96587), [`e51ab3b`](https://github.com/MeowDump/MeowZygisk/commit/e51ab3bebfab223f0fafb4564030e286246f2ddc), [`abe3e08`](https://github.com/MeowDump/MeowZygisk/commit/abe3e08e76575b1d1fecbdf2764ef797f66cebb0), [`fc9a290`](https://github.com/MeowDump/MeowZygisk/commit/fc9a290887da03bae75a716b0c2582a2ac4a7889), [`3dcb2ae`](https://github.com/MeowDump/MeowZygisk/commit/3dcb2ae6b5e30153be9aaaa1b223f18e6ddb41d7), [`34b3545`](https://github.com/MeowDump/MeowZygisk/commit/34b354564ba852ad8c5632a649f575f81a3e012c)

- **Improved module validation and safety** : Added validation for module names, libraries, module counts, and related limits. [`7979706`](https://github.com/MeowDump/MeowZygisk/commit/797970666f38cd73dddd159c670b7b4b5cdcae90), [`2bea481`](https://github.com/MeowDump/MeowZygisk/commit/2bea481a0e5175836694e0c93964b671f7384e1e), [`5c23cb8`](https://github.com/MeowDump/MeowZygisk/commit/5c23cb8490e8f5f503c872d2ab6d55ec869f7541)

## Compatibility & Integration

- **Improved Zygisk Next compatibility** : Fixed a conflict with Zygisk Next. [`ba74d73`](https://github.com/MeowDump/MeowZygisk/commit/ba74d73eade3f260bd6364648fae6b1560c2e104)

- **Updated KernelSU integration** : Updated the KernelSU daemon path. [`8e66c39`](https://github.com/MeowDump/MeowZygisk/commit/8e66c3947f6db66a0f0177d6b4a661bd3ae28a50)

- **Updated module metadata** : Updated the module name, author information, and `updateJson` configuration. [`1d67c55`](https://github.com/MeowDump/MeowZygisk/commit/1d67c550388a3c01d5fd73a6eeab88cc0d3e5a80), [`0972de3`](https://github.com/MeowDump/MeowZygisk/commit/0972de33c35813c70194f54d563f33fd3336da85)

- **Added OTA update support** : Added support for OTA updates. [`dec0b5d`](https://github.com/MeowDump/MeowZygisk/commit/dec0b5d367cd35439fe5a8bf07c4aa5e30746936)

## Build & CI

- **Improved build configuration** : Refined Makefile flags and added `-fno-strict-aliasing` to the NDK compiler flags. [`8c7906d`](https://github.com/MeowDump/MeowZygisk/commit/8c7906df956e0d536dcb25d90002049d23e29b90), [`c68713a`](https://github.com/MeowDump/MeowZygisk/commit/c68713a5855200678e032eba48ee0861df31ef8f)

- **Fixed CI artifact handling** : Updated artifact paths and fixed CI artifact upload issues caused by `common.mk`. [`608194c`](https://github.com/MeowDump/MeowZygisk/commit/608194c188bdb89b20a3844dc282416b64fc22bb), [`e2c888f`](https://github.com/MeowDump/MeowZygisk/commit/e2c888f18ff38cb0994b4b2cf0874ab92bf9a72b), [`e87b49f`](https://github.com/MeowDump/MeowZygisk/commit/e87b49f3f6cdca904a8e665a97a5832f05c42a89), [`4552d71`](https://github.com/MeowDump/MeowZygisk/commit/4552d718d014c34a464df9d2b624e7b3aedc4596)

## WebUI

- **Refactored the WebUI** : Improved the WebUI structure, metadata, theming, and runtime management. [`cbb9b64`](https://github.com/MeowDump/MeowZygisk/commit/cbb9b640c1dce622aed0d203cb397a467d3b7f3e), [`21a817d`](https://github.com/MeowDump/MeowZygisk/commit/21a817d19a6b1706c06e393c92334253dc903090), [`ff9148c`](https://github.com/MeowDump/MeowZygisk/commit/ff9148c08ed8c2b5e0e0337b7e12395a5fb96587)

- **Added multilingual WebUI support** : Added Arabic, Chinese, and Russian language resources and language selection support. [`d99693c`](https://github.com/MeowDump/MeowZygisk/commit/d99693cf0891595e4d5c4f2e78c67b647a8080cb), [`e51ab3b`](https://github.com/MeowDump/MeowZygisk/commit/e51ab3bebfab223f0fafb4564030e286246f2ddc), [`abe3e08`](https://github.com/MeowDump/MeowZygisk/commit/abe3e08e76575b1d1fecbdf2764ef797f66cebb0), [`fc9a290`](https://github.com/MeowDump/MeowZygisk/commit/fc9a290887da03bae75a716b0c2582a2ac4a7889), [`3dcb2ae`](https://github.com/MeowDump/MeowZygisk/commit/3dcb2ae6b5e30153be9aaaa1b223f18e6ddb41d7), [`34b3545`](https://github.com/MeowDump/MeowZygisk/commit/34b354564ba852ad8c5632a649f575f81a3e012c)

- **Removed legacy WebUI components** : Removed obsolete pages, themes, stylesheets, fonts, icons, scripts, and unused language resources as part of the WebUI cleanup.

## Project Cleanup

- **Removed obsolete documentation and tooling** : Removed translation documentation and CLA assistance tooling. [`1f4d384`](https://github.com/MeowDump/MeowZygisk/commit/1f4d3840a959a809bf46d1f0d90821fac1e3c054), [`be4dcb5`](https://github.com/MeowDump/MeowZygisk/commit/be4dcb54d945c24210c27b2feabcd276da961df7), [`0601129`](https://github.com/MeowDump/MeowZygisk/commit/0601129eed0047c4aaefa176a9cc44bc3f8db3df)

- **Added project-specific documentation** : Added a personal-fork disclaimer and changelog placeholder. [`d3dd3c1`](https://github.com/MeowDump/MeowZygisk/commit/d3dd3c1e6fe717d466d09ff98b58dd01209d2ec6), [`444959c`](https://github.com/MeowDump/MeowZygisk/commit/444959c4d9674410c3ef250e50a268392d24acd4)
