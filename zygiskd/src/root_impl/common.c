#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#include "common.h"

#include "../utils.h"
#include "apatch.h"
#include "kernelsu.h"
#include "magisk.h"

static struct root_impl impl;


#define ROOT_IMPL_STATE_PATH "/data/adb/rezygisk/root_impl"
#define ROOT_IMPL_STATE_TMP ROOT_IMPL_STATE_PATH ".tmp"
#define ROOT_IMPL_STATE_MAGIC 0x525A4B53u

struct shared_root_impl_state {
  uint32_t magic;
  uint32_t pid;
  uint32_t impl;
  uint32_t variant;
};

#if defined(__LP64__)
static bool publish_root_impl_state(void) {
  if (impl.impl != KernelSU && impl.impl != APatch && impl.impl != Magisk) return false;

  struct shared_root_impl_state state = {
    .magic = ROOT_IMPL_STATE_MAGIC,
    .pid = (uint32_t)getpid(),
    .impl = (uint32_t)impl.impl,
    .variant = impl.variant
  };

  int fd = open(ROOT_IMPL_STATE_TMP, O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC | O_NOFOLLOW, 0600);
  if (fd == -1) {
    LOGW("Failed creating shared root implementation state: %s", strerror(errno));
    return false;
  }

  const uint8_t *data = (const uint8_t *)&state;
  size_t remaining = sizeof(state);
  while (remaining > 0) {
    ssize_t written = write(fd, data, remaining);
    if (written == -1 && errno == EINTR) continue;
    if (written <= 0) {
      int saved_errno = written == 0 ? EIO : errno;
      close(fd);
      unlink(ROOT_IMPL_STATE_TMP);
      LOGW("Failed writing shared root implementation state: %s", strerror(saved_errno));
      return false;
    }
    data += written;
    remaining -= (size_t)written;
  }

  if (fsync(fd) == -1) {
    int saved_errno = errno;
    close(fd);
    unlink(ROOT_IMPL_STATE_TMP);
    LOGW("Failed syncing shared root implementation state: %s", strerror(saved_errno));
    return false;
  }

  close(fd);
  if (rename(ROOT_IMPL_STATE_TMP, ROOT_IMPL_STATE_PATH) == -1) {
    LOGW("Failed publishing shared root implementation state: %s", strerror(errno));
    unlink(ROOT_IMPL_STATE_TMP);
    return false;
  }

  return true;
}

#else
static bool read_shared_root_impl_state(struct root_impl *shared) {
  for (unsigned int attempt = 0; attempt < 30; attempt++) {
    struct shared_root_impl_state state = { 0 };
    int fd = open(ROOT_IMPL_STATE_PATH, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
    if (fd >= 0) {
      ssize_t nread = read(fd, &state, sizeof(state));
      close(fd);

      if (nread == (ssize_t)sizeof(state) &&
          state.magic == ROOT_IMPL_STATE_MAGIC &&
          state.pid > 1 &&
          (state.impl == KernelSU || state.impl == APatch || state.impl == Magisk) &&
          (kill((pid_t)state.pid, 0) == 0 || errno == EPERM)) {
        shared->impl = (enum root_impls)state.impl;
        shared->variant = (uint8_t)state.variant;
        return true;
      }
    }

    const struct timespec delay = { .tv_sec = 0, .tv_nsec = 50000000 };
    nanosleep(&delay, NULL);
  }

  return false;
}
#endif

void root_impls_setup(void) {
  struct root_impl_state state_ksu;
  ksu_get_existence(&state_ksu);

  struct root_impl_state state_apatch;
  apatch_get_existence(&state_apatch);

  struct root_impl_state state_magisk;
  magisk_get_existence(&state_magisk);

  /* INFO: Check if it's only one supported, if not, it's multile and that's bad.
            Remember that true here is equal to the integer 1. */
  if ((state_ksu.state == Supported ? 1 : 0) + (state_apatch.state == Supported ? 1 : 0) + (state_magisk.state == Supported ? 1 : 0) >= 2) {
    impl.impl = Multiple;
  } else if (state_ksu.state == Supported) {
    impl.impl = KernelSU;
    impl.variant = state_ksu.variant;
  } else if (state_apatch.state == Supported) {
    impl.impl = APatch;
  } else if (state_magisk.state == Supported) {
    impl.impl = Magisk;
    impl.variant = state_magisk.variant;
  } else {
    impl.impl = None;
  }

#if defined(__LP64__)
  if (impl.impl != None && impl.impl != Multiple) {
    publish_root_impl_state();
  } else {
    unlink(ROOT_IMPL_STATE_PATH);
  }
#else
  if (impl.impl == None) {
    struct root_impl shared = { .impl = None, .variant = 0 };
    if (read_shared_root_impl_state(&shared)) {
      impl = shared;
      LOGI("Using root implementation detected by 64-bit daemon.");
    }
  }
#endif

  switch (impl.impl) {
    case None: {
      LOGI("No root implementation found.\n");

      break;
    }
    case Multiple: {
      LOGI("Multiple root implementations found.\n");

      break;
    }
    case KernelSU: {
      LOGI("KernelSU root implementation found.\n");

      break;
    }
    case APatch: {
      LOGI("APatch root implementation found.\n");

      break;
    }
    case Magisk: {
      LOGI("Magisk root implementation found.\n");

      break;
    }
  }
}

void get_impl(struct root_impl *uimpl) {
  *uimpl = impl;
}

bool uid_granted_root(uid_t uid) {
  switch (impl.impl) {
    case KernelSU: {
      return ksu_uid_granted_root(uid);
    }
    case APatch: {
      return apatch_uid_granted_root(uid);
    }
    case Magisk: {
      return magisk_uid_granted_root(uid);
    }
    default: {
      return false;
    }
  }
}

bool uid_should_umount(uid_t uid, const char *const process) {
  switch (impl.impl) {
    case KernelSU: {
      return ksu_uid_should_umount(uid);
    }
    case APatch: {
      return apatch_uid_should_umount(uid, process);
    }
    case Magisk: {
      return magisk_uid_should_umount(process);
    }
    default: {
      return false;
    }
  }
}

bool uid_is_manager(uid_t uid) {
  switch (impl.impl) {
    case KernelSU: {
      return ksu_uid_is_manager(uid);
    }
    case APatch: {
      return apatch_uid_is_manager(uid);
    }
    case Magisk: {
      return magisk_uid_is_manager(uid);
    }
    default: {
      return false;
    }
  }
}

void root_impl_cleanup(void) {
  if (impl.impl == KernelSU) ksu_cleanup();
#if defined(__LP64__)
  unlink(ROOT_IMPL_STATE_PATH);
#endif
}
