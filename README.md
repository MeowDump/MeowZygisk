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

After rebooting, you can verify if ReZygisk is working properly by checking the module description in the `Modules` section of your root manager. The description should indicate that the necessary daemons are running. For example, if your environment supports both 64-bit and 32-bit, it should look similar to this: `Status: ✅, Zygisk 64-bit: ✅, Zygisk 32-bit: ✅`

## Bug Report

- If you see ⚠️ in the module description, click the Action button and share the generated log file with [MEOWna](https://t.me/HelloMona).

- If the issue occurs in the release build (the filename doesn't contain `debug`), open the WebUI, enable **DEBUG LOGGING**, and reboot your device. After rebooting, click the Action button and share the generated log file with [MEOWna](https://t.me/HelloMona).

## Expected warning on KernelSU

KernelSU logs this for our `sepolicy.rule` on every boot:

```
W KernelSU: ksud::sepolicy: apply sepolicy batch partially succeeded: 24/27
```

This is expected and is not the reason why Zygisk would not work. ksud submits the whole file as one
batch and the kernel skips the statements whose types do not exist in the device's base policy, and
it only reports a count instead of the statements: on KernelSU the two rules that can never apply are
`allow zygote magisk lnk_file read` (KernelSU has no `magisk` type, the `ksu` rules below already
cover it) and `allow zygote nsfs file {read open}` (no `nsfs` type on some vendors, for example
OxygenOS 16), which is exactly the 3 atomic statements missing from `24/27`.

Everything ReZygisk needs is still applied: `zygisk_file` exists in `/sys/fs/selinux/policy`,
`/data/adb/rezygisk/cp64.sock` is labelled `u:object_r:zygisk_file:s0`, and modules are injected. If
the module description shows `Status: ✅`, ignore the warning and look elsewhere.

## Support

For any question related to this ReZygisk fork, feel free to contact me on telegram

- Telegram ID: [MEOWna](https://t.me/HelloMona)
- Telegram Group Chat: [@MeowVerse](https://t.me/MeowDump)


## License

ReZygisk fork is licensed under [AGPL 3.0](./LICENSE). You can read more about it on [Open Source Initiative](https://opensource.org/licenses/AGPL-3.0).
