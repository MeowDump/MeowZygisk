ROOT_DIR := ..
include ../common.mk

BUILD_DIR ?= $(ROOT_DIR)/build

OBJ_ROOT = $(BUILD_DIR)/obj/$(BUILD_TYPE)/loader
OBJ_DIR = $(OBJ_ROOT)/$(ARCH)

ZKSU_VERSION ?= $(VER_NAME)-$(VER_CODE)-$(COMMIT_HASH)-$(BUILD_TYPE)

ifeq ($(BUILD_TYPE),release)
	TYPE_CFLAGS = -O1 -fno-omit-frame-pointer -Wno-unused -Wno-unused-parameter       \
				  -fvisibility=hidden -fvisibility-inlines-hidden -fno-unwind-tables \
				  -fno-asynchronous-unwind-tables -DNDEBUG
	TYPE_LDFLAGS = -Wl,--exclude-libs,ALL
else
	TYPE_CFLAGS = -g -O0
	TYPE_LDFLAGS =
endif

LOADER_CFLAGS = -std=c18 -D_GNU_SOURCE -Wall -Wextra -fno-rtti -fno-exceptions \
				-fomit-frame-pointer -Wno-builtin-macro-redefined \
				'-D__FILE__=__FILE_NAME__' -DZKSU_VERSION=\"$(ZKSU_VERSION)\"

COMMON_LDFLAGS = -static-libstdc++ -Wl,--build-id=sha1 -Wl,--no-rosegment \
				 -Wl,--no-undefined-version -Wl,--fatal-warnings -Wl,--no-undefined \
				 -Wl,-z,noexecstack -Qunused-arguments -Wl,--gc-sections

COMMON_SRCS = src/common/daemon.c src/common/elf_util.c   \
			  src/common/misc.c src/common/socket_utils.c
INJECTOR_SRCS = src/injector/cpp_strings.c src/injector/entry.c \
				src/injector/hook.c src/injector/ptrace_clear.c
PTRACER_SRCS = src/ptracer/main.c src/ptracer/monitor.c src/ptracer/ptracer.c \
			   src/ptracer/remote_csoloader.c src/ptracer/utils.c
MEOW_WHEEL_DIR = ../third_party/meow-wheel/src/lib
MEOW_WHEEL_SRCS = $(MEOW_WHEEL_DIR)/elf_util.c $(MEOW_WHEEL_DIR)/hiding.c \
			  $(MEOW_WHEEL_DIR)/main.c $(MEOW_WHEEL_DIR)/rz_daemon.c \
			  $(MEOW_WHEEL_DIR)/utils.c
MEOW_WHEEL_OBJS = $(patsubst $(MEOW_WHEEL_DIR)/%.c,$(OBJ_DIR)/meow-wheel/%.o,$(MEOW_WHEEL_SRCS))
MEOW_WHEEL_NAMESPACE_CFLAGS = -Dparse_mountinfo=mw_parse_mountinfo -Dswitch_mount_namespace=mw_switch_mount_namespace -Dwrite_fd=mw_write_fd -Dread_fd=mw_read_fd -Dwrite_size_t=mw_write_size_t -Dread_size_t=mw_read_size_t -Dwrite_uint32_t=mw_write_uint32_t -Dread_uint32_t=mw_read_uint32_t -Dwrite_uint8_t=mw_write_uint8_t -Dread_uint8_t=mw_read_uint8_t -Dparse_maps=mw_parse_maps -Dfree_maps=mw_free_maps -Drezygiskd_update_mns=mw_rezygiskd_update_mns -Dwrite_loop=mw_write_loop -Dread_loop=mw_read_loop
MEOW_WHEEL_CFLAGS = -std=c18 -D_GNU_SOURCE -DIS_ZYGISK_LIB -fPIC \
			    -fvisibility=hidden -Wpedantic -Wall -Wextra -Werror \
			    -Wformat -Wuninitialized -Wshadow -Wno-unused-function \
			    -Wno-unused-parameter -Wno-c2x-extensions \
			    -Wno-gnu-zero-variadic-macro-arguments \
			    -Wno-gnu-statement-expression-from-macro-expansion \
			    -I$(MEOW_WHEEL_DIR) $(MEOW_WHEEL_NAMESPACE_CFLAGS)
ifeq ($(BUILD_TYPE),debug)
MEOW_WHEEL_CFLAGS += -DDEBUG -O0 -g
else
MEOW_WHEEL_CFLAGS += -O1 -fno-omit-frame-pointer -DNDEBUG
endif

COMMON_OBJS = $(patsubst src/common/%.c,$(OBJ_DIR)/common/%.o,$(COMMON_SRCS))
INJECTOR_OBJS = $(patsubst src/injector/%.c,$(OBJ_DIR)/injector/%.o,$(INJECTOR_SRCS)) $(MEOW_WHEEL_OBJS)
PTRACER_OBJS = $(patsubst src/ptracer/%.c,$(OBJ_DIR)/ptracer/%.o,$(PTRACER_SRCS))

PLTI_LIB = $(BUILD_DIR)/obj/$(BUILD_TYPE)/plti/$(ARCH)/libplti.a
CSOLOADER_LIB = $(BUILD_DIR)/obj/$(BUILD_TYPE)/csoloader/$(ARCH)/libcsoloader.a

