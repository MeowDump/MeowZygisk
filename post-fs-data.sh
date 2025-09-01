# Meow's Debug Assistant
#
# A tool to collect extremely verbose debug log from the Android system.
# LICENSE: BSD 3-Clause by ThePedroo

SAVE_FOLDER=/data/local/tmp

function prepare_file() {
  local file_path="$SAVE_FOLDER/DebugAssistant$1.log"

  touch "$file_path"
  chown shell:shell "$file_path"
}

function watch_logcat() {
  local file_path="$SAVE_FOLDER/DebugAssistant$1.log"

  su -c "logcat -f \"$file_path\"" &
}

# Check if file exists
if [ -f $SAVE_FOLDER/DebugAssistant.log ]; then
  # Check if file -2 exists
  if [ -f $SAVE_FOLDER/DebugAssistant-Boot2.log ]; then
    # Check if file -3 exists
    if [ -f $SAVE_FOLDER/DebugAssistant-Boot3.log ]; then
      rm $SAVE_FOLDER/DebugAssistant-Boot3.log
      rm $SAVE_FOLDER/DebugAssistant-Boot2.log
      rm $SAVE_FOLDER/DebugAssistant.log

      prepare_file ""
      watch_logcat ""
    else
      prepare_file "-Boot3"
      watch_logcat "-Boot3"
    fi
  else
    prepare_file "-Boot2"
    watch_logcat "-Boot2"
  fi
else
  prepare_file ""
  watch_logcat ""
fi
