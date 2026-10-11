/* Loads the Adsterra banner inside the isolated ad frame. Key and script URL are fixed here on purpose:
   never read them from the query string, or this page could be abused to run arbitrary scripts on the site's origin. */
(function () {
  var KEY = '94338a299763bb951992d9cd078429e9';
  window.atOptions = { key: KEY, format: 'iframe', height: 250, width: 300, params: {} };
  document.write('<scr' + 'ipt src="https://bauval.org/22/' + KEY + '"></scr' + 'ipt>');
})();

// Tell the parent whether a creative really rendered (an Adsterra ad is an <iframe>/<img>/<a> inside this page).
(function () {
  function report() {
    var filled = false;
    var nodes = document.querySelectorAll('iframe, img, ins, a, object, embed');
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.width > 20 && r.height > 20) { filled = true; break; }
    }
    try { parent.postMessage({ type: 'nl-ad-status', filled: filled }, '*'); } catch (e) {}
    return filled;
  }
  var tries = 0;
  var t = setInterval(function () { tries++; if (report() || tries >= 8) clearInterval(t); }, 1500);
})();
