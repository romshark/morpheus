// Datastar simulator. Intercepts window.fetch and, for routes registered via
// sim.get/post/put/patch/delete/any, returns one of the four response shapes
// Datastar's action plugins accept:
//
//   - text/event-stream  — handler uses sse.* to stream Datastar SSE events
//                          (https://data-star.dev/reference/sse_events).
//   - text/html          — handler returns { html, selector?, mode?,
//                          useViewTransition? }; sent with the corresponding
//                          datastar-* response headers.
//   - application/json   — handler returns { json, onlyIfMissing? }; treated
//                          by Datastar as a signal patch.
//   - text/javascript    — handler returns { script, attributes? }; executed
//                          by Datastar.
//
// Unmatched URLs fall through to the real fetch.

const encoder = new TextEncoder();
const routes = [];

let installed = false;
let realFetch;

let latencyMin = 0;
let latencyMax = 0;
let handlerDelay = 0;
let unreachable = false;
// 0 disables the synthetic error path; any other value is the HTTP status
// returned in place of running the handler.
let errorResponse = 0;

// Standard reason phrases for the codes the simulator settings expose.
// Response() doesn't fill statusText from the status integer, so we pass
// it explicitly — Datastar logs / DevTools surface this string.
const HTTP_STATUS_TEXT = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  206: 'Partial Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  418: "I'm a teapot",
  422: 'Unprocessable Entity',
  425: 'Too Early',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  507: 'Insufficient Storage',
  511: 'Network Authentication Required',
};

// kill() per in-flight request; setUnreachable(true) drains the set so existing
// streams die too, not just new ones.
const activeKills = new Set();

// New requests reject with TypeError (mirrors fetch's network failure);
// in-flight ones are killed.
function setUnreachable(value) {
  const wasReachable = !unreachable;
  unreachable = !!value;
  if (unreachable && wasReachable) {
    const kills = [...activeKills];
    activeKills.clear();
    for (const k of kills) k();
  }
}

// New requests get a forced HTTP response instead of running the handler.
// Existing in-flight requests are not affected. Accepts:
//   - falsy / "" / "off" / 0 / 200 / "200" — disable (handler runs)
//   - true                                  — back-compat: 500 Internal Server Error
//   - number                                — that HTTP status (1xx-5xx)
//   - numeric string ("503")                — same, parsed
function setErrorResponse(value) {
  if (value === false || value == null || value === '' || value === 'off' ||
      value === 0 || value === 200 || value === '200') {
    errorResponse = 0;
    return;
  }
  if (value === true) {
    errorResponse = 500;
    return;
  }
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  errorResponse = Number.isFinite(n) && n >= 100 && n <= 599 ? n : 0;
}

function setLatency(minMs, maxMs = minMs) {
  latencyMin = Math.max(0, minMs | 0);
  latencyMax = Math.max(latencyMin, maxMs | 0);
}

function setHandlerDelay(ms) {
  handlerDelay = Math.max(0, ms | 0);
}

// Returns the actual ms slept (0 if disabled) so the access log can report it.
async function awaitLatency(signal) {
  if (latencyMax <= 0) {
    return 0;
  }
  const ms = latencyMin + Math.random() * (latencyMax - latencyMin);
  await sleep(ms, signal);
  return ms;
}

let accessLogger = null;

// Enable/disable per-request logging.
//   setAccessLog(true)        — log to console.log
//   setAccessLog(false|null)  — disable (default)
//   setAccessLog(fn)          — call fn(entry) instead, where `entry` has shape:
//     { phase: 'request', method, url, signals, params, query, rawBody, latencyMs }
//     { phase: 'event',   method, url, event: { type, ... } }
//     { phase: 'end',     method, url, durationMs, eventCount, aborted,
//                          responseType: 'sse'|'html'|'json'|'script'|'empty'|'error',
//                          responseStatus: number | undefined (0 / undefined for
//                          unreachable / killed-before-send) }
function setAccessLog(value) {
  if (typeof value === 'function') {
    accessLogger = value;
  } else if (value) {
    accessLogger = defaultAccessLogger;
  } else {
    accessLogger = null;
  }
}

