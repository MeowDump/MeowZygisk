# About this repo

_This is my personal fork of the original repository, modified to fit my own needs and workflow._

_Feel free to use it if you find it useful. If you run into any issues or have suggestions, you're welcome to report them._

_I’ll try to fix reported problems whenever I have some free time, but please keep in mind that this is a personal project and there are no guarantees of active maintenance._

**Thanks!**

--------

## Installation

### 1. Select the right zip

The selection of the build/zip is important, as it will determine how hidden and stable ReZygisk will be. This, however, is not a hard task:

- `release` should be the one chosen for most cases, it removes app-level logging and offers more optimized binaries.
- `debug`, however, offers the opposite, with heavy logging and no optimizations, For this reason, **you should only use it for debugging purposes** and **when obtaining logs for creating an Issue**.

### 2. Flash the zip

After choosing the right build, you should flash it using your current root manager, like Magisk or KernelSU or APatch. You can do this by going to the `Modules` section of your root manager and selecting the zip you downloaded.

After flashing, check the installation logs to ensure there are no errors, and if everything is fine, you can reboot your device.

> [!WARNING]
> Magisk users should disable built-in Zygisk, as it will conflict with ReZygisk. This can be done by going to the `Settings` section of Magisk and disabling the `Zygisk` option.

### 3. Verify the installation

After rebooting, you can verify if ReZygisk is working properly by checking the module description in the `Modules` section of your root manager. The description should indicate that the necessary daemons are running. For example, if your environment supports both 64-bit and 32-bit, it should look similar to this: `[Monitor: ✅, ReZygisk 64-bit: ✅, ReZygisk 32-bit: ✅] Standalone implementation of Zygisk.`


## Support

For any question related to this ReZygisk fork, feel free to contact me on telegram

- Telegram: [MEOWna](https://t.me/TempMeow)
- Telegram Group Chat: [@MeowVerse](https://t.me/MeowDump)


## License

ReZygisk fork is licensed under [AGPL 3.0](./LICENSE). You can read more about it on [Open Source Initiative](https://opensource.org/licenses/AGPL-3.0).
