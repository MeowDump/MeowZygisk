#!/system/bin/sh

DEBUG=@DEBUG@

if [ "$DEBUG" = true ]; then
set -e
fi

MODDIR=${0%/*}

if [ "$ZYGISK_ENABLED" ]; then
  sed -i "s|^description=|description=[❌ Disable Magisk's built-in Zygisk] |" "$MODDIR/module.prop"

  exit 0
fi

cd "$MODDIR"

if [ ! -f "/data/adb/treat_wheel/disabled" ]; then
  case "$(uname -m)" in
    aarch64|arm64) WHEEL_ARCH=arm64-v8a ;;
    armv7l|armv8l|arm) WHEEL_ARCH=armeabi-v7a ;;
    x86_64|amd64) WHEEL_ARCH=x86_64 ;;
    i686|i386|x86) WHEEL_ARCH=x86 ;;
    *) WHEEL_ARCH= ;;
  esac

  WHEEL_BINARY="$MODDIR/meow-wheel/cmd/$WHEEL_ARCH/treat-wheel"
  if [ -n "$WHEEL_ARCH" ] && [ -x "$WHEEL_BINARY" ]; then
    "$WHEEL_BINARY" &
  else
    log -p e -t "Meow Wheel" "No compatible treat-wheel binary for $(uname -m)"
  fi
fi

if [ "$(which magisk)" ]; then
  for file in ../*; do
    if [ -d "$file" ] && [ -d "$file/zygisk" ] && ! [ -f "$file/disable" ]; then
      if [ -f "$file/service.sh" ]; then
        cd "$file"
        log -p i -t "zygisk-sh" "Manually trigger service.sh for $file"
        sh "$(realpath ./service.sh)" &
        cd "$MODDIR"
      fi
    fi
  done
fi

exit 0
