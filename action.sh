# Meow's Debug Assistant's Secure Censor
#
# A tool to redact sensitive information from the extremely verbose debug logs of Meow's Debug Assistant.
# LICENSE: BSD 3-Clause by ThePedroo

echo "Selecting the latest debug log file..."

if [ -f "/data/local/tmp/DebugAssistant-Boot3.log" ]; then
  LATEST_DEBUG_LOG="/data/local/tmp/DebugAssistant-Boot3.log"
elif [ -f "/data/local/tmp/DebugAssistant-Boot2.log" ]; then
  LATEST_DEBUG_LOG="/data/local/tmp/DebugAssistant-Boot2.log"
elif [ -f "/data/local/tmp/DebugAssistant.log" ]; then
  LATEST_DEBUG_LOG="/data/local/tmp/DebugAssistant.log"
else
  echo "No debug log found."
  exit 1
fi

echo "Latest debug log selected: $LATEST_DEBUG_LOG"

NEW_LOG="/data/local/tmp/DebugAssistant-Redacted.log"
if [ -f "$NEW_LOG" ]; then
  rm "$NEW_LOG"
fi

echo "Redacting sensitive information..."

sed -E                                                                   \
  -e 's/([0-9]{1,3}\.){3}[0-9]{1,3}/XXX.XXX.XXX/g'                       \
                                                                         \
  -e 's/Created new content cache dir \[[^]]+\]/Created new content cache dir [REDACTED]/g' \
                                                                         \
  -e 's/[a-zA-Z0-9._%+-]+@([a-z0-9-]*[a-z][a-z0-9-]*\.)+[a-z]{2,}/REDACTED_EMAIL/g' \
                                                                         \
  -e 's/SSID: <[^>]+>/SSID: <REDACTED>/g'                                \
  -e 's/BSSID: [0-9a-fA-F:]+/BSSID: XX:XX:XX:XX:XX:XX/g'                 \
  -e 's/MAC: [0-9a-fA-F:]+/MAC: XX:XX:XX:XX:XX:XX/g'                     \
                                                                         \
  -e 's/LinkAddresses: \[[^]]+\]/LinkAddresses: [REDACTED]/g'            \
  -e 's/Routes: \[[^]]+\]/Routes: [REDACTED]/g'                          \
  -e 's/ServerAddress: [^ ]+/ServerAddress: REDACTED/g'                  \
  -e 's/InterfaceName: [^ ]+/InterfaceName: REDACTED/g'                  \
  -e 's/SSID: "[^"]+"/SSID: "REDACTED"/g'                                \
  -e 's/SSID="[^"]+"/SSID="REDACTED"/g'                                  \
  -e 's/BSSID=[0-9a-fA-F:]+/BSSID=XX:XX:XX:XX:XX:XX/g'                   \
  -e 's/MAC=[0-9a-fA-F:]+/MAC=XX:XX:XX:XX:XX:XX/g'                       \
  -e 's/(Requesting package name: <[^>]*>)"[^"]*"/\1"REDACTED"/g'        \
                                                                         \
  -e 's/Cannot find network with networkId -1 or configKey "[^"]*"/Cannot find network with networkId -1 or configKey "REDACTED"/g' \
                                                                         \
  -e 's/connectToNetwork "[^"]*"/connectToNetwork "REDACTED"/g'          \
                                                                         \
  -e 's/Selecting supplicant SSID "[^"]*"/Selecting supplicant SSID "REDACTED"/g' \
                                                                         \
  -e 's/Trying to associate with SSID '\''[^'\'']*'\''/Trying to associate with SSID '\''REDACTED'\''/g' \
                                                                         \
  -e 's/addressUpdated: [^ ]+ on ifindex [0-9]+ flags 0x[0-9a-fA-F]+ scope [0-9]+/addressUpdated: REDACTED on ifindex REDACTED flags REDACTED scope REDACTED/g' \
                                                                         \
                                                                         \
                                                                         \
  "$LATEST_DEBUG_LOG" > "$NEW_LOG"

echo "Redacted logs in $NEW_LOG"