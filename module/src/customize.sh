# shellcheck disable=SC2034
SKIPUNZIP=1

DEBUG=@DEBUG@

if [ "$DEBUG" = true ]; then
  mkdir -p /data/adb/rezygisk
  touch /data/adb/rezygisk/log
fi

MIN_KSU_VERSION=@MIN_KSU_VERSION@
MIN_KSUD_VERSION=@MIN_KSUD_VERSION@
MIN_MAGISK_VERSION=@MIN_MAGISK_VERSION@
MIN_APATCH_VERSION=@MIN_APATCH_VERSION@

if [ "$BOOTMODE" ] && [ "$KSU" ]; then
  ui_print "- Installing from KernelSU app"
  ui_print "- KernelSU version: $KSU_KERNEL_VER_CODE (kernel) + $KSU_VER_CODE (ksud)"
  if ! [ "$KSU_KERNEL_VER_CODE" ] || [ "$KSU_KERNEL_VER_CODE" -lt "$MIN_KSU_VERSION" ]; then
    ui_print "*********************************************************"
    ui_print "! KernelSU version is too old!"
    ui_print "! Please update KernelSU to latest version"
    abort    "*********************************************************"
  fi
  if ! [ "$KSU_VER_CODE" ] || [ "$KSU_VER_CODE" -lt "$MIN_KSUD_VERSION" ]; then
    ui_print "*********************************************************"
    ui_print "! ksud version is too old!"
    ui_print "! Please update KernelSU Manager to latest version"
    abort    "*********************************************************"
  fi
  if [ "$(which magisk)" ]; then
    ui_print "*********************************************************"
    ui_print "! Multiple root implementation is NOT supported!"
    ui_print "! Please uninstall Magisk before installing ReZygisk"
    abort    "*********************************************************"
  fi
  elif [ "$BOOTMODE" ] && [ "$APATCH" ]; then
    ui_print "- Installing from APatch app"
    if ! [ "$APATCH_VER_CODE" ] || [ "$APATCH_VER_CODE" -lt "$MIN_APATCH_VERSION" ]; then
      ui_print "*********************************************************"
      ui_print "! APatch version is too old!"
      ui_print "! Please update APatch to latest version"
      abort    "*********************************************************"
    fi
elif [ "$BOOTMODE" ] && [ "$MAGISK_VER_CODE" ]; then
  ui_print "- Installing from Magisk app"
  if [ "$MAGISK_VER_CODE" -lt "$MIN_MAGISK_VERSION" ]; then
    ui_print "*********************************************************"
    ui_print "! Magisk version is too old!"
    ui_print "! Please update Magisk to latest version"
    abort    "*********************************************************"
  fi
else
  ui_print "*********************************************************"
  ui_print "! Install from recovery is not supported"
  ui_print "! Please install from KernelSU or Magisk app"
  abort    "*********************************************************"
fi

VERSION=$(grep_prop version "${TMPDIR}/module.prop")
ui_print "- Installing ReZygisk $VERSION"

# check android
if [ "$API" -lt 25 ]; then
  ui_print "! Unsupported sdk: $API"
  abort "! Minimal supported sdk is 25 (Android 7.1)"
else
  ui_print "- Device sdk: $API"
fi

# check architecture
if [ "$ARCH" != "arm" ] && [ "$ARCH" != "arm64" ] && [ "$ARCH" != "x86" ] && [ "$ARCH" != "x64" ]; then
  abort "! Unsupported platform: $ARCH"
else
  ui_print "- Device platform: $ARCH"
fi

for incompatible_module in zygisk_assistant nohello; do
  for module_dir in \
    "/data/adb/modules/$incompatible_module" \
    "/data/adb/modules_update/$incompatible_module"; do

    if [ -d "$module_dir" ]; then
      touch "$module_dir/remove"
      ui_print "! $incompatible_module is incompatible with integrated Meow Wheel."
      ui_print "! Removal has been scheduled. Reboot to apply changes."
      break
    fi
  done
done

ui_print "- Extracting verify.sh"
unzip -o "$ZIPFILE" 'verify.sh' -d "$TMPDIR" >&2
if [ ! -f "$TMPDIR/verify.sh" ]; then
  ui_print "*********************************************************"
  ui_print "! Unable to extract verify.sh!"
  ui_print "! This zip may be corrupted, please try downloading again"
  abort    "*********************************************************"
