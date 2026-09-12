// Shared weather data logic used by index.html and most-likely.html.
// Plain global (not an ES module) so both pages can load it with a simple <script> tag,
// including over file:// during local testing.
var WeatherCore = (function () {
  "use strict";

  var DEFAULT_LOCATION = { lat: 40.8054, lon: -74.2074, name: "Glen Ridge, NJ" };

  var MODEL_KEYS = ["gfs_seamless", "ecmwf_ifs025", "icon_seamless", "ukmo_seamless", "gem_seamless"];
  var MODEL_KEY_MAP = {
    gfs_seamless: "gfs",
    ecmwf_ifs025: "ecmwf",
    icon_seamless: "icon",
    ukmo_seamless: "ukmo",
    gem_seamless: "gem"
  };

  // The 6 Open-Meteo-family sources used for ensemble "most likely" consensus.
  var CONSENSUS_KEYS = ["om", "gfs", "ecmwf", "icon", "ukmo", "gem"];

  var WMO_DESC = {
    0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
    45: "Fog", 48: "Fog", 51: "Light Drizzle", 53: "Drizzle", 55: "Dense Drizzle",
    56: "Freezing Drizzle", 57: "Freezing Drizzle", 61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
    66: "Freezing Rain", 67: "Freezing Rain", 71: "Light Snow", 73: "Snow", 75: "Heavy Snow",
    77: "Snow Grains", 80: "Rain Showers", 81: "Rain Showers", 82: "Violent Showers",
    85: "Snow Showers", 86: "Snow Showers", 95: "Thunderstorm", 96: "Thunderstorm w/ Hail", 99: "Thunderstorm w/ Hail"
  };

  var HOURS = [];
  for (var h = 0; h < 24; h++) HOURS.push((h < 10 ? "0" : "") + h + ":00");

  var SOURCES = [
    { key: "nws", name: "NWS (NDFD)", slot: 1 },
    { key: "om", name: "Open-Meteo (Best Match)", slot: 2 },
    { key: "gfs", name: "GFS (NOAA)", slot: 3 },
    { key: "ecmwf", name: "ECMWF", slot: 4 },
    { key: "icon", name: "ICON (DWD)", slot: 5 },
    { key: "ukmo", name: "UKMO", slot: 6 },
    { key: "gem", name: "GEM (ECCC)", slot: 7 }
  ];

  var FIELDS = [
    { key: "temp", label: "Temperature", shortLabel: "Temp", unit: "°F", step: 5 },
    { key: "precip", label: "Precipitation chance", shortLabel: "Precip", unit: "%", step: 20, yMin: 0, yMax: 100 },
    { key: "wind", label: "Wind speed", shortLabel: "Wind", unit: "mph", step: 10, yMin: 0 },
    { key: "gust", label: "Wind gusts", shortLabel: "Gust", unit: "mph", step: 10, yMin: 0 },
    { key: "uv", label: "UV index", shortLabel: "UV", unit: "", step: 2, yMin: 0 },
    { key: "cloud", label: "Cloud cover", shortLabel: "Cloud", unit: "%", step: 20, yMin: 0, yMax: 100 }
  ];

  function round(v) { return v === null || v === undefined ? null : Math.round(v); }

  function parseNwsWindSpeed(str) {
    if (!str) return null;
    var nums = (str.match(/\d+(\.\d+)?/g) || []).map(Number);
    if (!nums.length) return null;
    return Math.round(nums.reduce(function (a, b) { return a + b; }, 0) / nums.length);
  }

  // ---------- fetching ----------
  async function resolveNwsHourlyUrl(lat, lon) {
    try {
      var res = await fetch("https://api.weather.gov/points/" + lat.toFixed(4) + "," + lon.toFixed(4), { headers: { Accept: "application/geo+json" } });
      if (!res.ok) return null;
      var j = await res.json();
      return (j.properties && j.properties.forecastHourly) || null;
    } catch (e) { return null; }
  }

  async function fetchNWS(lat, lon, dateStr) {
    var rows = {};
    var url = await resolveNwsHourlyUrl(lat, lon);
    if (!url) return rows;
    try {
      var res = await fetch(url, { headers: { Accept: "application/geo+json" } });
      if (!res.ok) return rows;
      var j = await res.json();
      (j.properties.periods || []).forEach(function (p) {
        if (p.startTime.slice(0, 10) === dateStr) {
          var hour = p.startTime.slice(11, 16);
          rows[hour] = {
            temp: p.temperature,
            precip: (p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value != null) ? p.probabilityOfPrecipitation.value : null,
            wind: parseNwsWindSpeed(p.windSpeed),
            gust: null,
            uv: null,
            cloud: null,
            cond: p.shortForecast || null
          };
        }
      });
    } catch (e) { /* leave rows as-is */ }
    return rows;
  }

  async function fetchModels(lat, lon, dateStr) {
    var out = {};
    var common = "latitude=" + lat + "&longitude=" + lon + "&start_date=" + dateStr + "&end_date=" + dateStr +
      "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York";
    var hourlyVars = "temperature_2m,precipitation_probability,weathercode,wind_speed_10m,wind_gusts_10m,uv_index,cloud_cover";
    var modelsUrl = "https://api.open-meteo.com/v1/forecast?" + common + "&hourly=" + hourlyVars + "&models=" + MODEL_KEYS.join(",");
    var bestMatchUrl = "https://api.open-meteo.com/v1/forecast?" + common + "&hourly=" + hourlyVars;

    try {
      var res = await fetch(modelsUrl);
      var json = await res.json();
      if (!json.error && json.hourly) {
        json.hourly.time.forEach(function (t, i) {
          var hour = t.slice(11, 16);
          Object.keys(MODEL_KEY_MAP).forEach(function (mk) {
            var key = MODEL_KEY_MAP[mk];
            var tempArr = json.hourly["temperature_2m_" + mk];
            if (!tempArr || tempArr[i] === undefined || tempArr[i] === null) return;
            out[key] = out[key] || {};
            var code = json.hourly["weathercode_" + mk] ? json.hourly["weathercode_" + mk][i] : null;
            out[key][hour] = {
              temp: round(tempArr[i]),
              precip: json.hourly["precipitation_probability_" + mk] ? json.hourly["precipitation_probability_" + mk][i] : null,
              wind: json.hourly["wind_speed_10m_" + mk] ? round(json.hourly["wind_speed_10m_" + mk][i]) : null,
              gust: json.hourly["wind_gusts_10m_" + mk] ? round(json.hourly["wind_gusts_10m_" + mk][i]) : null,
              uv: json.hourly["uv_index_" + mk] != null ? json.hourly["uv_index_" + mk][i] : null,
              cloud: json.hourly["cloud_cover_" + mk] ? round(json.hourly["cloud_cover_" + mk][i]) : null,
              cond: WMO_DESC[code] || null
            };
          });
        });
      }
    } catch (e) { /* ignore, out stays partial */ }

    try {
      var res2 = await fetch(bestMatchUrl);
      var json2 = await res2.json();
      if (!json2.error && json2.hourly) {
        out.om = {};
        json2.hourly.time.forEach(function (t, i) {
          var hour = t.slice(11, 16);
          out.om[hour] = {
            temp: round(json2.hourly.temperature_2m[i]),
            precip: json2.hourly.precipitation_probability[i],
            wind: round(json2.hourly.wind_speed_10m[i]),
            gust: round(json2.hourly.wind_gusts_10m[i]),
            uv: json2.hourly.uv_index[i],
            cloud: round(json2.hourly.cloud_cover[i]),
            cond: WMO_DESC[json2.hourly.weathercode[i]] || null
          };
        });
      }
    } catch (e) { /* ignore */ }

    return out;
  }

  function assembleData(nwsRows, modelRows) {
    var data = {};
    SOURCES.forEach(function (s) {
      data[s.key] = { cond: [] };
      FIELDS.forEach(function (f) { data[s.key][f.key] = []; });
    });
    HOURS.forEach(function (hr) {
      var n = nwsRows[hr];
      FIELDS.forEach(function (f) { data.nws[f.key].push(n ? valueOrNull(n[f.key]) : null); });
      data.nws.cond.push(n ? n.cond : null);
      CONSENSUS_KEYS.forEach(function (k) {
        var r = modelRows[k] && modelRows[k][hr];
        FIELDS.forEach(function (f) { data[k][f.key].push(r ? valueOrNull(r[f.key]) : null); });
        data[k].cond.push(r ? r.cond : null);
      });
    });
    return data;
  }
  function valueOrNull(v) { return v === undefined ? null : v; }

  // ---------- stats helpers ----------
  function median(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function mode(arr) {
    if (!arr.length) return null;
    var counts = {}, best = null, bestCount = 0;
    arr.forEach(function (v) {
      counts[v] = (counts[v] || 0) + 1;
      if (counts[v] > bestCount) { bestCount = counts[v]; best = v; }
    });
    return best;
  }

  // Ensemble consensus across CONSENSUS_KEYS: median + min/max spread per field, mode of condition text.
  function computeConsensus(data) {
    var out = { cond: [] };
    FIELDS.forEach(function (f) { out[f.key] = { median: [], min: [], max: [] }; });
    for (var i = 0; i < HOURS.length; i++) {
      FIELDS.forEach(function (f) {
        var vals = CONSENSUS_KEYS.map(function (k) { return data[k][f.key][i]; }).filter(function (v) { return v !== null && v !== undefined; });
        out[f.key].median.push(vals.length ? median(vals) : null);
        out[f.key].min.push(vals.length ? Math.min.apply(null, vals) : null);
        out[f.key].max.push(vals.length ? Math.max.apply(null, vals) : null);
      });
      var conds = CONSENSUS_KEYS.map(function (k) { return data[k].cond[i]; }).filter(Boolean);
      out.cond.push(conds.length ? mode(conds) : null);
    }
    return out;
  }

  // ---------- geocoding ----------
  async function searchLocations(query) {
    if (!query || query.trim().length < 2) return [];
    var res = await fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(query.trim()) + "&count=6&language=en&format=json");
    var j = await res.json();
    return (j.results || []).map(function (r) {
      return {
        lat: r.latitude,
        lon: r.longitude,
        display: [r.name, r.admin1, r.country_code].filter(Boolean).join(", ")
      };
    });
  }

  async function reverseGeocode(lat, lon) {
    try {
      var res = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" + lat + "&longitude=" + lon + "&localityLanguage=en");
      var j = await res.json();
      var city = j.city || j.locality || "";
      var region = j.principalSubdivisionCode ? j.principalSubdivisionCode.split("-").pop() : (j.principalSubdivision || "");
      var label = [city, region].filter(Boolean).join(", ");
      return label || (lat.toFixed(3) + ", " + lon.toFixed(3));
    } catch (e) {
      return lat.toFixed(3) + ", " + lon.toFixed(3);
    }
  }

  // ---------- caching (sessionStorage) for snappy cross-page navigation ----------
  var CACHE_TTL_MS = 10 * 60 * 1000;
  function cacheKey(lat, lon, dateStr) {
    return "wx:" + lat.toFixed(2) + "," + lon.toFixed(2) + ":" + dateStr;
  }
  function getCached(lat, lon, dateStr) {
    try {
      var raw = sessionStorage.getItem(cacheKey(lat, lon, dateStr));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch (e) { return null; }
  }
  function setCached(lat, lon, dateStr, data) {
    try {
      sessionStorage.setItem(cacheKey(lat, lon, dateStr), JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) { /* storage full or unavailable — non-fatal */ }
  }

  async function loadData(lat, lon, dateStr) {
    var cached = getCached(lat, lon, dateStr);
    if (cached) return cached;
    var results = await Promise.all([fetchNWS(lat, lon, dateStr), fetchModels(lat, lon, dateStr)]);
    var data = assembleData(results[0], results[1]);
    setCached(lat, lon, dateStr, data);
    return data;
  }

  // ---------- shared small utils ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toDateStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(d, n) { var c = new Date(d); c.setDate(c.getDate() + n); return c; }
  function friendlyDate(dateStr) {
    var parts = dateStr.split("-").map(Number);
    var dt = new Date(parts[0], parts[1] - 1, parts[2]);
    return dt.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  function hasAny(arr) { return arr.some(function (v) { return v !== null && v !== undefined; }); }

  function getSavedLocation() {
    try {
      var raw = localStorage.getItem("wx:location");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function saveLocation(loc) {
    try { localStorage.setItem("wx:location", JSON.stringify(loc)); } catch (e) { /* ignore */ }
  }

  function detectLocation(timeoutMs) {
    return new Promise(function (resolve) {
      if (!("geolocation" in navigator)) { resolve(null); return; }
      var timer = setTimeout(function () { resolve(null); }, timeoutMs || 6000);
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          clearTimeout(timer);
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        function () { clearTimeout(timer); resolve(null); },
        { maximumAge: 10 * 60 * 1000, timeout: timeoutMs || 6000 }
      );
    });
  }

  return {
    DEFAULT_LOCATION: DEFAULT_LOCATION,
    HOURS: HOURS,
    SOURCES: SOURCES,
    FIELDS: FIELDS,
    CONSENSUS_KEYS: CONSENSUS_KEYS,
    WMO_DESC: WMO_DESC,
    fetchNWS: fetchNWS,
    fetchModels: fetchModels,
    assembleData: assembleData,
    computeConsensus: computeConsensus,
    median: median,
    mode: mode,
    parseNwsWindSpeed: parseNwsWindSpeed,
    searchLocations: searchLocations,
    reverseGeocode: reverseGeocode,
    loadData: loadData,
    toDateStr: toDateStr,
    addDays: addDays,
    friendlyDate: friendlyDate,
    hasAny: hasAny,
    getSavedLocation: getSavedLocation,
    saveLocation: saveLocation,
    detectLocation: detectLocation
  };
})();

if (typeof module !== "undefined") { module.exports = WeatherCore; }
