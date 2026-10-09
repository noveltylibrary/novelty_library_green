/* Loads the Adsterra banner inside the isolated ad frame. Key and script URL are fixed here on purpose:
   never read them from the query string, or this page could be abused to run arbitrary scripts on the site's origin. */
(function () {
  var KEY = '94338a299763bb951992d9cd078429e9';
  window.atOptions = { key: KEY, format: 'iframe', height: 250, width: 300, params: {} };
  document.write('<scr' + 'ipt src="https://bauval.org/22/' + KEY + '"></scr' + 'ipt>');
})();