fi
. "$TMPDIR/verify.sh"
extract "$ZIPFILE" 'customize.sh'  "$TMPDIR/.vunzip"
extract "$ZIPFILE" 'verify.sh'     "$TMPDIR/.vunzip"
extract "$ZIPFILE" 'sepolicy.rule' "$TMPDIR"

if [ "$KSU" ]; then
  ui_print "- Checking SELinux patches"
  if ! check_sepolicy "$TMPDIR/sepolicy.rule"; then
    ui_print "*********************************************************"
    ui_print "! Unable to apply SELinux patches!"
    ui_print "! Your kernel may not support SELinux patch fully"
    abort    "*********************************************************"
  fi
fi

ui_print "- Extracting module files"
extract "$ZIPFILE" 'module.prop'     "$MODPATH"
extract "$ZIPFILE" 'post-fs-data.sh' "$MODPATH"
extract "$ZIPFILE" 'service.sh'      "$MODPATH"
extract "$ZIPFILE" 'uninstall.sh'    "$MODPATH"
extract "$ZIPFILE" 'action.sh'       "$MODPATH"
extract "$ZIPFILE" 'shortcut.png'    "$MODPATH"
extract "$ZIPFILE" 'rezygisk.sh' "/data/adb/post-fs-data.d/"
extract "$ZIPFILE" 'mda.sh' "/data/adb/post-fs-data.d/"
chmod 0755 "/data/adb/post-fs-data.d/mda.sh"

# Nuke ZN if exist
for d in /data/adb/modules/zygisksu /data/adb/modules_update/zygisksu; do [ -d "$d" ] && touch "$d/remove" "$d/disable"; done; [ -d /data/adb/modules/zygisksu ] || [ -d /data/adb/modules_update/zygisksu ] && echo "ZygiskNext will be removed on next reboot"

# INFO: KernelSU 2.x.x and below runs post-fs-data.d before mounting
#         the modules. This disallows us to clean our own module.prop.
#         To work around this, we utilize post-mount.d which runs after
#         mounting, and copy our post-fs-data.d script there.
#
# SOURCES:
#  - https://github.com/tiann/KernelSU/blob/6615068a987a12bbc6a3ad272b285cec7f594964/userspace/ksud/src/init_event.rs#L123
#  - https://github.com/tiann/KernelSU/blob/6615068a987a12bbc6a3ad272b285cec7f594964/userspace/ksud/src/init_event.rs#L161
#  - https://github.com/tiann/KernelSU/blob/6615068a987a12bbc6a3ad272b285cec7f594964/userspace/ksud/src/init_event.rs#L212-L217
mkdir -p /data/adb/post-mount.d
cp "/data/adb/post-fs-data.d/rezygisk.sh" "/data/adb/post-mount.d/rezygisk.sh"

cp "$MODPATH/module.prop" "$MODPATH/module.prop.bak"

chmod +x "$MODPATH/uninstall.sh"

mv "$TMPDIR/sepolicy.rule" "$MODPATH"

mkdir "$MODPATH/bin"
mkdir "$MODPATH/webroot"

ui_print "- Extracting webroot"
unzip -o "$ZIPFILE" "webroot/*" -x "*.sha256" -d "$MODPATH"

# INFO: Utilize the one with the biggest output, as some devices with Tango have the full list
#         in ro.product.cpu.abilist but others only have a subset there, and the full list in
#         ro.system.product.cpu.abilist
CPU_ABIS_PROP1=$(getprop ro.system.product.cpu.abilist)
CPU_ABIS_PROP2=$(getprop ro.product.cpu.abilist)

if [ "${#CPU_ABIS_PROP2}" -gt "${#CPU_ABIS_PROP1}" ]; then
  CPU_ABIS=$CPU_ABIS_PROP2
else
  CPU_ABIS=$CPU_ABIS_PROP1
fi

if [ -z "$CPU_ABIS" ]; then
  abort "! Unable to determine supported CPU architectures"
fi

SUPPORTS_32BIT=false
SUPPORTS_64BIT=false

if [[ "$CPU_ABIS" == *"x86"* && "$CPU_ABIS" != "x86_64" || "$CPU_ABIS" == *"armeabi"* ]]; then
  SUPPORTS_32BIT=true
  ui_print "- Device supports 32-bit"