function defaultAccessLogger(entry) {
  const tag = `[datasim] ${entry.method} ${entry.url.pathname}${entry.url.search}`;
  if (entry.phase === 'request') {
    console.log(tag, 'request', {
      signals: entry.signals,
      params: entry.params,
      query: entry.query,
      rawBody: entry.rawBody || undefined,
      latencyMs: Math.round(entry.latencyMs),
    });
  } else if (entry.phase === 'event') {
    console.log(tag, 'emit', entry.event);
  } else if (entry.phase === 'end') {
    console.log(tag, 'end', {
      status: entry.responseStatus ?? '(no response)',
      responseType: entry.responseType,
      durationMs: entry.durationMs,
      eventCount: entry.eventCount,
      ...(entry.aborted ? { aborted: true } : {}),
    });
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      return reject(abortError());
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => { clearTimeout(t); reject(abortError()); };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function install() {
  if (installed) {
    return;
  }
  installed = true;
  const target = typeof window !== 'undefined' ? window : globalThis;
  realFetch = target.fetch.bind(target);
  target.fetch = patchedFetch;
  globalThis.fetch = patchedFetch;
}

async function patchedFetch(input, init) {
  let req;
  try {
    req = input instanceof Request ? input : new Request(input, init);
  } catch {
    return realFetch(input, init);
  }
  let url;
  try {
    url = new URL(req.url, typeof location !== 'undefined' ?
      location.href : 'http://localhost/');
  } catch {
    return realFetch(input, init);
  }
  const match = matchRoute(req.method.toUpperCase(), url.pathname);
  if (!match) {
    return realFetch(input, init);
  }
  if (unreachable) {
    // Apply the request-side latency so indicators get a moment to show,
    // then reject with the same TypeError fetch() throws on network failure.
    await awaitLatency(req.signal);
    throw new TypeError('Failed to fetch');
  }
  return handleSimulated(req, url, match);
}

function matchRoute(method, pathname) {
  for (const route of routes) {
    if (route.method !== method && route.method !== '*') {
      continue;
    }
    const m = pathname.match(route.regex);
    if (!m) {
      continue;
    }
    const params = {};
    route.paramNames.forEach((name, i) => {
      const v = m[i + 1];
      if (v != null) {
        params[name] = decodeURIComponent(v);
      }
    });
    return { route, params };
  }
  return null;
}

// Express-style: `/a/:id/b`, plus trailing `*` wildcard captured as `params.wildcard`.
function compilePattern(pattern) {
  const paramNames = [];
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const body = escaped
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
      paramNames.push(name); return '([^/]+)';
    })
    .replace(/\*/g, '(.*)');
  if (/\*/.test(pattern)) {
    paramNames.push('wildcard');
  }
  return { regex: new RegExp(`^${body}$`), paramNames };
}

async function buildContext(req, url, params) {
  let signals = {};
  const query = {};
  url.searchParams.forEach((v, k) => { if (k !== 'datastar') query[k] = v; });

  let rawBody = '';
  if (req.method === 'GET' || req.method === 'HEAD') {
    const ds = url.searchParams.get('datastar');
    if (ds) try { signals = JSON.parse(ds); } catch { }
  } else {
    try { rawBody = await req.clone().text(); } catch { }
    if (rawBody) {
      const ct = req.headers.get('content-type') || '';
      if (ct.includes('application/json') || rawBody.trimStart().startsWith('{')) {
        try {
          // Datastar wraps as { datastar: { ...signals } }; tolerate either shape.
          const parsed = JSON.parse(rawBody);
          signals = (parsed && typeof parsed === 'object' && 'datastar' in parsed) ?
            parsed.datastar : parsed;
        } catch { }
      } else if (ct.includes('form')) {
        try {
          const fd = await req.clone().formData();
          const ds = fd.get('datastar');
          if (typeof ds === 'string') signals = JSON.parse(ds);
        } catch { }
      }
    }
  }

  return {
    method: req.method.toUpperCase(),
    url,
    headers: req.headers,
    signals,
    params,
    query,
    rawBody,
    request: req,
    signal: req.signal,
  };
}