LIBCOMMON = $(OBJ_DIR)/libcommon.a
LIBZYGISK = $(OBJ_DIR)/libzygisk.so
LIBPTRACE = $(OBJ_DIR)/libzygisk_ptrace.so
LIBZYGISK_STRIPPED = $(OBJ_DIR)/stripped/libzygisk.so
LIBPTRACE_STRIPPED = $(OBJ_DIR)/stripped/libzygisk_ptrace.so

PLTI_DIR = src/external/plti
CSOLOADER_DIR = src/external/csoloader

COMMON_INCLUDES = -Isrc/include
INJECTOR_INCLUDES = -Isrc/include -I$(PLTI_DIR)/src -I$(CSOLOADER_DIR)/include -I../third_party/meow-wheel/src/lib

.PHONY: all arch clean

all:
	@for arch in $(ARCHS); do                                                                                  \
		$(MAKE) BUILD_TYPE=$(BUILD_TYPE) BUILD_DIR=$(BUILD_DIR) ARCH=$$arch ZKSU_VERSION=$(ZKSU_VERSION) arch; \
	done

	@mkdir -p $(OBJ_ROOT)
	@touch $(OBJ_ROOT)/.done

arch: $(LIBZYGISK_STRIPPED) $(LIBPTRACE_STRIPPED)

clean:
	rm -rf $(BUILD_DIR)/obj/$(BUILD_TYPE)/loader
	rm -rf $(BUILD_DIR)/obj/$(BUILD_TYPE)/plti
	rm -rf $(BUILD_DIR)/obj/$(BUILD_TYPE)/csoloader

$(PLTI_LIB):
	@mkdir -p $(dir $@)
	$(MAKE) -C $(PLTI_DIR) BUILD_TYPE=$(BUILD_TYPE) ARCH=$(ARCH) \
		NDK_PATH=$(NDK_PATH) API_LEVEL=$(API_LEVEL)              \
		out=$(BUILD_DIR)/obj/$(BUILD_TYPE)/plti/$(ARCH)

$(CSOLOADER_LIB):
	@mkdir -p $(dir $@)
	$(MAKE) -C $(CSOLOADER_DIR) BUILD_TYPE=$(BUILD_TYPE) ARCH=$(ARCH) \
		NDK_PATH=$(NDK_PATH) API_LEVEL=$(API_LEVEL)                   \
		out=$(BUILD_DIR)/obj/$(BUILD_TYPE)/csoloader/$(ARCH)

$(OBJ_DIR)/common/%.o: src/common/%.c
	@mkdir -p $(dir $@)
	$(CC_ARCH) $(NDK_CFLAGS) $(LOADER_CFLAGS) $(TYPE_CFLAGS) \
		$(COMMON_INCLUDES) -fPIC -c $< -o $@

$(OBJ_DIR)/meow-wheel/%.o: $(MEOW_WHEEL_DIR)/%.c
	@mkdir -p $(dir $@)
	$(CC_ARCH) $(NDK_CFLAGS) $(MEOW_WHEEL_CFLAGS) -c $< -o $@

$(OBJ_DIR)/injector/%.o: src/injector/%.c
	@mkdir -p $(dir $@)
	$(CC_ARCH) $(NDK_CFLAGS) $(LOADER_CFLAGS) $(TYPE_CFLAGS) \
		$(INJECTOR_INCLUDES) -Dzygisk_EXPORTS -fPIC -c $< -o $@

$(OBJ_DIR)/ptracer/%.o: src/ptracer/%.c
	@mkdir -p $(dir $@)
	$(CC_ARCH) $(NDK_CFLAGS) $(LOADER_CFLAGS) $(TYPE_CFLAGS) \
		$(COMMON_INCLUDES) -fPIE -c $< -o $@

$(LIBCOMMON): $(COMMON_OBJS)
	@mkdir -p $(dir $@)
	$(AR) rcs $@ $^

$(LIBZYGISK): $(INJECTOR_OBJS) $(LIBCOMMON) $(PLTI_LIB) $(CSOLOADER_LIB)
	@mkdir -p $(dir $@)
	$(CC_ARCH) -fPIC -shared -Wl,-soname,libzygisk.so              \
		$(COMMON_LDFLAGS) $(TYPE_LDFLAGS) -nostartfiles            \
		$(INJECTOR_OBJS) $(LIBCOMMON) $(PLTI_LIB) $(CSOLOADER_LIB) \
		-llog -lm -o $@

$(LIBPTRACE): $(PTRACER_OBJS) $(LIBCOMMON)
	@mkdir -p $(dir $@)
	$(CC_ARCH) $(COMMON_LDFLAGS) $(TYPE_LDFLAGS) \
		$(PTRACER_OBJS) $(LIBCOMMON) -llog -lm -o $@

$(LIBZYGISK_STRIPPED): $(LIBZYGISK)
	@mkdir -p $(dir $@)
	cp $< $@
	$(STRIP) --strip-all $@

$(LIBPTRACE_STRIPPED): $(LIBPTRACE)
	@mkdir -p $(dir $@)
	cp $< $@
	$(STRIP) --strip-all $@
