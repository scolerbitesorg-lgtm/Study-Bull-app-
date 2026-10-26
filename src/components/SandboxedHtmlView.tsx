import React, { useEffect, useId, useMemo, useRef, useState } from "react";

export interface SandboxedHtmlViewProps {
  htmlContent?: string | null;
  title?: string;
  minHeight?: number | string;
  maxHeight?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

export default function SandboxedHtmlView({
  htmlContent,
  title,
  minHeight = 480,
  maxHeight,
  style,
  className,
}: SandboxedHtmlViewProps) {
  const uniqueId = useId().replace(/[:]/g, "_");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  const trimmed = (htmlContent || "").trim();
  const isEmpty = trimmed.length === 0;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.data &&
        typeof event.data === "object" &&
        event.data.type === "STUDYBULL_HTML_RESIZE" &&
        event.data.id === uniqueId &&
        typeof event.data.height === "number" &&
        event.data.height > 40
      ) {
        // No upper cap: a long notes page must grow to its full height so the
        // page itself scrolls to the real end of the content (was capped at 3500 px).
        const reported = event.data.height;
        setContentHeight((prev) => {
          // A document that merely fills the frame (height:100%/100vh) reports the
          // frame's own height back; treat that as stable so it can't grow forever.
          if (prev !== null && reported >= prev - 8 && reported <= prev + 4) return prev;
          return Math.max(280, Math.min(reported + 8, 200000));
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [uniqueId]);

  const safeSrcDoc = useMemo(() => {
    if (isEmpty) return "";

    const polyfillScript = `
<script>
(function() {
  // 1. API Fetch & XMLHttpRequest Enhancement (Automatic HTTPS upgrade & CORS resilience)
  try {
    var origFetch = window.fetch;
    if (typeof origFetch === "function") {
      window.fetch = function(input, init) {
        try {
          if (typeof input === "string" && input.startsWith("http://")) {
            input = "https://" + input.slice(7);
          } else if (input && typeof input === "object" && input.url && input.url.startsWith("http://")) {
            input = new Request("https://" + input.url.slice(7), input);
          }
        } catch(err) {}
        return origFetch.call(this, input, init);
      };
    }
  } catch(e) {}

  try {
    var OrigXHR = window.XMLHttpRequest;
    if (OrigXHR && OrigXHR.prototype && OrigXHR.prototype.open) {
      var origOpen = OrigXHR.prototype.open;
      OrigXHR.prototype.open = function(method, url) {
        try {
          if (typeof url === "string" && url.startsWith("http://")) {
            url = "https://" + url.slice(7);
          }
        } catch(err) {}
        return origOpen.apply(this, arguments);
      };
    }
  } catch(e) {}

  // 2. Resilient Storage (localStorage & sessionStorage fallback for data catching/caching)
  function createMemoryStore() {
    var store = {};
    return {
      getItem: function(k) { return store.hasOwnProperty(k) ? store[k] : null; },
      setItem: function(k, v) { store[k] = String(v); },
      removeItem: function(k) { delete store[k]; },
      clear: function() { store = {}; },
      key: function(i) { return Object.keys(store)[i] || null; },
      get length() { return Object.keys(store).length; }
    };
  }

  try {
    var testKey = "__sb_test_" + Math.random();
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
  } catch(e) {
    try {
      var memLocal = createMemoryStore();
      var memSession = createMemoryStore();
      Object.defineProperty(window, "localStorage", { value: memLocal, configurable: true, writable: true });
      Object.defineProperty(window, "sessionStorage", { value: memSession, configurable: true, writable: true });
    } catch(err2) {}
  }

  // 3. User interaction fallbacks (alert, confirm, prompt)
  if (typeof window.alert !== "function") {
    window.alert = function(msg) { console.log("[Alert]:", msg); };
  }
  if (typeof window.confirm !== "function") {
    window.confirm = function() { return true; };
  }
  if (typeof window.prompt !== "function") {
    window.prompt = function() { return ""; };
  }

  // 4. Global error and unhandled rejection guards (prevents script crashes from stopping rendering)
  window.addEventListener("error", function(e) {
    console.warn("[StudyBull Sandbox Notice]:", e.message || e);
  });
  window.addEventListener("unhandledrejection", function(e) {
    console.warn("[StudyBull Sandbox Unhandled Rejection]:", e.reason);
  });
})();
</script>
`;

    const resizeScript = `
<script>
(function() {
  var lastH = 0;
  function reportHeight() {
    try {
      var h = Math.max(
        document.body ? document.body.scrollHeight : 0,
        document.documentElement ? document.documentElement.scrollHeight : 0,
        document.body ? document.body.offsetHeight : 0
      );
      if (h > 0 && Math.abs(h - lastH) > 4) {
        lastH = h;
        if (window.parent) {
          window.parent.postMessage({
            type: "STUDYBULL_HTML_RESIZE",
            id: "${uniqueId}",
            height: h
          }, "*");
        }
      }
    } catch(e) {}
  }

  // Instant execution without delay
  reportHeight();
  if (document.readyState === "complete" || document.readyState === "interactive") {
    reportHeight();
  } else {
    window.addEventListener("DOMContentLoaded", reportHeight);
  }
  window.addEventListener("load", reportHeight);

  if (typeof ResizeObserver !== "undefined" && document.body) {
    try {
      var ro = new ResizeObserver(function() { reportHeight(); });
      ro.observe(document.body);
      if (document.documentElement) ro.observe(document.documentElement);
    } catch(e) {}
  }
  setInterval(reportHeight, 1000);
})();
</script>
`;

    const metaViewport = `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">`;
    const baseStyle = `
<style>
  html, body {
    max-width: 100%;
    overflow-x: hidden;
    -webkit-text-size-adjust: 100%;
    box-sizing: border-box;
  }
  *, *:before, *:after { box-sizing: inherit; }
  img, video, canvas, svg { max-width: 100%; height: auto; }
</style>
`;

    // Complete HTML Document
    if (/<html[\s>]/i.test(trimmed) || /<!doctype/i.test(trimmed)) {
      let doc = trimmed;

      if (!/<meta[^>]+viewport/i.test(doc)) {
        if (/<head[\s>]/i.test(doc)) {
          doc = doc.replace(/<head[\s>]/i, (match) => `${match}\n  ${metaViewport}`);
        } else if (/<html[\s>]/i.test(doc)) {
          doc = doc.replace(/<html[\s>]/i, (match) => `${match}\n<head>${metaViewport}</head>`);
        }
      }

      if (/<head[\s>]/i.test(doc)) {
        doc = doc.replace(/<head[\s>]/i, (match) => `${match}\n${polyfillScript}\n${baseStyle}`);
      } else if (/<body[\s>]/i.test(doc)) {
        doc = doc.replace(/<body[\s>]/i, (match) => `${polyfillScript}\n${baseStyle}\n${match}`);
      } else if (/<html[\s>]/i.test(doc)) {
        doc = doc.replace(/<html[\s>]/i, (match) => `${match}\n<head>${polyfillScript}${baseStyle}</head>`);
      } else {
        // Fallback: append after doctype
        doc = doc.replace(/(<!doctype[^>]*>)/i, `$1\n<head>${polyfillScript}${baseStyle}</head>`);
      }

      if (/<\/body>/i.test(doc)) {
        return doc.replace(/<\/body>/i, `${resizeScript}\n</body>`);
      }
      return doc + resizeScript;
    }

    // HTML Snippet
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${metaViewport}
  ${polyfillScript}
  ${baseStyle}
  <style>
    body {
      margin: 0;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #ffffff;
      color: #0f172a;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  ${trimmed}
  ${resizeScript}
</body>
</html>`;
  }, [trimmed, isEmpty, uniqueId]);

  if (isEmpty) {
    return (
      <div
        className={className}
        style={{
          width: "100%",
          padding: "36px 20px",
          textAlign: "center",
          background: "#f8fafc",
          borderRadius: 12,
          border: "1px dashed #cbd5e1",
          color: "#64748b",
          boxSizing: "border-box",
          ...style,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#334155" }}>
          {title ? `No content available for "${title}"` : "No custom web content"}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
          HTML code has not been added to this section yet.
        </p>
      </div>
    );
  }

  const isFullScreen = minHeight === "100%" || style?.height === "100%";
  const computedHeight = isFullScreen ? "100%" : (contentHeight || minHeight);

  return (
    <div
      className={className}
      style={{
        width: "100%",
        maxWidth: "100%",
        height: isFullScreen ? "100%" : undefined,
        boxSizing: "border-box",
        overflow: "hidden",
        borderRadius: 12,
        background: "#ffffff",
        display: isFullScreen ? "flex" : "block",
        flexDirection: isFullScreen ? "column" : undefined,
        flex: isFullScreen ? 1 : undefined,
        ...style,
      }}
    >
      <iframe
        ref={iframeRef}
        title={title || "Custom Web View"}
        srcDoc={safeSrcDoc}
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
        allow="fullscreen; clipboard-read; clipboard-write; autoplay; encrypted-media; picture-in-picture; geolocation; camera; microphone"
        loading="eager"
        style={{
          width: "100%",
          maxWidth: "100%",
          height: computedHeight,
          minHeight: minHeight,
          maxHeight: maxHeight,
          border: "none",
          borderRadius: "12px",
          background: "#ffffff",
          display: "block",
          overflowY: "auto",
          overflowX: "hidden",
          boxSizing: "border-box",
          flex: isFullScreen ? 1 : undefined,
        }}
      />
    </div>
  );
}

export { SandboxedHtmlView };