function handleSimulated(req, url, match) {
  const startedAt = Date.now();
  const method = req.method.toUpperCase();
  let eventCount = 0;
  let aborted = false;
  let responseType = 'sse';
  let responseStatus;

  // Fires on client abort OR proactive kill (setUnreachable). Handlers see it
  // via sse.signal so their loops can exit.
  const ctrl = new AbortController();
  if (req.signal.aborted) {
    ctrl.abort(req.signal.reason);
  } else {
    req.signal.addEventListener(
      'abort', () => ctrl.abort(req.signal.reason), { once: true });
  }

  const record = (event) => {
    eventCount++;
    accessLogger?.({ phase: 'event', method, url, event });
  };

  let committedSse = false;
  let writer = null;
  let writerClosed = false;
  let resolveResponse, rejectResponse;
  const responsePromise = new Promise((res, rej) => {
    resolveResponse = res; rejectResponse = rej;
  });

  const commitSse = () => {
    if (committedSse) return;
    committedSse = true;
    responseStatus = 200;
    const ts = new TransformStream();
    writer = ts.writable.getWriter();
    resolveResponse(new Response(ts.readable, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    }));
  };

  // Per-frame response latency, serialized so frames stay in order when the
  // handler emits faster than the simulated network can deliver.
  let pendingWrites = Promise.resolve();
  const enqueue = (frame) => {
    if (writerClosed || aborted) {
      return;
    }
    if (!committedSse) {
      commitSse();
    }
    pendingWrites = pendingWrites.then(async () => {
      if (writerClosed || aborted) return;
      try { await awaitLatency(ctrl.signal); } catch { return; }
      if (writerClosed || aborted) return;
      try { await writer.write(encoder.encode(frame)); } catch { }
    });
  };

  const closeWriter = async () => {
    if (writer && !writerClosed) {
      try { await pendingWrites; } catch { }
      if (writerClosed) return;
      writerClosed = true;
      try { await writer.close(); } catch { }
    }
  };

  const onAbort = () => { aborted = true; closeWriter(); };
  req.signal.addEventListener('abort', onAbort);

  // Tear-down for mid-flight requests on setUnreachable(true): abort the SSE
  // writer if committed, otherwise reject the pending response with TypeError.
  let killed = false;
  const kill = async () => {
    if (killed) return;
    killed = true;
    aborted = true;
    ctrl.abort(new TypeError('Failed to fetch'));
    if (committedSse) {
      if (writer && !writerClosed) {
        writerClosed = true;
        try { await writer.abort(new TypeError('Failed to fetch')); } catch { }
      }
    } else {
      rejectResponse(new TypeError('Failed to fetch'));
    }
  };
  activeKills.add(kill);

  (async () => {
    // errorStatus seeds at 500 so an unexpected handler throw still returns
    // a sane response; the user-configured errorResponse overrides it on
    // the synthetic-error path below.
    let result, errored = false, errorStatus = 500;
    try {
      const ctx = await buildContext(req, url, match.params);
      const sse = makeEmitter(enqueue, () => writerClosed || aborted, ctrl.signal, record);
      const latencyMs = await awaitLatency(ctrl.signal);
      accessLogger?.({
        phase: 'request', method, url,
        signals: ctx.signals,
        params: ctx.params,
        query: ctx.query,
        rawBody: ctx.rawBody,
        latencyMs,
      });
      if (errorResponse) {
        errored = true;
        errorStatus = errorResponse;
      } else {
        if (handlerDelay > 0) {
          await sleep(handlerDelay, ctrl.signal);
        }
        result = await match.route.handler(ctx, sse);
      }
    } catch (err) {
      if (isAbortError(err)) {
        aborted = true;
      } else {
        errored = true;
        console.error(`[datasim] handler error for ${method} ${url.pathname}:`, err);
      }
    }

    req.signal.removeEventListener('abort', onAbort);
    activeKills.delete(kill);

    if (killed) {
      // kill() already settled the response.
      responseType = 'error';
    } else if (committedSse) {
      // Drain pending writes (each awaits its own latency) and close.
      await closeWriter();
    } else {
      // Response-side latency before the client sees it.
      try { await awaitLatency(ctrl.signal); } catch { }
      if (errored) {
        responseType = 'error';
        responseStatus = errorStatus;
        const statusText = HTTP_STATUS_TEXT[errorStatus] || 'Error';
        resolveResponse(new Response(statusText, {
          status: errorStatus,
          statusText,
        }));
      } else {
        const nonSse = buildNonSseResponse(result);
        if (nonSse) {
          responseType = nonSse[0];
          responseStatus = nonSse[1].status;
          resolveResponse(nonSse[1]);
        } else {
          // Handler emitted/returned nothing — empty SSE response.
          responseType = 'empty';
          responseStatus = 200;
          resolveResponse(new Response('', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
          }));
        }
      }
    }

    accessLogger?.({
      phase: 'end', method, url,
      durationMs: Date.now() - startedAt,
      eventCount, aborted, responseType, responseStatus,
    });
  })();

  return responsePromise;
}

