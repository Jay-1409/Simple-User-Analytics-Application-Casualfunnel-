(function attachTracker(global) {
  'use strict';

  var DEFAULTS = {
    apiUrl: '',
    flushIntervalMs: 5000,
    maxBatchSize: 10,
    maxQueueSize: 200,
    sessionTimeoutMs: 30 * 60 * 1000,
    storageKey: 'casualfunnel_session'
  };

  var state = {
    config: null,
    queue: [],
    flushing: false,
    intervalId: null,
    initialized: false
  };

  function safeRun(fn) {
    try {
      return fn();
    } catch (error) {
      if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('[Tracker] tracking error suppressed', error);
      }
      return null;
    }
  }

  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function replaceToken(token) {
      var random = (Math.random() * 16) | 0;
      var value = token === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  function readCookie(name) {
    var prefix = name + '=';
    var parts = document.cookie.split(';');
    for (var i = 0; i < parts.length; i += 1) {
      var part = parts[i].trim();
      if (part.indexOf(prefix) === 0) {
        return decodeURIComponent(part.slice(prefix.length));
      }
    }
    return null;
  }

  function writeCookie(name, value, maxAgeMs) {
    document.cookie =
      name +
      '=' +
      encodeURIComponent(value) +
      '; path=/; max-age=' +
      Math.floor(maxAgeMs / 1000) +
      '; SameSite=Lax';
  }

  function readSessionRecord(key) {
    try {
      var stored = global.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (_error) {
      var cookieValue = readCookie(key);
      return cookieValue ? JSON.parse(cookieValue) : null;
    }
  }

  function writeSessionRecord(key, record, timeoutMs) {
    var serialized = JSON.stringify(record);
    try {
      global.localStorage.setItem(key, serialized);
    } catch (_error) {
      writeCookie(key, serialized, timeoutMs);
    }
  }

  function getSessionId() {
    var now = Date.now();
    var record = readSessionRecord(state.config.storageKey);

    if (!record || !record.id || !record.lastSeen || now - Number(record.lastSeen) > state.config.sessionTimeoutMs) {
      record = { id: uuid(), lastSeen: now };
    } else {
      record.lastSeen = now;
    }

    writeSessionRecord(state.config.storageKey, record, state.config.sessionTimeoutMs);
    return record.id;
  }

  function endpoint() {
    return state.config.apiUrl.replace(/\/$/, '') + '/api/events';
  }

  function enqueue(event) {
    state.queue.push(event);
    if (state.queue.length > state.config.maxQueueSize) {
      state.queue.splice(0, state.queue.length - state.config.maxQueueSize);
    }
    if (state.queue.length >= state.config.maxBatchSize) {
      flush(false);
    }
  }

  function buildBaseEvent(type) {
    return {
      session_id: getSessionId(),
      event_type: type,
      page_url: global.location.href,
      client_timestamp: new Date().toISOString()
    };
  }

  function trackPageView() {
    enqueue(buildBaseEvent('page_view'));
  }

  function trackNavigationPageView(previousUrl) {
    global.setTimeout(function delayedPageView() {
      safeRun(function wrapNavigationPageView() {
        if (global.location.href !== previousUrl) {
          trackPageView();
        }
      });
    }, 0);
  }

  function trackClick(event) {
    var payload = buildBaseEvent('click');
    // Use pageX/pageY rather than clientX/clientY so coordinates stay stable after scrolling.
    payload.x = event.pageX;
    payload.y = event.pageY;
    payload.viewport_width = global.innerWidth || document.documentElement.clientWidth || 1;
    payload.viewport_height = global.innerHeight || document.documentElement.clientHeight || 1;
    enqueue(payload);
  }

  function restoreBatch(batch) {
    state.queue = batch.concat(state.queue).slice(0, state.config.maxQueueSize);
  }

  function flush(useBeacon) {
    safeRun(function runFlush() {
      if (state.flushing || state.queue.length === 0 || !state.config.apiUrl) return;

      var batch = state.queue.splice(0, state.config.maxBatchSize);

      if (useBeacon && navigator.sendBeacon) {
        // sendBeacon is reserved for unload/visibility flushes because it can complete without blocking navigation; interval flushes use fetch so failures can be retried.
        var blob = new Blob([JSON.stringify(batch)], { type: 'text/plain;charset=UTF-8' });
        var queued = navigator.sendBeacon(endpoint(), blob);
        if (!queued) restoreBatch(batch);
        return;
      }

      state.flushing = true;
      fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        keepalive: false
      })
        .then(function handleResponse(response) {
          if (!response.ok) {
            restoreBatch(batch);
          }
        })
        .catch(function handleFailure() {
          restoreBatch(batch);
        })
        .finally(function finish() {
          state.flushing = false;
        });
    });
  }

  function init(options) {
    safeRun(function runInit() {
      if (state.initialized) return;
      state.config = Object.assign({}, DEFAULTS, options || {});
      if (!state.config.apiUrl) {
        throw new Error('Tracker.init requires apiUrl');
      }

      state.initialized = true;
      document.addEventListener('click', function handleDocumentClick(event) {
        safeRun(function wrapClick() {
          trackClick(event);
        });
      });

      document.addEventListener('visibilitychange', function handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
          flush(true);
        }
      });

      global.addEventListener('hashchange', function handleHashChange(event) {
        trackNavigationPageView(event.oldURL);
      });

      global.addEventListener('popstate', function handlePopState() {
        trackPageView();
      });

      ['pushState', 'replaceState'].forEach(function wrapHistoryMethod(method) {
        if (!global.history || typeof global.history[method] !== 'function') return;
        var original = global.history[method];
        global.history[method] = function wrappedHistoryMethod() {
          var previousUrl = global.location.href;
          var result = original.apply(this, arguments);
          trackNavigationPageView(previousUrl);
          return result;
        };
      });

      global.addEventListener('pagehide', function handlePageHide() {
        flush(true);
      });

      state.intervalId = global.setInterval(function flushOnInterval() {
        flush(false);
      }, state.config.flushIntervalMs);

      trackPageView();
    });
  }

  global.Tracker = {
    init: init,
    flush: function manualFlush() {
      flush(false);
    }
  };
})(window);
