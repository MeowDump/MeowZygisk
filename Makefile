BUILD_DIR := $(CURDIR)/build

include common.mk

OBJ_DIR = $(BUILD_DIR)/obj/$(BUILD_TYPE)
MODULE_OUT = $(BUILD_DIR)/module/$(BUILD_TYPE)
ZIP_DIR = $(BUILD_DIR)/out

ZKSU_VERSION = $(VER_NAME)-$(VER_CODE)-$(COMMIT_HASH)-$(BUILD_TYPE)

ZIP_NAME = $(MODULE_NAME)-$(VER_NAME)-$(VER_CODE)-$(COMMIT_HASH)-$(BUILD_TYPE).zip
ZIP_FILE = $(ZIP_DIR)/$(ZIP_NAME)

ifeq ($(TERMUX_VERSION),)
	ADB_CMD := adb push $(ZIP_FILE) /data/local/tmp && adb shell 
	INSTALL_PATH := /data/local/tmp/$(ZIP_NAME)
	REBOOT_CMD := adb reboot
else
	INSTALL_PATH := $(ZIP_FILE)
	REBOOT_CMD := su -c reboot
endif

LOADER_DONE = $(OBJ_DIR)/loader/.done
ZYGISKD_DONE = $(OBJ_DIR)/zygiskd/.done
WHEEL_DONE = $(OBJ_DIR)/meow-wheel/.done
MODULE_DONE = $(BUILD_DIR)/module-$(BUILD_TYPE).done

LOADER_INPUTS = common.mk loader/Makefile \
        $(shell find loader/src -type f | sort) \
        $(shell find third_party/meow-wheel/src/lib -type f | sort)

ZYGISKD_INPUTS = common.mk zygiskd/Makefile \
        $(shell find zygiskd/src -type f | sort) \
        $(shell find third_party/meow-wheel/src/lib -type f | sort)

WHEEL_INPUTS = $(shell find third_party/meow-wheel -type f | sort)

MODULE_INPUTS = Makefile common.mk scripts/sign.py \
        $(shell find module/src -type f | sort) \
        $(shell find webroot -type f | sort) \
        $(wildcard module/private_key module/public_key) \
        $(WHEEL_INPUTS)

.PHONY: debug release build clean                                         \
        installKsu installMagisk installAPatch                            \
        installKsuAndReboot installMagiskAndReboot installAPatchAndReboot

debug:
	$(MAKE) BUILD_TYPE=debug BUILD_DIR=$(BUILD_DIR) build

release:
	$(MAKE) BUILD_TYPE=release BUILD_DIR=$(BUILD_DIR) build

all: debug release

build: $(ZIP_FILE)

$(LOADER_DONE): $(LOADER_INPUTS)
	$(MAKE) -C loader BUILD_TYPE=$(BUILD_TYPE) BUILD_DIR=$(BUILD_DIR) ZKSU_VERSION=$(ZKSU_VERSION)
	@mkdir -p $(dir $@)
	@touch $@

$(ZYGISKD_DONE): $(ZYGISKD_INPUTS)
	$(MAKE) -C zygiskd BUILD_TYPE=$(BUILD_TYPE) BUILD_DIR=$(BUILD_DIR) ZKSU_VERSION=$(ZKSU_VERSION)
	@mkdir -p $(dir $@)
	@touch $@

$(WHEEL_DONE): $(WHEEL_INPUTS) common.mk Makefile
	@mkdir -p $(OBJ_DIR)/meow-wheel
	@set -e; for arch in $(ARCHS); do \
		$(MAKE) --no-print-directory wheel-build-arch ARCH=$$arch BUILD_TYPE=$(BUILD_TYPE) BUILD_DIR=$(BUILD_DIR); \
	done
	@touch $@

