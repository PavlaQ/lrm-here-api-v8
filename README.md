# Leaflet Routing Machine / HERE API v8

Plugin do [Leaflet Routing Machine](https://github.com/perliedman/leaflet-routing-machine) z obsługą [HERE Routing API v8](https://developer.here.com/documentation/routing-api/dev_guide/index.html).

## Instalacja

```bash
npm install leaflet-routing-machine-here_v8
```

Lub dodaj bezpośrednio w HTML:

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
<script src="dist/lrm-here.js"></script>
```

## Szybki start

```javascript
var map = L.map('map').setView([52.0, 19.0], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

L.Routing.control({
    waypoints: [
        L.latLng(52.2297, 21.0122), // Warszawa
        L.latLng(50.0647, 19.9450)  // Krakow
    ],
    router: L.Routing.here({
        apiKey: 'TWOJ_HERE_API_KEY'
    })
}).addTo(map);
```

## Opcje

```javascript
L.Routing.here({
    // Wymagane
    apiKey: 'xxx',

    // Podstawowe
    transportMode: 'car',      // car, truck, pedestrian, bicycle, scooter
    routingMode: 'fast',       // fast, short
    language: 'pl-PL',         // pl-PL, en-US, de-DE, ...
    alternatives: 0,           // liczba alternatywnych tras (0-6)
    timeout: 30000,            // timeout w ms

    // Unikanie (soft constraint - stara sie unikac)
    avoidTolls: false,         // unikaj platnych drog
    avoidHighways: false,      // unikaj autostrad
    avoidFerries: false,       // unikaj promow

    // Wykluczenie krajow (hard constraint - trasa nigdy nie przejdzie)
    avoidCHE: false,           // wyklucz Szwajcarie

    // Zaawansowane avoid
    avoid: {
        features: [],          // tollRoad, controlledAccessHighway, ferry, tunnel, dirtRoad
        areas: [],             // ['bbox:west,south,east,north', 'polygon:...']
        segments: []           // array of segment IDs
    },

    // Zaawansowane exclude
    exclude: {
        countries: [],         // ['CHE', 'AUT', 'LIE'] - kody ISO 3166-1 alpha-3
        states: []             // kody stanow
    },

    // Opcje via points
    via: {
        passThrough: false,    // true = przejazd bez zatrzymania
        stopDuration: 0        // czas postoju w sekundach
    },

    // Parametry pojazdu
    vehicle: {
        speedCap: 27.78,       // limit predkosci w m/s (27.78 = 100 km/h)
        engineSizeCc: 125      // pojemnosc silnika w cc (dla scooter)
    },

    // Parametry skutera (tylko dla transportMode: 'scooter')
    scooter: {
        allowHighway: false    // pozwol na autostrady
    },

    // Parametry ciezarowki (tylko dla transportMode: 'truck')
    truck: {
        height: 4.0,           // wysokosc w metrach
        width: 2.5,            // szerokosc w metrach
        length: 16.5,          // dlugosc w metrach
        grossWeight: 40000,    // masa calkowita w kg
        weightPerAxle: 10000,  // masa na os w kg
        axleCount: 5,          // liczba osi
        trailerCount: 1,       // liczba przyczep
        type: 'straight',      // straight, tractor
        shippedHazardousGoods: [], // towary niebezpieczne
        tunnelCategory: 'B'    // kategoria tunelu
    }
})
```

## Development

### Wymagania

- Node.js 18+
- npm

### Instalacja zaleznosci

```bash
npm install
```

### Budowanie

```bash
# Kopiuje src do dist
npm run build

# Tworzy wersje minified
npm run build:min

# Obie operacje
npm run build:all
```

### Uruchomienie example

```bash
npm run serve
```

Otworz http://localhost:3000/examples/ w przegladarce.

Example pozwala testowac wszystkie opcje routingu:
- Definiowanie punktow trasy (waypoints)
- Wybor transportu i trybu
- Unikanie oplat, autostrad, promow
- Wykluczanie krajow (np. Szwajcarii)
- Opcje via points

### Struktura projektu

```
lrm-here-api-v8/
├── src/
│   └── L.Routing.Here.js    # kod zrodlowy
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

Klucz API mozesz uzyskac na [HERE Developer Portal](https://developer.here.com/).

1. Zaloz konto
2. Utworz projekt
3. Wygeneruj API Key

## Licencja

MIT
