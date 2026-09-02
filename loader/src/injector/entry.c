#include "daemon.h"
#include "logging.h"
#include "misc.h"

#include "hook.h"
#include "ptrace_clear.h"

__attribute__((visibility("default")))
void entry(void *addr, size_t size, int tango_flag) {
  LOGD("ReZygisk%s library injected, version %s", tango_flag ? " [TANGO]" : "", ZKSU_VERSION);

  start_addr = addr;
  block_size = size;

  if (!rezygiskd_zygote_injected()) {
    LOGE("ReZygiskd is not running");
    return;
  }

  LOGD("start plt hooking");
  if (!hook_functions()) {
    LOGE("Failed to initialize PLT hooks; leaving zygote unmodified");
    return;
  }

  struct kernel_version version = parse_kversion();
  if (version.major > 3 || (version.major == 3 && version.minor >= 8)) {
    LOGD("Supported kernel version %d.%d.%d, sending seccomp event", version.major, version.minor, version.patch);

    perform_ptrace_message_clear();
  }

  LOGD("Zygisk library execution done, addr: %p, size: %zu", addr, size);
}
