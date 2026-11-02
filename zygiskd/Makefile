ROOT_DIR := ..
include ../common.mk

BUILD_DIR ?= $(ROOT_DIR)/build

OBJ_ROOT = $(BUILD_DIR)/obj/$(BUILD_TYPE)/zygiskd
OBJ_DIR = $(OBJ_ROOT)/$(ARCH)

ZKSU_VERSION ?= $(VER_NAME)

ifeq ($(BUILD_TYPE),release)
	TYPE_CFLAGS = -O2 -fno-omit-frame-pointer
	TYPE_LDFLAGS = -Wl,--strip-all
else
	TYPE_CFLAGS = -g -O0 -DDEBUG
	TYPE_LDFLAGS =
endif

ZYGISKD_CFLAGS = -D_GNU_SOURCE -std=c99 -Wpedantic -Wall -Wextra -Werror  \
			 	 -Wformat -Wuninitialized -Wshadow -Wno-zero-length-array \
			 	 -Wno-fixed-enum-extension -Wno-unknown-warning-option    \
				 -Wno-c23-extensions -Wconversion                         \
				 -DMIN_APATCH_VERSION=$(MIN_APATCH_VERSION)               \
				 -DMIN_KSU_VERSION=$(MIN_KSU_VERSION)                     \
				 -DMIN_MAGISK_VERSION=$(MIN_MAGISK_VERSION)               \
				 '-DZKSU_VERSION="$(ZKSU_VERSION)"'

SRCS = src/root_impl/apatch.c src/root_impl/common.c        \
	   src/root_impl/kernelsu.c src/root_impl/magisk.c      \
	   src/companion.c src/main.c src/utils.c src/zygiskd.c
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
MEOW_WHEEL_CFLAGS += -O2 -fno-omit-frame-pointer -DNDEBUG
endif

OBJS = $(patsubst src/%.c,$(OBJ_DIR)/%.o,$(SRCS)) $(MEOW_WHEEL_OBJS)
BIN = $(OBJ_DIR)/zygiskd
INCLUDES = -Isrc -Isrc/root_impl

.PHONY: all arch clean

all:
	@for arch in $(ARCHS); do                                                                                  \
		$(MAKE) BUILD_TYPE=$(BUILD_TYPE) BUILD_DIR=$(BUILD_DIR) ARCH=$$arch ZKSU_VERSION=$(ZKSU_VERSION) arch; \
	done

	@mkdir -p $(OBJ_ROOT)
	@touch $(OBJ_ROOT)/.done

arch: $(BIN)

clean:
	rm -rf $(BUILD_DIR)/obj/$(BUILD_TYPE)/zygiskd

$(OBJ_DIR)/%.o: src/%.c
	@mkdir -p $(dir $@)
	$(CC_ARCH) $(ZYGISKD_CFLAGS) $(TYPE_CFLAGS) $(INCLUDES) -c $< -o $@

$(OBJ_DIR)/meow-wheel/%.o: $(MEOW_WHEEL_DIR)/%.c
	@mkdir -p $(dir $@)
	$(CC_ARCH) $(NDK_CFLAGS) $(MEOW_WHEEL_CFLAGS) -I../third_party/meow-wheel/src/system_properties/include -c $< -o $@

$(BIN): $(OBJS)
	@mkdir -p $(dir $@)
	$(CC_ARCH) $(TYPE_LDFLAGS) $(OBJS) -llog -o $@
