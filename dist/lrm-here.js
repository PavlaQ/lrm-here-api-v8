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

	L.Routing.Here = L.Class.extend({
		options: {
			serviceUrl: 'https://router.hereapi.com/v8/routes',
			apiKey: '',
			timeout: 30 * 1000,
			alternatives: 0,
			routingMode: 'fast', // fast, short
			transportMode: 'car', // car, truck, pedestrian, bicycle, scooter
			language: 'pl-PL', // Language for instructions (e.g. en-US, de-DE)
			return: ['polyline', 'instructions', 'actions', 'summary'],

			// Convenience flags
			avoidTolls: false,
			avoidHighways: false,
			avoidFerries: false,
			avoidCHE: false, // Exclude Switzerland (uses exclude[countries])

			// Avoid - route tries to avoid but may use if necessary
			// https://www.here.com/docs/bundle/routing-api-v8-api-reference/page/index.html
			avoid: {
				features: [], // tollRoad, controlledAccessHighway, ferry, tunnel, dirtRoad, carShuttleTrain, difficultTurns
				areas: [],    // Array of 'bbox:west,south,east,north' or 'polygon:lat1,lng1,lat2,lng2,...'
				segments: [], // Array of segment IDs
				countries: [] // Array of ISO 3166-1 alpha-3 country codes (e.g., ['CHE', 'AUT']) - soft constraint
			},

			// Exclude - route will never use these (hard constraint)
			exclude: {
				countries: [], // Array of ISO 3166-1 alpha-3 country codes (e.g., ['CHE', 'AUT'])
				states: []     // Array of state codes
			},

			// Via options for waypoints
			via: {
				stopDuration: 0,      // Stop duration in seconds at via points
				passThrough: false    // If true, via points are pass-through (no stop)
			},

			// Vehicle parameters (for all transport modes)
			vehicle: {}, // speedCap, engineSizeCc

			// Scooter parameters
			scooter: {}, // allowHighway

			// Truck parameters (deprecated in v8, use vehicle instead for new params)
			truck: {} // height, width, length, grossWeight, weightPerAxle, axleCount, trailerCount, type, shippedHazardousGoods
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
			var viaOptions = this.options.via || {};

			// Origin
			params.push('origin=' + waypoints[0].latLng.lat + ',' + waypoints[0].latLng.lng);

			// Via points with options
			for (var i = 1; i < waypoints.length - 1; i++) {
				var viaParam = waypoints[i].latLng.lat + ',' + waypoints[i].latLng.lng;

				// Add via options
				var viaOpts = [];
				if (viaOptions.passThrough) {
					viaOpts.push('passThrough=true');
				}
				if (viaOptions.stopDuration > 0) {
					viaOpts.push('stopDuration=' + viaOptions.stopDuration);
				}

				if (viaOpts.length > 0) {
					viaParam += '!' + viaOpts.join('!');
				}

				params.push('via=' + viaParam);
			}

			// Destination
			params.push('destination=' + waypoints[waypoints.length - 1].latLng.lat + ',' + waypoints[waypoints.length - 1].latLng.lng);

			// Required params
			params.push('apiKey=' + encodeURIComponent(this.options.apiKey));
			params.push('transportMode=' + this.options.transportMode);
			params.push('routingMode=' + this.options.routingMode);
			params.push('return=' + this.options.return.join(','));

			// Language
			if (this.options.language) {
				params.push('lang=' + this.options.language);
			}

			// Alternatives
			if (this.options.alternatives > 0) {
				params.push('alternatives=' + this.options.alternatives);
			}

			// Avoid features
			var avoidFeatures = this._buildAvoidFeatures();
			if (avoidFeatures.length > 0) {
				params.push('avoid[features]=' + avoidFeatures.join(','));
			}

			// Avoid areas
			var avoidAreas = this._buildAvoidAreas();
			if (avoidAreas.length > 0) {
				params.push('avoid[areas]=' + avoidAreas.join('|'));
			}

			// Avoid segments
			if (this.options.avoid && this.options.avoid.segments && this.options.avoid.segments.length > 0) {
				params.push('avoid[segments]=' + this.options.avoid.segments.join(','));
			}

			// Avoid countries (soft constraint - tries to avoid but may use if necessary)
			var avoidCountries = this._buildAvoidCountries();
			if (avoidCountries.length > 0) {
				params.push('avoid[countries]=' + avoidCountries.join(','));
			}

			// Exclude countries
			var excludeCountries = this._buildExcludeCountries();
			if (excludeCountries.length > 0) {
				params.push('exclude[countries]=' + excludeCountries.join(','));
			}

			// Exclude states
			if (this.options.exclude && this.options.exclude.states && this.options.exclude.states.length > 0) {
				params.push('exclude[states]=' + this.options.exclude.states.join(','));
			}

			// Truck parameters
			if (this.options.transportMode === 'truck') {
				var truckParams = this._buildTruckParams();
				for (var key in truckParams) {
					if (truckParams.hasOwnProperty(key)) {
						params.push('truck[' + key + ']=' + encodeURIComponent(truckParams[key]));
					}
				}
			}

			// Vehicle parameters (for all transport modes)
			var vehicleParams = this._buildVehicleParams();
			for (var vKey in vehicleParams) {
				if (vehicleParams.hasOwnProperty(vKey)) {
					params.push('vehicle[' + vKey + ']=' + encodeURIComponent(vehicleParams[vKey]));
				}
			}

			// Scooter parameters
			if (this.options.transportMode === 'scooter') {
				var scooterParams = this._buildScooterParams();
				for (var sKey in scooterParams) {
					if (scooterParams.hasOwnProperty(sKey)) {
						params.push('scooter[' + sKey + ']=' + encodeURIComponent(scooterParams[sKey]));
					}
				}
			}

			return this.options.serviceUrl + '?' + params.join('&');
		},

		_buildAvoidFeatures: function () {
			var features = [];

			// Copy from avoid.features
			if (this.options.avoid && this.options.avoid.features) {
				features = features.concat(this.options.avoid.features);
			}

			// Convenience flags
			if (this.options.avoidTolls && features.indexOf('tollRoad') === -1) {
				features.push('tollRoad');
			}
			if (this.options.avoidHighways && features.indexOf('controlledAccessHighway') === -1) {
				features.push('controlledAccessHighway');
			}
			if (this.options.avoidFerries && features.indexOf('ferry') === -1) {
				features.push('ferry');
			}

			return features;
		},

		_buildAvoidAreas: function () {
			var areas = [];

			// Copy from avoid.areas
			if (this.options.avoid && this.options.avoid.areas) {
				areas = areas.concat(this.options.avoid.areas);
			}

			return areas;
		},

		_buildAvoidCountries: function () {
			var countries = [];

			// Copy from avoid.countries
			if (this.options.avoid && this.options.avoid.countries) {
				countries = countries.concat(this.options.avoid.countries);
			}

			return countries;
		},

		_buildExcludeCountries: function () {
			var countries = [];

			// Copy from exclude.countries
			if (this.options.exclude && this.options.exclude.countries) {
				countries = countries.concat(this.options.exclude.countries);
			}

			// Convenience flag for Switzerland
			if (this.options.avoidCHE && countries.indexOf('CHE') === -1) {
				countries.push('CHE');
			}

			return countries;
		},

		_buildTruckParams: function () {
			var truck = this.options.truck || {};
			var params = {};
			var allowedParams = [
				'height', 'width', 'length', 'grossWeight', 'weightPerAxle',
				'axleCount', 'trailerCount', 'type', 'shippedHazardousGoods',
				'tunnelCategory'
			];

			for (var key in truck) {
				if (truck.hasOwnProperty(key) && allowedParams.indexOf(key) !== -1) {
					params[key] = truck[key];
				}
			}

			return params;
		},

		_buildVehicleParams: function () {
			var vehicle = this.options.vehicle || {};
			var params = {};
			var allowedParams = [
				'speedCap',      // Speed limit in m/s (e.g., 27.78 = 100 km/h)
				'engineSizeCc'   // Engine size in cc (for scooter - <51cc = moped)
			];

			for (var key in vehicle) {
				if (vehicle.hasOwnProperty(key) && allowedParams.indexOf(key) !== -1) {
					params[key] = vehicle[key];
				}
			}

			return params;
		},

		_buildScooterParams: function () {
			var scooter = this.options.scooter || {};
			var params = {};
			var allowedParams = [
				'allowHighway'   // Allow scooter on highways (default: false)
			];

			for (var key in scooter) {
				if (scooter.hasOwnProperty(key) && allowedParams.indexOf(key) !== -1) {
					params[key] = scooter[key];
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