WHEEL_CMD_SOURCES = third_party/meow-wheel/src/cmd/main.c \
	third_party/meow-wheel/src/cmd/utils.c \
	third_party/meow-wheel/src/lib/utils.c \
	$(wildcard third_party/meow-wheel/src/system_properties/src/*.c)
WHEEL_API_LEVEL ?= 34
WHEEL_TARGET_arm64-v8a = aarch64-linux-android$(WHEEL_API_LEVEL)
WHEEL_TARGET_armeabi-v7a = armv7a-linux-androideabi$(WHEEL_API_LEVEL)
WHEEL_TARGET_x86 = i686-linux-android$(WHEEL_API_LEVEL)
WHEEL_TARGET_x86_64 = x86_64-linux-android$(WHEEL_API_LEVEL)
WHEEL_CC_ARCH = $(CC) --target=$(WHEEL_TARGET_$(ARCH)) --sysroot=$(SYSROOT)
WHEEL_CFLAGS = -std=c18 -D_GNU_SOURCE -DIS_CMD -fPIC -fvisibility=hidden \
	-Wpedantic -Wall -Wextra -Werror -Wformat -Wuninitialized -Wshadow \
	-Wno-unused-function -Wno-unused-parameter -Wno-c2x-extensions \
	-Wno-gnu-zero-variadic-macro-arguments \
	-Wno-gnu-statement-expression-from-macro-expansion \
	-Ithird_party/meow-wheel/src/lib \
	-Ithird_party/meow-wheel/src/system_properties/include
ifeq ($(BUILD_TYPE),debug)
WHEEL_CFLAGS += -DDEBUG -O0 -g
else
WHEEL_CFLAGS += -O2 -fno-omit-frame-pointer -DNDEBUG
endif

.PHONY: wheel-build-arch
wheel-build-arch:
	@mkdir -p $(OBJ_DIR)/meow-wheel/cmd/$(ARCH)
	$(WHEEL_CC_ARCH) $(NDK_CFLAGS) $(WHEEL_CFLAGS) $(WHEEL_CMD_SOURCES) -DUTILS_NO_SSL -llog -o $(OBJ_DIR)/meow-wheel/cmd/$(ARCH)/treat-wheel
	$(STRIP) --strip-all $(OBJ_DIR)/meow-wheel/cmd/$(ARCH)/treat-wheel

$(MODULE_DONE): $(LOADER_DONE) $(ZYGISKD_DONE) $(WHEEL_DONE) $(MODULE_INPUTS)

	@rm -rf $(MODULE_OUT)
	@mkdir -p $(MODULE_OUT)/META-INF/com/google/android

	@echo "Copying META-INF files..."
	@cp module/src/META-INF/com/google/android/update-binary  \
	   module/src/META-INF/com/google/android/updater-script \
	   $(MODULE_OUT)/META-INF/com/google/android/


	@echo "Copying module files..."
	@cp module/src/verify.sh module/src/sepolicy.rule module/src/rezygisk.sh $(MODULE_OUT)/

	@echo "Customizing module.prop..."
	@sed -e 's/$${moduleId}/$(MODULE_ID)/g'                                             \
	    -e 's/$${moduleName}/$(MODULE_NAME)/g'                                          \
	    -e 's/$${versionName}/$(VER_NAME) ($(VER_CODE)-$(COMMIT_HASH)-$(BUILD_TYPE))/g' \
	    -e 's/$${versionCode}/$(VER_CODE)/g'                                            \
	    module/src/module.prop > $(MODULE_OUT)/module.prop

	@echo "Customizing scripts..."
	@for script in customize.sh post-fs-data.sh service.sh uninstall.sh; do \
		sed -e 's/@DEBUG@/$(if $(filter debug,$(BUILD_TYPE)),true,false)/g' \
		    -e 's/@MIN_APATCH_VERSION@/$(MIN_APATCH_VERSION)/g'             \
		    -e 's/@MIN_KSU_VERSION@/$(MIN_KSU_VERSION)/g'                   \
		    -e 's/@MIN_KSUD_VERSION@/$(MIN_KSUD_VERSION)/g'                 \
		    -e 's/@MIN_MAGISK_VERSION@/$(MIN_MAGISK_VERSION)/g'             \
		    module/src/$$script > $(MODULE_OUT)/$$script;                   \
	done

	@echo "Copying DebugAssistant scripts..."; \
	cp module/src/action.sh $(MODULE_OUT)/action.sh; \
	cp module/src/mda.sh $(MODULE_OUT)/mda.sh

	@echo "Copying binaries..."
	@for arch in $(ARCHS); do                                                                                  \
		mkdir -p $(MODULE_OUT)/bin/$$arch $(MODULE_OUT)/lib/$$arch;                                            \
		cp $(OBJ_DIR)/zygiskd/$$arch/zygiskd $(MODULE_OUT)/bin/$$arch/zygiskd;                                 \
		cp $(OBJ_DIR)/loader/$$arch/stripped/libzygisk.so $(MODULE_OUT)/lib/$$arch/libzygisk.so;               \
		cp $(OBJ_DIR)/loader/$$arch/stripped/libzygisk_ptrace.so $(MODULE_OUT)/lib/$$arch/libzygisk_ptrace.so; \
	done

	@echo "Copying webroot..."
	@cp -r webroot $(MODULE_OUT)/webroot
	@rm -rf $(MODULE_OUT)/webroot/meow-wheel
	@mkdir -p $(MODULE_OUT)/meow-wheel/cmd
	@cp third_party/meow-wheel/build/module.prop $(MODULE_OUT)/meow-wheel/module.prop
	@cp third_party/meow-wheel/LICENSE $(MODULE_OUT)/meow-wheel/LICENSE
	@for arch in $(ARCHS); do \
		mkdir -p $(MODULE_OUT)/meow-wheel/cmd/$$arch; \
		cp $(OBJ_DIR)/meow-wheel/cmd/$$arch/treat-wheel $(MODULE_OUT)/meow-wheel/cmd/$$arch/treat-wheel; \
	done

	@if [ -f module/private_key ]; then                                             \
		echo "Signing module...";                                                   \
		python3 scripts/sign.py $(MODULE_OUT) module/private_key module/public_key; \
	else                                                                            \
	    echo "No private key found, skipping signing...";                           \
		python3 scripts/sign.py --no-sign $(MODULE_OUT);                            \
	fi

	@mkdir -p $(dir $@)
	@touch $@

$(ZIP_FILE): $(MODULE_DONE)
	@mkdir -p $(ZIP_DIR)
	@rm -f $@

	@echo "Creating ZIP file..."
	@cd $(MODULE_OUT) && zip -r9 $@ . -x '*.DS_Store' > /dev/null

installKsu: build
	$(ADB_CMD)su -c '/data/adb/ksu/bin/ksud module install $(INSTALL_PATH)'

installMagisk: build
	$(ADB_CMD)su -M -c "magisk --install-module $(INSTALL_PATH)"

installAPatch: build
	$(ADB_CMD)su -c "/data/adb/apd module install $(INSTALL_PATH)"

installKsuAndReboot: installKsu
	$(REBOOT_CMD)

installMagiskAndReboot: installMagisk
	$(REBOOT_CMD)

installAPatchAndReboot: installAPatch
	$(REBOOT_CMD)

clean:
	rm -rf $(BUILD_DIR)
	$(MAKE) -C loader clean BUILD_DIR=$(BUILD_DIR)
	$(MAKE) -C zygiskd clean BUILD_DIR=$(BUILD_DIR)
	
