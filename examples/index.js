(function () {
	var STORAGE_KEY = 'here_api_key';
	var map, routingControl;

	// Initialize map
	function initMap() {
		map = L.map('map').setView([52.0, 19.0], 6);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(map);
	}

	// Initialize routing with API key
	function initRouting(apiKey) {
		if (routingControl) {
			map.removeControl(routingControl);
		}

		routingControl = L.Routing.control({
			waypoints: [
				L.latLng(52.2297, 21.0122), // Warszawa
				L.latLng(50.0647, 19.9450)  // Kraków
			],
			router: L.Routing.here({
				apiKey: apiKey
			}),
			routeWhileDragging: true
		}).addTo(map);

		// Add control to show/change API key
		addApiKeyControl(apiKey);
	}

	// Add small control to show current key status
	function addApiKeyControl(apiKey) {
		var control = L.control({ position: 'bottomleft' });
		control.onAdd = function () {
			var div = L.DomUtil.create('div', 'api-key-control');
			var maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
			div.innerHTML = 'API Key: ' + maskedKey + '<button id="clear-key">Wyczysc</button>';
			L.DomEvent.disableClickPropagation(div);
			return div;
		};
		control.addTo(map);

		// Handle clear button
		setTimeout(function () {
			var clearBtn = document.getElementById('clear-key');
			if (clearBtn) {
				clearBtn.addEventListener('click', function () {
					sessionStorage.removeItem(STORAGE_KEY);
					location.reload();
				});
			}
		}, 0);
	}

	// Show API key form
	function showForm() {
		var form = document.getElementById('api-key-form');
		var input = document.getElementById('api-key-input');
		var button = document.getElementById('api-key-submit');

		form.classList.remove('hidden');
		input.focus();

		function submit() {
			var apiKey = input.value.trim();
			if (apiKey) {
				sessionStorage.setItem(STORAGE_KEY, apiKey);
				form.classList.add('hidden');
				initRouting(apiKey);
			}
		}

		button.addEventListener('click', submit);
		input.addEventListener('keypress', function (e) {
			if (e.key === 'Enter') submit();
		});
	}

	// Main
	initMap();

	var savedKey = sessionStorage.getItem(STORAGE_KEY);
	if (savedKey) {
		document.getElementById('api-key-form').classList.add('hidden');
		initRouting(savedKey);
	} else {
		showForm();
	}
})();
