/**
 * WCAG 2.1 contrast utilities + WebAIM Contrast Checker API integration.
 * Ensures site colors meet WCAG AA/AAA where possible.
 */

(function (global) {
  function parseHex(hex) {
    hex = String(hex).replace(/^#/, "");
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length !== 6) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255
    };
  }

  function rgbToHex(r, g, b) {
    r = Math.round(Math.max(0, Math.min(255, r)));
    g = Math.round(Math.max(0, Math.min(255, g)));
    b = Math.round(Math.max(0, Math.min(255, b)));
    return [r, g, b].map(function (x) {
      var h = x.toString(16);
      return h.length === 1 ? "0" + h : h;
    }).join("");
  }

  function cssColorToHex(cssColor) {
    if (!cssColor) return null;
    var m = cssColor.match(/^#([0-9A-Fa-f]{3,8})$/);
    if (m) {
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return h.length >= 6 ? h.slice(0, 6) : null;
    }
    m = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
    m = cssColor.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (m) return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
    return null;
  }

  function relativeLuminance(rgb) {
    function f(c) {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
  }

  function contrastRatio(hex1, hex2) {
    var a = parseHex(hex1);
    var b = parseHex(hex2);
    if (!a || !b) return 0;
    var L1 = relativeLuminance(a);
    var L2 = relativeLuminance(b);
    var light = Math.max(L1, L2);
    var dark = Math.min(L1, L2);
    return (light + 0.05) / (dark + 0.05);
  }

  var WCAG = {
    AA_TEXT: 4.5,
    AAA_TEXT: 7,
    AA_LARGE: 3,
    AAA_LARGE: 4.5,
    AA_UI: 3
  };

  function checkLocal(hexFg, hexBg) {
    var ratio = contrastRatio(hexFg, hexBg);
    return {
      ratio: Math.round(ratio * 100) / 100,
      aa: ratio >= WCAG.AA_TEXT,
      aaa: ratio >= WCAG.AAA_TEXT,
      aaLarge: ratio >= WCAG.AA_LARGE,
      aaaLarge: ratio >= WCAG.AAA_LARGE,
      source: "local"
    };
  }

  var WEBAIM_BASE = "https://webaim.org/resources/contrastchecker/";
  function fetchWebAIM(fgHex, bgHex) {
    var f = (fgHex || "").replace(/^#/, "");
    var b = (bgHex || "").replace(/^#/, "");
    if (f.length !== 6 || b.length !== 6) return Promise.reject(new Error("Invalid hex"));
    var url = WEBAIM_BASE + "?fcolor=" + f + "&bcolor=" + b + "&api";
    return fetch(url, { method: "GET", mode: "cors" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var ratio = parseFloat(data.ratio) || 0;
        return {
          ratio: ratio,
          aa: data.aa === true || data.AA === true,
          aaa: data.aaa === true || data.AAA === true,
          aaLarge: ratio >= WCAG.AA_LARGE,
          aaaLarge: ratio >= WCAG.AAA_LARGE,
          source: "webaim"
        };
      });
  }

  function checkContrast(hexFg, hexBg) {
    return fetchWebAIM(hexFg, hexBg).catch(function () {
      return Promise.resolve(checkLocal(hexFg, hexBg));
    });
  }

  function getComputedHex(varName) {
    if (typeof document === "undefined" || !document.documentElement) return null;
    var style = getComputedStyle(document.documentElement);
    var val = style.getPropertyValue(varName).trim();
    if (!val) return null;
    var hex = cssColorToHex(val);
    return hex ? hex.replace(/^#/, "") : null;
  }

  function runFullCheck() {
    var pairs = [
      { fg: "--text", bg: "--surface", label: "Texte / Fond" },
      { fg: "--text", bg: "--surface-2", label: "Texte / Carte" },
      { fg: "--text-muted", bg: "--surface-2", label: "Texte secondaire / Carte" },
      { fg: "--primary", bg: "--surface", label: "Bouton primaire / Fond" },
      { fg: "#ffffff", bg: "--primary", label: "Texte sur bouton primaire" }
    ];
    var results = [];
    var hexCache = {};
    function getHex(key) {
      if (hexCache[key] !== undefined) return hexCache[key];
      if (key.indexOf("--") === 0) {
        var style = getComputedStyle(document.documentElement);
        var val = style.getPropertyValue(key).trim();
        hexCache[key] = cssColorToHex(val);
      } else {
        hexCache[key] = key.replace(/^#/, "");
      }
      return hexCache[key];
    }
    return Promise.all(pairs.map(function (p) {
      var fg = getHex(p.fg);
      var bg = getHex(p.bg);
      if (!fg || !bg) return Promise.resolve({ label: p.label, error: "Couleur inconnue" });
      return checkContrast(fg, bg).then(function (r) {
        return { label: p.label, fg: p.fg, bg: p.bg, result: r };
      });
    })).then(function (list) {
      return list;
    });
  }

  function suggestAccessibleFg(bgHex, minRatio) {
    minRatio = minRatio || WCAG.AA_TEXT;
    var hex = String(bgHex).replace(/^#/, "");
    var bg = parseHex(hex);
    if (!bg) return null;
    var L = relativeLuminance(bg);
    var low = 0;
    var high = 1;
    for (var step = 0; step < 25; step++) {
      var mid = (low + high) / 2;
      var testHex = rgbToHex(mid * 255, mid * 255, mid * 255);
      var r = contrastRatio(testHex, hex);
      if (r >= minRatio) {
        if (L > 0.5) high = mid; else low = mid;
      } else {
        if (L > 0.5) low = mid; else high = mid;
      }
    }
    var finalL = L > 0.5 ? low : high;
    return rgbToHex(Math.round(finalL * 255), Math.round(finalL * 255), Math.round(finalL * 255));
  }

  global.WCAG_ACCESSIBILITY = {
    contrastRatio: contrastRatio,
    checkLocal: checkLocal,
    checkContrast: checkContrast,
    fetchWebAIM: fetchWebAIM,
    runFullCheck: runFullCheck,
    getComputedHex: getComputedHex,
    cssColorToHex: cssColorToHex,
    suggestAccessibleFg: suggestAccessibleFg,
    WCAG: WCAG
  };
})(typeof window !== "undefined" ? window : this);