fi

if [[ "$CPU_ABIS" == *"x86_64"* || "$CPU_ABIS" == *"arm64-v8a"* ]]; then
  SUPPORTS_64BIT=true
  ui_print "- Device supports 64-bit"
fi

if [ "$SUPPORTS_32BIT" = false ] && [ "$SUPPORTS_64BIT" = false ]; then
  abort "! Unable to determine supported CPU architectures"
fi

if [ "$SUPPORTS_32BIT" = true ]; then
  mkdir "$MODPATH/lib"
fi

if [ "$SUPPORTS_64BIT" = true ]; then
  mkdir "$MODPATH/lib64"
fi

if [ "$ARCH" = "x86" ] || [ "$ARCH" = "x64" ]; then
  if [ "$SUPPORTS_32BIT" = true ]; then
    ui_print "- Extracting x86 libraries"
    extract "$ZIPFILE" 'bin/x86/zygiskd' "$MODPATH/bin" true
    mv "$MODPATH/bin/zygiskd" "$MODPATH/bin/zygiskd32"
    extract "$ZIPFILE" 'lib/x86/libzygisk.so' "$MODPATH/lib" true
    extract "$ZIPFILE" 'lib/x86/libzygisk_ptrace.so' "$MODPATH/bin" true
    mv "$MODPATH/bin/libzygisk_ptrace.so" "$MODPATH/bin/zygisk-ptrace32"

    extract "$ZIPFILE" 'machikado.x86' "$MODPATH" true
  fi

  if [ "$SUPPORTS_64BIT" = true ]; then
    ui_print "- Extracting x64 libraries"
    extract "$ZIPFILE" 'bin/x86_64/zygiskd' "$MODPATH/bin" true
    mv "$MODPATH/bin/zygiskd" "$MODPATH/bin/zygiskd64"
    extract "$ZIPFILE" 'lib/x86_64/libzygisk.so' "$MODPATH/lib64" true
    extract "$ZIPFILE" 'lib/x86_64/libzygisk_ptrace.so' "$MODPATH/bin" true
    mv "$MODPATH/bin/libzygisk_ptrace.so" "$MODPATH/bin/zygisk-ptrace64"

    extract "$ZIPFILE" 'machikado.x86_64' "$MODPATH" true
  fi
else
  if [ "$SUPPORTS_32BIT" = true ]; then
    ui_print "- Extracting arm libraries"
    extract "$ZIPFILE" 'bin/armeabi-v7a/zygiskd' "$MODPATH/bin" true
    mv "$MODPATH/bin/zygiskd" "$MODPATH/bin/zygiskd32"
    extract "$ZIPFILE" 'lib/armeabi-v7a/libzygisk.so' "$MODPATH/lib" true
    extract "$ZIPFILE" 'lib/armeabi-v7a/libzygisk_ptrace.so' "$MODPATH/bin" true
    mv "$MODPATH/bin/libzygisk_ptrace.so" "$MODPATH/bin/zygisk-ptrace32"

    extract "$ZIPFILE" 'machikado.arm' "$MODPATH" true
  fi

  if [ "$SUPPORTS_64BIT" = true ]; then
    ui_print "- Extracting arm64 libraries"
    extract "$ZIPFILE" 'bin/arm64-v8a/zygiskd' "$MODPATH/bin" true
    mv "$MODPATH/bin/zygiskd" "$MODPATH/bin/zygiskd64"
    extract "$ZIPFILE" 'lib/arm64-v8a/libzygisk.so' "$MODPATH/lib64" true
    extract "$ZIPFILE" 'lib/arm64-v8a/libzygisk_ptrace.so' "$MODPATH/bin" true
    mv "$MODPATH/bin/libzygisk_ptrace.so" "$MODPATH/bin/zygisk-ptrace64"

    extract "$ZIPFILE" 'machikado.arm64' "$MODPATH" true
  fi
fi

ui_print "- Setting permissions"
set_perm_recursive "$MODPATH/bin" 0 0 0755 0755

if [ "$SUPPORTS_32BIT" = true ]; then
  set_perm_recursive "$MODPATH/lib" 0 0 0755 0644 u:object_r:system_lib_file:s0
fi

if [ "$SUPPORTS_64BIT" = true ]; then
  set_perm_recursive "$MODPATH/lib64" 0 0 0755 0644 u:object_r:system_lib_file:s0
