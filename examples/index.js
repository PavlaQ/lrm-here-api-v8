(function () {
	var STORAGE_KEY = 'here_api_key';
	var map, routingControl, currentApiKey;
	var avoidAreasLayer = null; // Layer group for avoid areas visualization

	// DOM elements
	var elements = {
		form: null,
		panel: null,
		waypoints: null,
		transport: null,
		routingMode: null,
		language: null,
		avoidTolls: null,
		avoidHighways: null,
		avoidFerries: null,
		avoidCHE: null,
		excludeCountries: null,
		avoidCountries: null,
		avoidAreas: null,
		viaPassthrough: null,
		viaStop: null,
		routeInfo: null
	};

	function initElements() {
		elements.form = document.getElementById('api-key-form');
		elements.panel = document.getElementById('options-panel');
		elements.waypoints = document.getElementById('opt-waypoints');
		elements.transport = document.getElementById('opt-transport');
		elements.routingMode = document.getElementById('opt-routing-mode');
		elements.language = document.getElementById('opt-language');
		elements.avoidTolls = document.getElementById('opt-avoid-tolls');
		elements.avoidHighways = document.getElementById('opt-avoid-highways');
		elements.avoidFerries = document.getElementById('opt-avoid-ferries');
		elements.avoidCHE = document.getElementById('opt-avoid-che');
		elements.excludeCountries = document.getElementById('opt-exclude-countries');
		elements.avoidCountries = document.getElementById('opt-avoid-countries');
		elements.avoidAreas = document.getElementById('opt-avoid-areas');
		elements.viaPassthrough = document.getElementById('opt-via-passthrough');
		elements.viaStop = document.getElementById('opt-via-stop');
		elements.routeInfo = document.getElementById('route-info');
	}

	function parseWaypoints(text) {
		var lines = text.trim().split('\n');
		var waypoints = [];

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();
			if (!line) continue;

			var parts = line.split(',');
			if (parts.length >= 2) {
				var lat = parseFloat(parts[0].trim());
				var lng = parseFloat(parts[1].trim());
				if (!isNaN(lat) && !isNaN(lng)) {
					waypoints.push(L.latLng(lat, lng));
				}
			}
		}

		return waypoints;
	}

	function waypointsToText(waypoints) {
		return waypoints.map(function (wp) {
			if (wp.latLng) {
				return wp.latLng.lat.toFixed(4) + ',' + wp.latLng.lng.toFixed(4);
			} else if (wp.lat) {
				return wp.lat.toFixed(4) + ',' + wp.lng.toFixed(4);
			}
			return '';
		}).filter(function (line) {
			return line !== '';
		}).join('\n');
	}

	function drawAvoidAreas(areasArray) {
		// Remove previous layer
		if (avoidAreasLayer) {
			map.removeLayer(avoidAreasLayer);
		}

		if (!areasArray || areasArray.length === 0) {
			avoidAreasLayer = null;
			return;
		}

		var shapes = [];
		var style = {
			color: '#e74c3c',
			weight: 2,
			opacity: 0.8,
			fillColor: '#e74c3c',
			fillOpacity: 0.2
		};

		for (var i = 0; i < areasArray.length; i++) {
			var area = areasArray[i].trim();

			if (area.indexOf('bbox:') === 0) {
				// Parse bbox:west,south,east,north
				var bboxCoords = area.substring(5).split(',');
				if (bboxCoords.length === 4) {
					var west = parseFloat(bboxCoords[0]);
					var south = parseFloat(bboxCoords[1]);
					var east = parseFloat(bboxCoords[2]);
					var north = parseFloat(bboxCoords[3]);

					if (!isNaN(west) && !isNaN(south) && !isNaN(east) && !isNaN(north)) {
						var bounds = [[south, west], [north, east]];
						var rect = L.rectangle(bounds, style);
						shapes.push(rect);
					}
				}
			} else if (area.indexOf('polygon:') === 0) {
				// Parse polygon:lat1,lng1,lat2,lng2,...
				var polyCoords = area.substring(8).split(',');
				var latlngs = [];

				for (var j = 0; j < polyCoords.length - 1; j += 2) {
					var lat = parseFloat(polyCoords[j]);
					var lng = parseFloat(polyCoords[j + 1]);
					if (!isNaN(lat) && !isNaN(lng)) {
						latlngs.push([lat, lng]);
					}
				}

				if (latlngs.length >= 3) {
					var polygon = L.polygon(latlngs, style);
					shapes.push(polygon);
				}
			}
		}

		if (shapes.length > 0) {
			avoidAreasLayer = L.layerGroup(shapes).addTo(map);
		}
	}

	function initMap() {
		map = L.map('map').setView([47.5, 10.0], 6); // Centered for CH/AT testing

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
		}).addTo(map);
	}

	function getRoutingOptions() {
		var excludeCountries = [];
		var excludeInput = elements.excludeCountries.value.trim();
		if (excludeInput) {
			excludeCountries = excludeInput.split(',').map(function (c) {
				return c.trim().toUpperCase();
			});
		}

		var avoidCountries = [];
		var avoidCountriesInput = elements.avoidCountries.value.trim();
		if (avoidCountriesInput) {
			avoidCountries = avoidCountriesInput.split(',').map(function (c) {
				return c.trim().toUpperCase();
			});
		}

		var avoidAreas = [];
		var areasInput = elements.avoidAreas.value.trim();
		if (areasInput) {
			avoidAreas = areasInput.split('|').map(function (a) {
				return a.trim();
			});
		}

		return {
			apiKey: currentApiKey,
			transportMode: elements.transport.value,
			routingMode: elements.routingMode.value,
			language: elements.language.value,
			avoidTolls: elements.avoidTolls.checked,
			avoidHighways: elements.avoidHighways.checked,
			avoidFerries: elements.avoidFerries.checked,
			avoidCHE: elements.avoidCHE.checked,
			exclude: {
				countries: excludeCountries
			},
			avoid: {
				areas: avoidAreas,
				countries: avoidCountries
			},
			via: {
				passThrough: elements.viaPassthrough.checked,
				stopDuration: parseInt(elements.viaStop.value, 10) || 0
			}
		};
	}

	function initRouting(useTextarea) {
		var currentWaypoints;

		if (useTextarea !== false && elements.waypoints.value.trim()) {
			// Parse from textarea
			currentWaypoints = parseWaypoints(elements.waypoints.value);
		} else if (routingControl) {
			// Preserve waypoints from existing control
			currentWaypoints = routingControl.getWaypoints().filter(function (wp) {
				return wp.latLng;
			}).map(function (wp) {
				return wp.latLng;
			});
		} else {
			// Default waypoints
			currentWaypoints = [
				L.latLng(48.1351, 11.5820), // Monachium
				L.latLng(45.4642, 9.1900)   // Mediolan
			];
		}

		if (currentWaypoints.length < 2) {
			elements.routeInfo.innerHTML = '<span style="color:#e74c3c">Potrzeba min. 2 punktow</span>';
			return;
		}

		// Update textarea with current waypoints
		elements.waypoints.value = waypointsToText(currentWaypoints);

		if (routingControl) {
			map.removeControl(routingControl);
		}

		var options = getRoutingOptions();

		// Draw avoid areas on map
		drawAvoidAreas(options.avoid.areas);

		routingControl = L.Routing.control({
			waypoints: currentWaypoints,
			router: L.Routing.here(options),
			routeWhileDragging: false,
			showAlternatives: false
		}).addTo(map);

		routingControl.on('routesfound', function (e) {
			var route = e.routes[0];
			showRouteInfo(route, options);
		});

		routingControl.on('routingerror', function (e) {
			elements.routeInfo.innerHTML = '<span style="color:#e74c3c">Blad: ' + (e.error.message || 'Nie znaleziono trasy') + '</span>';
		});

		// Update textarea when waypoints change on map
		routingControl.on('waypointschanged', function (e) {
			elements.waypoints.value = waypointsToText(e.waypoints);
		});
	}

	function showRouteInfo(route, options) {
		var distance = (route.summary.totalDistance / 1000).toFixed(1);
		var time = Math.round(route.summary.totalTime / 60);
		var hours = Math.floor(time / 60);
		var minutes = time % 60;

		var activeOptions = [];
		if (options.avoidTolls) activeOptions.push('bez oplat');
		if (options.avoidHighways) activeOptions.push('bez autostrad');
		if (options.avoidFerries) activeOptions.push('bez promow');
		if (options.avoidCHE) activeOptions.push('bez CHE');
		if (options.exclude.countries.length > 0) {
			activeOptions.push('wyklucz: ' + options.exclude.countries.join(','));
		}
		if (options.avoid.countries && options.avoid.countries.length > 0) {
			activeOptions.push('unikaj: ' + options.avoid.countries.join(','));
		}

		var html = '<div><span class="label">Dystans:</span> <span class="value">' + distance + ' km</span></div>';
		html += '<div><span class="label">Czas:</span> <span class="value">' + hours + 'h ' + minutes + 'min</span></div>';
		html += '<div><span class="label">Transport:</span> <span class="value">' + options.transportMode + '</span></div>';
		html += '<div><span class="label">Tryb:</span> <span class="value">' + options.routingMode + '</span></div>';

		if (activeOptions.length > 0) {
			html += '<div><span class="label">Opcje:</span> <span class="value">' + activeOptions.join(', ') + '</span></div>';
		}

		elements.routeInfo.innerHTML = html;
	}

	function showPanel() {
		elements.panel.classList.remove('hidden');
	}

	function hidePanel() {
		elements.panel.classList.add('hidden');
	}

	function showForm() {
		var input = document.getElementById('api-key-input');
		var button = document.getElementById('api-key-submit');

		elements.form.classList.remove('hidden');
		input.focus();

		function submit() {
			var apiKey = input.value.trim();
			if (apiKey) {
				sessionStorage.setItem(STORAGE_KEY, apiKey);
				currentApiKey = apiKey;
				elements.form.classList.add('hidden');
				showPanel();
				initRouting(true); // Use textarea or defaults
			}
		}

		button.addEventListener('click', submit);
		input.addEventListener('keypress', function (e) {
			if (e.key === 'Enter') submit();
		});
	}

	function bindEvents() {
		document.getElementById('btn-recalculate').addEventListener('click', function () {
			initRouting(true); // Use textarea
		});

		document.getElementById('btn-clear-key').addEventListener('click', function () {
			sessionStorage.removeItem(STORAGE_KEY);
			location.reload();
		});

		// Auto-recalculate on checkbox change (preserve map waypoints)
		var checkboxes = [
			elements.avoidTolls,
			elements.avoidHighways,
			elements.avoidFerries,
			elements.avoidCHE,
			elements.viaPassthrough
		];

		checkboxes.forEach(function (cb) {
			cb.addEventListener('change', function () {
				initRouting(false); // Use current waypoints from control
			});
		});

		// Auto-recalculate on select change (preserve map waypoints)
		var selects = [elements.transport, elements.routingMode, elements.language];
		selects.forEach(function (sel) {
			sel.addEventListener('change', function () {
				initRouting(false); // Use current waypoints from control
			});
		});
	}

	// Main
	initElements();
	initMap();

	var savedKey = sessionStorage.getItem(STORAGE_KEY);
	if (savedKey) {
		currentApiKey = savedKey;
		elements.form.classList.add('hidden');
		showPanel();
		bindEvents();
		initRouting(true); // Use textarea or defaults
	} else {
		showForm();
		bindEvents();
	}
})();
