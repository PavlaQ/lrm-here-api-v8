(function e(t, n, r) {
  function s(o, u) {
    if (!n[o]) {
      if (!t[o]) {
        var a = typeof require == 'function' && require;
        if (!u && a) return a(o, !0);
        if (i) return i(o, !0);
        var f = new Error('Cannot find module \'' + o + '\'');
        throw f.code = 'MODULE_NOT_FOUND', f;
      }
      var l = n[o] = { exports: {} };
      t[o][0].call(l.exports, function(e) {
        var n = t[o][1][e];
        return s(n ? n : e);
      }, l, l.exports, e, t, n, r);
    }
    return n[o].exports;
  }

  var i = typeof require == 'function' && require;
  for (var o = 0; o < r.length; o++) s(r[o]);
  return s;
})({
  1: [function(require, module, exports) {
    function corslite(url, callback, cors) {
      var sent = false;

      if (typeof window.XMLHttpRequest === 'undefined') {
        return callback(Error('Browser not supported'));
      }

      if (typeof cors === 'undefined') {
        var m = url.match(/^\s*https?:\/\/[^\/]*/);
        cors = m && (m[0] !== location.protocol + '//' + location.domain +
          (location.port ? ':' + location.port : ''));
      }

      var x = new window.XMLHttpRequest();

      function isSuccessful(status) {
        return status >= 200 && status < 300 || status === 304;
      }

      if (cors && !('withCredentials' in x)) {
        // IE8-9
        x = new window.XDomainRequest();

        // Ensure callback is never called synchronously, i.e., before
        // x.send() returns (this has been observed in the wild).
        // See https://github.com/mapbox/mapbox.js/issues/472
        var original = callback;
        callback = function() {
          if (sent) {
            original.apply(this, arguments);
          } else {
            var that = this, args = arguments;
            setTimeout(function() {
              original.apply(that, args);
            }, 0);
          }
        };
      }

      function loaded() {
        if (
          // XDomainRequest
          x.status === undefined ||
          // modern browsers
          isSuccessful(x.status)) callback.call(x, null, x);
        else callback.call(x, x, null);
      }

      // Both `onreadystatechange` and `onload` can fire. `onreadystatechange`
      // has [been supported for longer](http://stackoverflow.com/a/9181508/229001).
      if ('onload' in x) {
        x.onload = loaded;
      } else {
        x.onreadystatechange = function readystate() {
          if (x.readyState === 4) {
            loaded();
          }
        };
      }

      // Call the callback with the XMLHttpRequest object as an error and prevent
      // it from ever being called again by reassigning it to `noop`
      x.onerror = function error(evt) {
        // XDomainRequest provides no evt parameter
        callback.call(this, evt || true, null);
        callback = function() {
        };
      };

      // IE9 must have onprogress be set to a unique function.
      x.onprogress = function() {
      };

      x.ontimeout = function(evt) {
        callback.call(this, evt, null);
        callback = function() {
        };
      };

      x.onabort = function(evt) {
        callback.call(this, evt, null);
        callback = function() {
        };
      };

      // GET is the only supported HTTP Verb by XDomainRequest and is the
      // only one supported here.
      x.open('GET', url, true);

      // Send the request. Sending data is not supported.
      x.send(null);
      sent = true;

      return x;
    }

    if (typeof module !== 'undefined') module.exports = corslite;

  }, {}],
  2: [function(require, module, exports) {

    var haversine = (function() {
      var RADII = {
        km: 6371,
        mile: 3960,
        meter: 6371000,
        nmi: 3440,
      };

      // convert to radians
      var toRad = function(num) {
        return num * Math.PI / 180;
      };

      // convert coordinates to standard format based on the passed format option
      var convertCoordinates = function(format, coordinates) {
        switch (format) {
          case '[lat,lon]':
            return { latitude: coordinates[0], longitude: coordinates[1] };
          case '[lon,lat]':
            return { latitude: coordinates[1], longitude: coordinates[0] };
          case '{lon,lat}':
            return { latitude: coordinates.lat, longitude: coordinates.lon };
          case '{lat,lng}':
            return { latitude: coordinates.lat, longitude: coordinates.lng };
          case 'geojson':
            return { latitude: coordinates.geometry.coordinates[1], longitude: coordinates.geometry.coordinates[0] };
          default:
            return coordinates;
        }
      };

      return function haversine(startCoordinates, endCoordinates, options) {
        options = options || {};

        var R = options.unit in RADII
          ? RADII[options.unit]
          : RADII.km;

        var start = convertCoordinates(options.format, startCoordinates);
        var end = convertCoordinates(options.format, endCoordinates);

        var dLat = toRad(end.latitude - start.latitude);
        var dLon = toRad(end.longitude - start.longitude);
        var lat1 = toRad(start.latitude);
        var lat2 = toRad(end.latitude);

        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (options.threshold) {
          return options.threshold > (R * c);
        }

        return R * c;
      };

    })();

    if (typeof module !== 'undefined' && module.exports) {
      module.exports = haversine;
    }

  }, {}],
  3: [function(require, module, exports) {
    var flexible = (function() {
    /*
 * Copyright (C) 2019 HERE Europe B.V.
 * Licensed under MIT, see full license in LICENSE
 * SPDX-License-Identifier: MIT
 * License-Filename: LICENSE
 */
    const DEFAULT_PRECISION = 5;

    const ENCODING_TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    const DECODING_TABLE = [
      62, -1, -1, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1,
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      22, 23, 24, 25, -1, -1, -1, -1, 63, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
      36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
    ];

    const FORMAT_VERSION = 1;

    const ABSENT = 0;
    const LEVEL = 1;
    const ALTITUDE = 2;
    const ELEVATION = 3;
// Reserved values 4 and 5 should not be selectable
    const CUSTOM1 = 6;
    const CUSTOM2 = 7;

    const Num = typeof BigInt !== "undefined" ? BigInt : Number;

    function decode(encoded) {
      const decoder = decodeUnsignedValues(encoded);
      const header = decodeHeader(decoder[0], decoder[1]);

      const factorDegree = 10 ** header.precision;
      const factorZ = 10 ** header.thirdDimPrecision;
      const { thirdDim } = header;

      let lastLat = 0;
      let lastLng = 0;
      let lastZ = 0;
      const res = [];

      let i = 2;
      for (; i < decoder.length;) {
        const deltaLat = toSigned(decoder[i]) / factorDegree;
        const deltaLng = toSigned(decoder[i + 1]) / factorDegree;
        lastLat += deltaLat;
        lastLng += deltaLng;

        if (thirdDim) {
          const deltaZ = toSigned(decoder[i + 2]) / factorZ;
          lastZ += deltaZ;
          res.push([lastLat, lastLng, lastZ]);
          i += 3;
        } else {
          res.push([lastLat, lastLng]);
          i += 2;
        }
      }

      if (i !== decoder.length) {
        throw new Error('Invalid encoding. Premature ending reached');
      }

      return {
        ...header,
        polyline: res,
      };
    }

    function decodeChar(char) {
      const charCode = char.charCodeAt(0);
      return DECODING_TABLE[charCode - 45];
    }

    function decodeUnsignedValues(encoded) {
      let result = Num(0);
      let shift = Num(0);
      const resList = [];

      encoded.split('').forEach((char) => {
        const value = Num(decodeChar(char));
        result |= (value & Num(0x1F)) << shift;
        if ((value & Num(0x20)) === Num(0)) {
          resList.push(result);
          result = Num(0);
          shift = Num(0);
        } else {
          shift += Num(5);
        }
      });

      if (shift > 0) {
        throw new Error('Invalid encoding');
      }

      return resList;
    }

    function decodeHeader(version, encodedHeader) {
      if (+version.toString() !== FORMAT_VERSION) {
        throw new Error('Invalid format version');
      }
      const headerNumber = +encodedHeader.toString();
      const precision = headerNumber & 15;
      const thirdDim = (headerNumber >> 4) & 7;
      const thirdDimPrecision = (headerNumber >> 7) & 15;
      return { precision, thirdDim, thirdDimPrecision };
    }

    function toSigned(val) {
      // Decode the sign from an unsigned value
      let res = val;
      if (res & Num(1)) {
        res = ~res;
      }
      res >>= Num(1);
      return +res.toString();
    }

    function encode({ precision = DEFAULT_PRECISION, thirdDim = ABSENT, thirdDimPrecision = 0, polyline }) {
      // Encode a sequence of lat,lng or lat,lng(,{third_dim}). Note that values should be of type BigNumber
      //   `precision`: how many decimal digits of precision to store the latitude and longitude.
      //   `third_dim`: type of the third dimension if present in the input.
      //   `third_dim_precision`: how many decimal digits of precision to store the third dimension.

      const multiplierDegree = 10 ** precision;
      const multiplierZ = 10 ** thirdDimPrecision;
      const encodedHeaderList = encodeHeader(precision, thirdDim, thirdDimPrecision);
      const encodedCoords = [];

      let lastLat = Num(0);
      let lastLng = Num(0);
      let lastZ = Num(0);
      polyline.forEach((location) => {
        const lat = Num(Math.round(location[0] * multiplierDegree));
        encodedCoords.push(encodeScaledValue(lat - lastLat));
        lastLat = lat;

        const lng = Num(Math.round(location[1] * multiplierDegree));
        encodedCoords.push(encodeScaledValue(lng - lastLng));
        lastLng = lng;

        if (thirdDim) {
          const z = Num(Math.round(location[2] * multiplierZ));
          encodedCoords.push(encodeScaledValue(z - lastZ));
          lastZ = z;
        }
      });

      return [...encodedHeaderList, ...encodedCoords].join('');
    }

    function encodeHeader(precision, thirdDim, thirdDimPrecision) {
      // Encode the `precision`, `third_dim` and `third_dim_precision` into one encoded char
      if (precision < 0 || precision > 15) {
        throw new Error('precision out of range. Should be between 0 and 15');
      }
      if (thirdDimPrecision < 0 || thirdDimPrecision > 15) {
        throw new Error('thirdDimPrecision out of range. Should be between 0 and 15');
      }
      if (thirdDim < 0 || thirdDim > 7 || thirdDim === 4 || thirdDim === 5) {
        throw new Error('thirdDim should be between 0, 1, 2, 3, 6 or 7');
      }

      const res = (thirdDimPrecision << 7) | (thirdDim << 4) | precision;
      return encodeUnsignedNumber(FORMAT_VERSION) + encodeUnsignedNumber(res);
    }

    function encodeUnsignedNumber(val) {
      // Uses variable integer encoding to encode an unsigned integer. Returns the encoded string.
      let res = '';
      let numVal = Num(val);
      while (numVal > 0x1F) {
        const pos = (numVal & Num(0x1F)) | Num(0x20);
        res += ENCODING_TABLE[pos];
        numVal >>= Num(5);
      }
      return res + ENCODING_TABLE[numVal];
    }

    function encodeScaledValue(value) {
      // Transform a integer `value` into a variable length sequence of characters.
      //   `appender` is a callable where the produced chars will land to
      let numVal = Num(value);
      const negative = numVal < 0;
      numVal <<= Num(1);
      if (negative) {
        numVal = ~numVal;
      }

      return encodeUnsignedNumber(numVal);
    }

    return {
      encode,
      decode,

      ABSENT,
      LEVEL,
      ALTITUDE,
      ELEVATION,
    };
  })();
    module.exports = flexible;

  }, {}],
  4: [function(require, module, exports) {
    (function(global) {
      (function() {
        'use strict';

        var L = (typeof window !== 'undefined' ? window['L'] : typeof global !== 'undefined' ? global['L'] : null);
        var corslite = require('corslite');
        var haversine = require('haversine');

        var flexible = require('flexible');
        L.Routing = L.Routing || {};

        var baseWaypoints = [];

        function is(className, object) {
          return Object.prototype.toString.call(object) === '[object '+ className +']';
        }

        const DataEncoder = function() {
          this.levels = [];
          this.actualKey = null;

        }

        DataEncoder.prototype.__dataEncoding = function(data) {
          let uriPart = '';
          const levelsSize = this.levels.length;
          if (levelsSize) {
            uriPart = this.levels[0];
            for(let c = 1; c < levelsSize; c++) {
              uriPart += '[' + this.levels[c] + ']';
            }
          }
          let finalString = '';
          if (is('Object', data)) {
            const keys = Object.keys(data);
            const l = keys.length;
            for(let a = 0; a < l; a++) {
              const key = keys[a];
              let value = data[key];
              this.actualKey = key;
              this.levels.push(this.actualKey);
              finalString += this.__dataEncoding(value);
            }
          } else if (is('Array', data)) {
            if (!this.actualKey) throw new Error("Directly passed array does not work")
            const aSize = data.length;
            for (let b = 0; b < aSize; b++) {
              let aVal = data[b];
              this.levels.push(b);
              finalString += this.__dataEncoding(aVal);
            }
          } else {
            finalString += uriPart + '=' + encodeURIComponent(data) + '&';
          }
          this.levels.pop();
          return finalString;
        }

        DataEncoder.prototype.encode = function(data) {
          if (!is('Object', data) || data === {}) return null;
          return this.__dataEncoding(data).slice(0, -1);
        }

        L.Routing.Here = L.Class.extend({
          options: {
            serviceUrl: 'https://router.hereapi.com/v8/routes',
            apiKey: '',
            timeout: 30 * 1000,
            alternatives: 2,
            routingMode: 'fast',
            transportMode: 'car',
            generateMode: false,
            return: ['polyline','instructions','actions','summary'],
            urlParameters: {},
            avoid: {
              features: ''
            },
          },

          initialize: function(options) {
            L.Util.setOptions(this, options);
          },

          route: function(waypoints, callback, context, options) {
            var timedOut = false,
              wps = [],
              url,
              timer,
              wp,
              i;

            options = options || {};
            url = this.buildRouteUrl(waypoints, options);

            timer = setTimeout(function() {
              timedOut = true;
              callback.call(context || callback, {
                status: -1,
                message: 'Here request timed out.',
              });
            }, this.options.timeout);

            // Let reference here, problem when reverse geocoding point took to long, didnt have name here
            wps = waypoints;

            return corslite(url, L.bind(function(err, resp) {
              var data;

              clearTimeout(timer);
              if (!timedOut) {
                if (!err) {
                  data = JSON.parse(resp.responseText);
                  this._routeDone(data, wps, callback, context);
                } else {
                  callback.call(context || callback, {
                    status: -1,
                    message: 'HTTP request failed: ' + err,
                    type: err.type,
                  });
                }
              }
            }, this));
          },

          _routeDone: function (response, inputWaypoints, callback, context) {
            var alts = [],
              waypoints,
              waypoint,
              coordinates,
              i, j, k,
              instructions,
              distance,
              time,
              leg,
              maneuver,
              startingSearchIndex,
              instruction,
              path;

            context = context || callback;
            if (!response.routes) {
              callback.call(context, {
                // TODO: include all errors
                status: response.type,
                message: response.details
              });
              return;
            }

            for (i = 0; i < response.routes.length; i++) {
              path = response.routes[i];
              coordinates = [];
              startingSearchIndex = 0;

              instructions = [];
              time = 0;
              distance = 0;
              for (j = 0; j < path.sections.length; j++) {
                leg = path.sections[j];
                var latlongs = flexible.decode(leg.polyline).polyline;
                coordinates = coordinates.concat(latlongs);

                for (k = 0; k < leg.actions.length; k++) {
                  maneuver = leg.actions[k];
                  distance += leg.summary.length;
                  time += leg.summary.duration;
                  instruction = this._convertInstruction(maneuver, coordinates, startingSearchIndex);
                  instructions.push(instruction);
                  startingSearchIndex = instruction.index;
                }
              }

              waypoints = [];
              for (j = 0; j < baseWaypoints.length; j++) {
                waypoint = baseWaypoints[j];
                waypoints.push(new L.LatLng(
                  waypoint.latLng.lat,
                  waypoint.latLng.lng));
              }

              alts.push({
                name: '',
                coordinates: coordinates,
                instructions: instructions,
                summary: {
                  totalDistance: distance,
                  totalTime: time,
                },
                inputWaypoints: baseWaypoints,
                waypoints: waypoints
              });
            }

            callback.call(context, null, alts);
          },

          _decodeGeometry: function(geometry) {
            var latlngs = new Array(geometry.length),
              coord,
              i;
            for (i = 0; i < geometry.length; i++) {
              coord = geometry[i].split(',');
              latlngs[i] = ([parseFloat(coord[0]), parseFloat(coord[1])]);
            }

            return latlngs;
          },

          buildRouteUrl: function(waypoints, options) {
            var locs = [],
              i,
              alternatives,
              baseUrl;
            locs.push('origin=' + waypoints[0].latLng.lat + ',' + waypoints[0].latLng.lng);
            for (i = 1; i < waypoints.length-1; i++) {
              locs.push('via=' + waypoints[i].latLng.lat + ',' + waypoints[i].latLng.lng);
            }
            locs.push('destination=' + waypoints[waypoints.length-1].latLng.lat + ',' + waypoints[waypoints.length-1].latLng.lng);

            baseWaypoints = waypoints;

            alternatives = this.options.alternatives;
            baseUrl = this.options.serviceUrl + '?' + locs.join('&');

            const encoder = new DataEncoder();

            return baseUrl +
              encoder.encode(this.options.avoid) +
              L.Util.getParamString(L.extend({
              instructionFormat: 'text',
              apiKey: this.options.apiKey,
              representation: 'navigation',
              transportMode: this.options.transportMode,
              routingMode: this.options.routingMode,
              alternatives: alternatives,
              return: this.options.return,
            }, this._attachTruckRestrictions(this.options)), baseUrl);
          },

          _attachTruckRestrictions: function(options) {
            var _truckRestrictions = {};
            var allowedParameters = ['height', 'width', 'length', 'limitedWeight', 'weightPerAxle', 'shippedHazardousGoods', 'engineType', 'trailersCount'];

            if (!options.hasOwnProperty('routeRestriction')
              || !options.hasOwnProperty('truckRestriction')
              || !options.routeRestriction.hasOwnProperty('vehicleType')
              || options.routeRestriction.vehicleType !== 'truck') {
              return _truckRestrictions;
            }

            if (options.truckRestriction.hasOwnProperty('shippedHazardousGoods')) {
              if (Array.isArray(options.truckRestriction['shippedHazardousGoods'])) {
                options.truckRestriction['shippedHazardousGoods'] = options.truckRestriction['shippedHazardousGoods'].join();
              }
            }

            for (var property in options.truckRestriction) {
              if (!options.truckRestriction.hasOwnProperty(property)
                || allowedParameters.indexOf(property) === -1
                || options.truckRestriction[property] === ''
                || options.truckRestriction[property] === null) {
                continue;
              }

              var _value = options.truckRestriction[property];

              if (property === 'engineType') {
                property = 'vehicleType';
              }
              _truckRestrictions[property] = _value;
            }
            _truckRestrictions.truckType = 'truck';


            return _truckRestrictions;
          },

          _convertInstruction: function(instruction, coordinates, startingSearchIndex) {
            var i,
              distance,
              closestDistance = 0,
              closestIndex = -1,
              coordinate = instruction.offset;
            if (startingSearchIndex < 0) {
              startingSearchIndex = 0;
            }

            for (i = startingSearchIndex; i < coordinates.length; i++) {
              distance = haversine(coordinate, { latitude: coordinates[i][0], longitude: coordinates[i][1] });
              if (distance < closestDistance || closestIndex == -1) {
                closestDistance = distance;
                closestIndex = i;
              }
            }
            return {
              text: instruction.instruction,//text,
              distance: instruction.length,
              time: instruction.travelTime,
              index: closestIndex,
              type: instruction.action,
              road: instruction.roadName,
            };
          },
        });

        L.Routing.here = function(appId, appCode, options) {
          return new L.Routing.Here(appId, appCode, options);
        };

        module.exports = L.Routing.Here;
      })();

    }).call(this, typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : {});
  }, { 'corslite': 1, 'haversine': 2, 'flexible': 3 }],
}, {}, [4]);