fi

ui_print "- Installing integrated Meow Wheel"
mkdir -p "$MODPATH/meow-wheel"
unzip -o "$ZIPFILE" "meow-wheel/*" -d "$MODPATH" >&2
if ! rm -rf "$MODPATH/meow-wheel/zygisk"; then
  abort "! Unable to remove obsolete nested Meow Wheel libraries"
fi
if [ ! -f "$MODPATH/meow-wheel/module.prop" ] || [ ! -f "$MODPATH/meow-wheel/LICENSE" ] || [ ! -d "$MODPATH/meow-wheel/cmd" ]; then
  abort "! Meow Wheel payload is missing or incomplete"
fi
set_perm_recursive "$MODPATH/meow-wheel" 0 0 0755 0755
chmod 0644 "$MODPATH/meow-wheel/module.prop" "$MODPATH/meow-wheel/LICENSE"
for wheel_binary in "$MODPATH"/meow-wheel/cmd/*/treat-wheel; do
  [ -f "$wheel_binary" ] && chmod 0755 "$wheel_binary"
done

case "$ARCH" in
  arm64) WHEEL_CMD_ARCH=arm64-v8a ;;
  arm) WHEEL_CMD_ARCH=armeabi-v7a ;;
  x64) WHEEL_CMD_ARCH=x86_64 ;;
  x86) WHEEL_CMD_ARCH=x86 ;;
esac
if [ ! -x "$MODPATH/meow-wheel/cmd/$WHEEL_CMD_ARCH/treat-wheel" ]; then
  abort "! Missing Meow Wheel command binary for $ARCH"
fi

# Preserve a user's previous standalone Meow Wheel state.
WHEEL_STANDALONE_FOUND=false
WHEEL_WAS_DISABLED=false
for old_wheel in /data/adb/modules/treat_wheel /data/adb/modules_update/treat_wheel; do
  if [ -d "$old_wheel" ]; then
    WHEEL_STANDALONE_FOUND=true
    if [ -f "$old_wheel/disable" ]; then
      WHEEL_WAS_DISABLED=true
    fi
  fi
done
# The integrated copy is now installed; remove standalone module directories to
# prevent ReZygisk from loading Meow Wheel twice
if ! rm -rf /data/adb/modules/treat_wheel /data/adb/modules_update/treat_wheel; then
  abort "! Unable to remove the previous standalone Meow Wheel installation"
fi

if ! mkdir -p /data/adb/treat_wheel; then
  abort "! Unable to prepare Meow Wheel's persistent configuration directory"
fi
if [ "$WHEEL_STANDALONE_FOUND" = true ]; then
  if [ "$WHEEL_WAS_DISABLED" = true ]; then
    touch /data/adb/treat_wheel/disabled || abort "! Unable to migrate Meow Wheel's disabled state"
  else
    rm -f /data/adb/treat_wheel/disabled || abort "! Unable to migrate Meow Wheel's enabled state"
  fi
fi
if [ ! -f /data/adb/treat_wheel/state ]; then
  : > /data/adb/treat_wheel/state || abort "! Unable to initialize Meow Wheel's configuration"
fi
if ! grep -q '^disable_revanced_mounts_umount=' /data/adb/treat_wheel/state; then
  echo 'disable_revanced_mounts_umount=true' >> /data/adb/treat_wheel/state || abort "! Unable to initialize Meow Wheel defaults"
fi
if ! grep -q '^disable_denylist_logic_inversion=' /data/adb/treat_wheel/state; then
  echo 'disable_denylist_logic_inversion=true' >> /data/adb/treat_wheel/state || abort "! Unable to initialize Meow Wheel defaults"
fi

# If Huawei's Maple is enabled, system_server is created with a special way which is out of Zygisk's control
HUAWEI_MAPLE_ENABLED=$(grep_prop ro.maple.enable)
if [ "$HUAWEI_MAPLE_ENABLED" == "1" ]; then
  ui_print "- Add ro.maple.enable=0"
  echo "ro.maple.enable=0" >>"$MODPATH/system.prop"
fi

# Remove packaged SHA-256 sidecar files from MODPATH
ui_print "- Cleaning SHA-256 sidecar files"
find "$MODPATH" -type f -name '*.sha256' -exec rm -f {} \;
