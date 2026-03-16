(function () {
	'use strict';

	// Flexible Polyline decoder (HERE format)
	var flexiblePolyline = (function () {
		var DECODING_TABLE = [
			62, -1, -1, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1,
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
			22, 23, 24, 25, -1, -1, -1, -1, 63, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
			36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
		];

		function decodeChar(char) {
			return DECODING_TABLE[char.charCodeAt(0) - 45];
		}

		function decodeUnsignedValues(encoded) {
			var result = 0;
			var shift = 0;
			var resList = [];

			for (var i = 0; i < encoded.length; i++) {
				var value = decodeChar(encoded[i]);
				result |= (value & 0x1F) << shift;
				if ((value & 0x20) === 0) {
					resList.push(result);
					result = 0;
					shift = 0;
				} else {
					shift += 5;
				}
			}
			return resList;
		}

		function toSigned(val) {
			var res = val;
			if (res & 1) {
				res = ~res;
			}
			res >>= 1;
			return res;
		}

		return {
			decode: function (encoded) {
				var values = decodeUnsignedValues(encoded);
				var header = values[1];
				var precision = header & 15;
				var thirdDim = (header >> 4) & 7;
				var thirdDimPrecision = (header >> 7) & 15;

				var factorDegree = Math.pow(10, precision);
				var factorZ = Math.pow(10, thirdDimPrecision);

				var lastLat = 0, lastLng = 0, lastZ = 0;
				var res = [];
				var i = 2;

				while (i < values.length) {
					lastLat += toSigned(values[i]) / factorDegree;
					lastLng += toSigned(values[i + 1]) / factorDegree;

					if (thirdDim) {
						lastZ += toSigned(values[i + 2]) / factorZ;
						res.push([lastLat, lastLng, lastZ]);
						i += 3;
					} else {
						res.push([lastLat, lastLng]);
						i += 2;
					}
				}

				return { polyline: res };
			}
		};
	})();

	// Get Leaflet from global scope
	var L = window.L;
	if (!L) {
		throw new Error('Leaflet must be loaded before lrm-here');
	}

	L.Routing = L.Routing || {};

	function is(className, object) {
		return Object.prototype.toString.call(object) === '[object ' + className + ']';
	}

	// Encoder for nested URL parameters (e.g. avoid[features][0]=tollRoad)
	var DataEncoder = function () {
		this.levels = [];
		this.actualKey = null;
	};

	DataEncoder.prototype._encode = function (data) {
		var uriPart = '';
		var levelsSize = this.levels.length;
		if (levelsSize) {
			uriPart = this.levels[0];
			for (var c = 1; c < levelsSize; c++) {
				uriPart += '[' + this.levels[c] + ']';
			}
		}
		var finalString = '';
		if (is('Object', data)) {
			var keys = Object.keys(data);
			for (var a = 0; a < keys.length; a++) {
				var key = keys[a];
				this.actualKey = key;
				this.levels.push(this.actualKey);
				finalString += this._encode(data[key]);
			}
		} else if (is('Array', data)) {
			if (!this.actualKey) throw new Error('Directly passed array does not work');
			for (var b = 0; b < data.length; b++) {
				this.levels.push(b);
				finalString += this._encode(data[b]);
			}
		} else {
			finalString += uriPart + '=' + encodeURIComponent(data) + '&';
		}
		this.levels.pop();
		return finalString;
	};

	DataEncoder.prototype.encode = function (data) {
		if (!is('Object', data) || Object.keys(data).length === 0) return '';
		var encoded = this._encode(data);
		return encoded ? '&' + encoded.slice(0, -1) : '';
	};

	L.Routing.Here = L.Class.extend({
		options: {
			serviceUrl: 'https://router.hereapi.com/v8/routes',
			apiKey: '',
			timeout: 30 * 1000,
			alternatives: 0,
			routingMode: 'fast', // fast, short
			transportMode: 'car', // car, truck, pedestrian, bicycle, scooter
			return: ['polyline', 'instructions', 'actions', 'summary'],
			avoid: {
				features: [] // tollRoad, controlledAccessHighway, ferry, tunnel, dirtRoad
			},
			truck: {} // height, width, length, weight, axleCount, etc.
		},

		initialize: function (options) {
			L.Util.setOptions(this, options);
			if (!this.options.apiKey) {
				throw new Error('HERE API key is required');
			}
		},

		route: function (waypoints, callback, context, options) {
			var timedOut = false;
			var self = this;

			options = options || {};
			var url = this.buildRouteUrl(waypoints, options);

			var timer = setTimeout(function () {
				timedOut = true;
				callback.call(context || callback, {
					status: -1,
					message: 'HERE request timed out.'
				});
			}, this.options.timeout);

			var xhr = new XMLHttpRequest();
			xhr.open('GET', url, true);
			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					clearTimeout(timer);
					if (timedOut) return;

					if (xhr.status >= 200 && xhr.status < 300) {
						var data = JSON.parse(xhr.responseText);
						self._routeDone(data, waypoints, callback, context);
					} else {
						var error = xhr.responseText ? JSON.parse(xhr.responseText) : {};
						callback.call(context || callback, {
							status: xhr.status,
							message: error.title || 'HTTP request failed',
							details: error
						});
					}
				}
			};
			xhr.onerror = function () {
				clearTimeout(timer);
				if (!timedOut) {
					callback.call(context || callback, {
						status: -1,
						message: 'HTTP request failed'
					});
				}
			};
			xhr.send();

			return xhr;
		},

		_routeDone: function (response, inputWaypoints, callback, context) {
			var alts = [];
			context = context || callback;

			if (!response.routes || response.routes.length === 0) {
				callback.call(context, {
					status: response.status || 'NO_ROUTE',
					message: response.title || 'No route found'
				});
				return;
			}

			for (var i = 0; i < response.routes.length; i++) {
				var route = response.routes[i];
				var coordinates = [];
				var instructions = [];
				var totalDistance = 0;
				var totalTime = 0;
				var startingSearchIndex = 0;

				for (var j = 0; j < route.sections.length; j++) {
					var section = route.sections[j];

					// Decode polyline
					var decoded = flexiblePolyline.decode(section.polyline);
					coordinates = coordinates.concat(decoded.polyline);

					// Summary
					if (section.summary) {
						totalDistance += section.summary.length || 0;
						totalTime += section.summary.duration || 0;
					}

					// Instructions from actions
					if (section.actions) {
						for (var k = 0; k < section.actions.length; k++) {
							var action = section.actions[k];
							var instruction = this._convertInstruction(action, coordinates, startingSearchIndex);
							instructions.push(instruction);
							startingSearchIndex = instruction.index;
						}
					}
				}

				// Build waypoints from input
				var waypoints = [];
				for (var w = 0; w < inputWaypoints.length; w++) {
					waypoints.push(new L.LatLng(
						inputWaypoints[w].latLng.lat,
						inputWaypoints[w].latLng.lng
					));
				}

				alts.push({
					name: this._buildRouteName(route),
					coordinates: coordinates,
					instructions: instructions,
					summary: {
						totalDistance: totalDistance,
						totalTime: totalTime
					},
					inputWaypoints: inputWaypoints,
					waypoints: waypoints
				});
			}

			callback.call(context, null, alts);
		},

		_buildRouteName: function (route) {
			var names = [];
			if (route.sections) {
				for (var i = 0; i < route.sections.length; i++) {
					var section = route.sections[i];
					if (section.summary && section.summary.text) {
						names.push(section.summary.text);
					}
				}
			}
			return names.join(', ') || '';
		},

		buildRouteUrl: function (waypoints, options) {
			var params = [];

			// Origin
			params.push('origin=' + waypoints[0].latLng.lat + ',' + waypoints[0].latLng.lng);

			// Via points
			for (var i = 1; i < waypoints.length - 1; i++) {
				params.push('via=' + waypoints[i].latLng.lat + ',' + waypoints[i].latLng.lng);
			}

			// Destination
			params.push('destination=' + waypoints[waypoints.length - 1].latLng.lat + ',' + waypoints[waypoints.length - 1].latLng.lng);

			// Required params
			params.push('apiKey=' + encodeURIComponent(this.options.apiKey));
			params.push('transportMode=' + this.options.transportMode);
			params.push('routingMode=' + this.options.routingMode);
			params.push('return=' + this.options.return.join(','));

			// Alternatives
			if (this.options.alternatives > 0) {
				params.push('alternatives=' + this.options.alternatives);
			}

			// Avoid features
			var encoder = new DataEncoder();
			var avoidParams = this._buildAvoidParams();
			if (Object.keys(avoidParams).length > 0) {
				var avoidEncoded = encoder.encode({ avoid: avoidParams });
				if (avoidEncoded) {
					params.push(avoidEncoded.substring(1));
				}
			}

			// Truck parameters
			if (this.options.transportMode === 'truck') {
				var truckParams = this._buildTruckParams();
				var truckEncoded = encoder.encode({ truck: truckParams });
				if (truckEncoded) {
					params.push(truckEncoded.substring(1));
				}
			}

			return this.options.serviceUrl + '?' + params.join('&');
		},

		_buildAvoidParams: function () {
			var avoid = {};
			var features = this.options.avoid.features;

			if (features && features.length > 0) {
				avoid.features = features;
			}
			if (this.options.avoid.areas) {
				avoid.areas = this.options.avoid.areas;
			}

			return avoid;
		},

		_buildTruckParams: function () {
			var truck = this.options.truck || {};
			var params = {};
			var allowedParams = [
				'height', 'width', 'length', 'grossWeight', 'weightPerAxle',
				'axleCount', 'trailerCount', 'type', 'shippedHazardousGoods'
			];

			for (var key in truck) {
				if (truck.hasOwnProperty(key) && allowedParams.indexOf(key) !== -1) {
					params[key] = truck[key];
				}
			}

			return params;
		},

		_convertInstruction: function (action, coordinates, startingSearchIndex) {
			var closestIndex = startingSearchIndex;

			if (typeof action.offset === 'number' && action.offset < coordinates.length) {
				closestIndex = action.offset;
			} else if (startingSearchIndex < coordinates.length) {
				closestIndex = startingSearchIndex;
			}

			return {
				text: action.instruction || '',
				distance: action.length || 0,
				time: action.duration || 0,
				index: closestIndex,
				type: action.action || '',
				direction: action.direction || '',
				road: action.nextRoad ? action.nextRoad.name : ''
			};
		}
	});

	L.Routing.here = function (options) {
		return new L.Routing.Here(options);
	};

})();
