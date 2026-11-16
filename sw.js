/* Zulu Shack service worker: keeps the app working with no signal.
   Pages load from the network first (so updates arrive), then fall back to the saved copy.
   Live data (weather, solar, spots, orbits) is NOT handled here; the app saves its own last values. */
var V = "zs-v1";
var CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];
var LIB = "https://cdnjs.cloudflare.com/ajax/libs/satellite.js/5.0.0/satellite.min.js";

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(V).then(function (c) {
      var jobs = CORE.map(function (u) { return c.add(u).catch(function () {}); });
      jobs.push(c.add(new Request(LIB, { mode: "cors" })).catch(function () {}));
      return Promise.all(jobs);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var u = new URL(r.url);

  if (r.mode === "navigate") {
    var net = fetch(r);
    var wait = new Promise(function (_, no) { setTimeout(no, 4000); });
    e.respondWith(
      Promise.race([net, wait]).then(function (x) {
        if (x && x.ok) { var cp = x.clone(); caches.open(V).then(function (c) { c.put("index.html", cp); }); }
        return x;
      }).catch(function () {
        return caches.match("index.html").then(function (m) { return m || caches.match("./"); });
      })
    );
    return;
  }

  if (u.origin === self.location.origin || r.url === LIB) {
    e.respondWith(
      caches.match(r).then(function (m) {
        var n = fetch(r).then(function (x) {
          if (x && x.ok) { var cp = x.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); }
          return x;
        }).catch(function () { return m; });
        return m || n;
      })
    );
  }
});
