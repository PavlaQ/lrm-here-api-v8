# Leaflet Routing Machine / HERE API v8

Plugin for [Leaflet Routing Machine](https://github.com/perliedman/leaflet-routing-machine) with support for [HERE Routing API v8](https://developer.here.com/documentation/routing-api/dev_guide/index.html).

## Installation

```bash
npm install leaflet-routing-machine-here_v8
```

Or include directly in HTML:

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
<script src="dist/lrm-here.js"></script>
```

## Quick Start

```javascript
var map = L.map('map').setView([52.0, 19.0], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

L.Routing.control({
    waypoints: [
        L.latLng(52.2297, 21.0122), // Warsaw
        L.latLng(50.0647, 19.9450)  // Krakow
    ],
    router: L.Routing.here({
        apiKey: 'YOUR_HERE_API_KEY'
    })
}).addTo(map);
```

## Options

```javascript
L.Routing.here({
    // Required
    apiKey: 'xxx',

    // Basic
    transportMode: 'car',      // car, truck, pedestrian, bicycle, scooter
    routingMode: 'fast',       // fast, short
    language: 'pl-PL',         // pl-PL, en-US, de-DE, ...
    alternatives: 0,           // number of alternative routes (0-6)
    timeout: 30000,            // timeout in ms

    // Avoid (soft constraint - tries to avoid)
    avoidTolls: false,         // avoid toll roads
    avoidHighways: false,      // avoid highways
    avoidFerries: false,       // avoid ferries

    // Exclude countries (hard constraint - route will never pass through)
    avoidCHE: false,           // exclude Switzerland

    // Advanced avoid
    avoid: {
        features: [],          // tollRoad, controlledAccessHighway, ferry, tunnel, dirtRoad
        areas: [],             // ['bbox:west,south,east,north', 'polygon:...']
        segments: []           // array of segment IDs
    },

    // Advanced exclude
    exclude: {
        countries: [],         // ['CHE', 'AUT', 'LIE'] - ISO 3166-1 alpha-3 codes
        states: []             // state codes
    },

    // Via point options
    via: {
        passThrough: false,    // true = pass through without stopping
        stopDuration: 0        // stop duration in seconds
    },

    // Vehicle parameters
    vehicle: {
        speedCap: 27.78,       // speed limit in m/s (27.78 = 100 km/h)
        engineSizeCc: 125      // engine size in cc (for scooter)
    },

    // Scooter parameters (only for transportMode: 'scooter')
    scooter: {
        allowHighway: false    // allow highways
    },

    // Truck parameters (only for transportMode: 'truck')
    truck: {
        height: 4.0,           // height in meters
        width: 2.5,            // width in meters
        length: 16.5,          // length in meters
        grossWeight: 40000,    // total weight in kg
        weightPerAxle: 10000,  // weight per axle in kg
        axleCount: 5,          // number of axles
        trailerCount: 1,       // number of trailers
        type: 'straight',      // straight, tractor
        shippedHazardousGoods: [], // hazardous goods
        tunnelCategory: 'B'    // tunnel category
    }
})
```

## Development

### Requirements

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Build

```bash
# Copy src to dist
npm run build

# Create minified version
npm run build:min

# Both operations
npm run build:all
```

### Run example

```bash
npm run serve
```

Open http://localhost:3000/examples/ in your browser.

The example allows testing all routing options:
- Define route waypoints
- Select transport mode and routing mode
- Avoid tolls, highways, ferries
- Exclude countries (e.g., Switzerland)
- Via point options

### Project structure

```
lrm-here-api-v8/
├── src/
│   └── L.Routing.Here.js    # source code
├── dist/
│   ├── lrm-here.js          # bundle
│   └── lrm-here.min.js      # minified
├── examples/
│   ├── index.html
│   ├── index.css
│   └── index.js
└── package.json
```

## HERE API Key

You can get an API key from [HERE Developer Portal](https://developer.here.com/).

1. Create an account
2. Create a project
3. Generate an API Key

## License

MIT