// Build a non-SSE Response from a handler's return value, if it carries one of
// the recognized shapes. Returns [responseType, Response] or null.
function buildNonSseResponse(result) {
  if (!result || typeof result !== 'object') {
    return null;
  }
  if ('html' in result) {
    const headers = { 'Content-Type': 'text/html' };
    if (result.selector) {
      headers['datastar-selector'] = result.selector;
    }
    if (result.mode) {
      headers['datastar-mode'] = result.mode;
    }
    if (result.useViewTransition) {
      headers['datastar-use-view-transition'] = 'true';
    }
    return ['html', new Response(String(result.html), { status: 200, headers })];
  }
  if ('json' in result) {
    const headers = { 'Content-Type': 'application/json' };
    if (result.onlyIfMissing) {
      headers['datastar-only-if-missing'] = 'true';
    }
    return ['json', new Response(JSON.stringify(result.json), { status: 200, headers })];
  }
  if ('script' in result) {
    const headers = { 'Content-Type': 'text/javascript' };
    if (result.attributes) {
      headers['datastar-script-attributes'] = JSON.stringify(result.attributes);
    }
    return ['script', new Response(String(result.script), { status: 200, headers })];
  }
  return null;
}

// Build the per-request SSE generator. Mirrors the surface of Datastar's
// official ServerSentEventGenerator (Go SDK v1) plus a few simulator-only
// helpers (raw / delay / signal).
function makeEmitter(enqueue, isClosed, signal, record) {
  const sse = {
    patchElements(html, opts = {}) {
      record?.({ type: 'patchElements', html, ...opts });
      const kvs = [];
      if (opts.selector) {
        kvs.push(['selector', opts.selector]);
      }
      if (opts.mode) {
        kvs.push(['mode', opts.mode]);
      }
      if (opts.useViewTransition) {
        kvs.push(['useViewTransition', 'true']);
      }
      if (opts.namespace) {
        kvs.push(['namespace', opts.namespace]);
      }
      kvs.push(['elements', html]);
      enqueue(formatSse('datastar-patch-elements', kvs));
    },
    patchSignals(signals, opts = {}) {
      record?.({ type: 'patchSignals', signals, ...opts });
      const kvs = [];
      if (opts.onlyIfMissing) {
        kvs.push(['onlyIfMissing', 'true']);
      }
      kvs.push(['signals', JSON.stringify(signals)]);
      enqueue(formatSse('datastar-patch-signals', kvs));
    },
    removeElements(selector, opts = {}) {
      record?.({ type: 'removeElements', selector, ...opts });
      const kvs = [['selector', selector], ['mode', 'remove']];
      if (opts.useViewTransition) {
        kvs.push(['useViewTransition', 'true']);
      }
      enqueue(formatSse('datastar-patch-elements', kvs));
    },
    removeElementByID(id, opts = {}) {
      sse.removeElements(`#${id}`, opts);
    },
    executeScript(js, opts = {}) {
      record?.({ type: 'executeScript', js, ...opts });
      const attrs = { ...(opts.attributes || {}) };
      // auto-remove the script tag after Datastar processes it, unless caller opts out
      if (opts.autoRemove !== false && !('data-effect' in attrs)) {
        attrs['data-effect'] = 'el.remove()';
      }
      const attrStr = Object.
        entries(attrs).
        map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`).join('');
      const kvs = [
        ['selector', 'body'],
        ['mode', 'append'],
        ['elements', `<script${attrStr}>${js}</script>`]
      ];
      enqueue(formatSse('datastar-patch-elements', kvs));
    },
    // ----- ExecuteScript convenience wrappers (mirrors the Go SDK) ------
    consoleLog(msg, opts = {}) {
      sse.executeScript(`console.log(${JSON.stringify(String(msg))})`, opts);
    },
    consoleError(err, opts = {}) {
      const text = (err && typeof err === 'object' && 'message' in err) ? err.message : String(err);
      sse.executeScript(`console.error(${JSON.stringify(text)})`, opts);
    },
    redirect(url, opts = {}) {
      sse.executeScript(
        `setTimeout(() => window.location.href = ${JSON.stringify(String(url))})`,
        opts,
      );
    },
    replaceURL(url, opts = {}) {
      sse.executeScript(
        `window.history.replaceState({}, "", ${JSON.stringify(String(url))})`,
        opts,
      );
    },
    prefetch(...urls) {
      const body = JSON.stringify({ prefetch: [{ source: 'list', urls: urls.map(String) }] });
      sse.executeScript(body, {
        autoRemove: false,
        attributes: { type: 'speculationrules' },
      });
    },
    dispatchCustomEvent(eventName, detail, opts = {}) {
      if (!eventName) {
        throw new Error('eventName is required');
      }
      const { selector, bubbles = true, cancelable = true, composed = true } = opts;
      const targetJs = selector
        ? `document.querySelectorAll(${JSON.stringify(selector)})`
        : '[document]';
      const js = `{
  const els = ${targetJs};
  const evt = new CustomEvent(${JSON.stringify(eventName)}, {
    bubbles: ${bubbles}, cancelable: ${cancelable}, composed: ${composed},
    detail: ${JSON.stringify(detail)}
  });
  els.forEach((el) => el.dispatchEvent(evt));
}`;
      sse.executeScript(js);
    },
    // ----- simulator-only ----------------------------------------------
    raw(frame) {
      record?.({ type: 'raw', frame });
      enqueue(frame.endsWith('\n\n') ?
        frame : (frame.endsWith('\n') ? frame + '\n' : frame + '\n\n'));
    },
    delay(ms) {
      return sleep(ms, signal);
    },
    signal,
  };
  return sse;
}

// Multi-line values for `elements` / `signals` / `script` are split across
// multiple `data:` lines per SSE spec; Datastar rejoins them with newlines.
function formatSse(eventName, kvs) {
  const lines = [`event: ${eventName}`];
  for (const [key, value] of kvs) {
    if (value == null) {
      continue;
    }
    const str = String(value);
    if (str.includes('\n')) {
      for (const line of str.split('\n')) lines.push(`data: ${key} ${line}`);
    } else {
      lines.push(`data: ${key} ${str}`);
    }
  }
  return lines.join('\n') + '\n\n';
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeHtmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function abortError() {
  const e = new Error('aborted');
  e.name = 'AbortError';
  return e;
}

function isAbortError(err) {
  return err && typeof err === 'object' && err.name === 'AbortError';
}

// Tagged template that HTML-escapes interpolations. Use `html.raw(s)` to opt out.
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out += (v && typeof v === 'object' && v.__rawHtml) ? v.value : escapeHtmlText(v);
    out += strings[i + 1];
  }
  return out;
}
html.raw = (value) => ({ __rawHtml: true, value });

function register(method, pattern, handler) {
  install();
  const { regex, paramNames } = compilePattern(pattern);
  routes.push({ method, pattern, regex, paramNames, handler });
}

export const sim = {
  get: (p, h) => register('GET', p, h),
  post: (p, h) => register('POST', p, h),
  put: (p, h) => register('PUT', p, h),
  patch: (p, h) => register('PATCH', p, h),
  delete: (p, h) => register('DELETE', p, h),
  any: (p, h) => register('*', p, h),
  setLatency,
  setHandlerDelay,
  setUnreachable,
  setErrorResponse,
  setAccessLog,
  reset() { routes.length = 0; },
  routes: () => routes.map(r => ({ method: r.method, pattern: r.pattern })),
};

export default sim;
