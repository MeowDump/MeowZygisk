let callbackCounter = 0;
function getUniqueCallbackName(prefix) {
  return `${prefix}_callback_${Date.now()}_${callbackCounter++}`;
}

export function exec(command, options) {
  if (typeof ksu === "undefined") {
    return Promise.reject(new Error("KernelSU WebUI API unavailable"));
  }

  if (typeof options === "undefined") {
    options = {};
  }

  return new Promise((resolve, reject) => {
    const callbackFuncName = getUniqueCallbackName("exec");
    const timeoutMs = 10000;
    let settled = false;

    function cleanup() {
      clearTimeout(timeoutId);
      delete window[callbackFuncName];
    }

    function finish(callback, value) {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    }

    const timeoutId = setTimeout(() => {
      finish(resolve, {
        errno: -2,
        stdout: "",
        stderr: `KernelSU command timed out after ${timeoutMs} ms: ${command}`
      });
    }, timeoutMs);

    window[callbackFuncName] = (errno, stdout, stderr) => {
      finish(resolve, { errno, stdout, stderr });
    };

    try {
      ksu.exec(command, JSON.stringify(options), callbackFuncName);
    } catch (error) {
      finish(reject, error);
    }
  });
}

function Stdio() {
  this.listeners = {};
}

Stdio.prototype.on = function (event, listener) {
  if (!this.listeners[event]) {
    this.listeners[event] = [];
  }
  this.listeners[event].push(listener);
};

Stdio.prototype.emit = function (event, ...args) {
  if (this.listeners[event]) {
    this.listeners[event].forEach((listener) => listener(...args));
  }
};

function ChildProcess() {
  this.listeners = {};
  this.stdin = new Stdio();
  this.stdout = new Stdio();
  this.stderr = new Stdio();
}

ChildProcess.prototype.on = function (event, listener) {
  if (!this.listeners[event]) {
    this.listeners[event] = [];
  }
  this.listeners[event].push(listener);
};

ChildProcess.prototype.emit = function (event, ...args) {
  if (this.listeners[event]) {
    this.listeners[event].forEach((listener) => listener(...args));
  }
};

export function spawn(command, args, options) {

  if (typeof args === "undefined") {
    args = [];
  } else if (!(args instanceof Array)) {
    options = args;
  }

  if (typeof options === "undefined") {
    options = {};
  }

  const child = new ChildProcess();
  const childCallbackName = getUniqueCallbackName("spawn");
  window[childCallbackName] = child;

  function cleanup(name) {
    delete window[name];
  }

  child.on("exit", code => {
    cleanup(childCallbackName);
  });

  try {
    ksu.spawn(
      command,
      JSON.stringify(args),
      JSON.stringify(options),
      childCallbackName
    );
  } catch (error) {
    child.emit("error", error);
    cleanup(childCallbackName);
  }
  return child;
}

export function fullScreen(isFullScreen) {
  if (typeof ksu === "undefined") return;

  ksu.fullScreen(isFullScreen);
}

export function toast(message) {
  if (typeof ksu === "undefined") alert(message);
  else ksu.toast(message);
}
