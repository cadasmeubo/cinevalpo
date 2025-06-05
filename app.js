const map = L.map("map").setView([-33.0458, -71.6197], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
}).addTo(map);

const geojsonData = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "titulo": "Escena 1",
        "descripcion": "Descripción breve.",
        "link": "https://ejemplo.com",
        "imagen": "https://i.imgur.com/jTQ58ZD.jpg",
        "pelicula": "Película A",
        "cerro": "Cerro Alegre",
        "anio": 2001
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-71.622, -33.045]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "titulo": "Escena 2",
        "descripcion": "Otra descripción.",
        "link": "https://ejemplo2.com",
        "imagen": "https://i.imgur.com/nqxFGPz.jpg",
        "pelicula": "Película B",
        "cerro": "Cerro Concepción",
        "anio": 2015
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-71.615, -33.046]
      }
    }
  ]
};

let markers = [];

function addMarkers(data) {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  data.features.forEach(feature => {
    const p = feature.properties;
    const coords = feature.geometry.coordinates.reverse();
    const popupContent = `
      <h3>${p.titulo}</h3>
      <img src="${p.imagen}" alt="${p.titulo}" />
      <p>${p.descripcion}</p>
      <a href="${p.link}" target="_blank">Ver más</a>
    `;

    const marker = L.marker(coords).addTo(map);
    marker.bindPopup(popupContent);
    markers.push(marker);
  });
}

function populateFilters(data) {
  const peliculas = new Set();
  const cerros = new Set();

  data.features.forEach(f => {
    peliculas.add(f.properties.pelicula);
    cerros.add(f.properties.cerro);
  });

  const peliSelect = document.getElementById("peliculaFilter");
  const cerroSelect = document.getElementById("cerroFilter");

  peliculas.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    peliSelect.appendChild(opt);
  });

  cerros.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    cerroSelect.appendChild(opt);
  });
}

function applyFilters() {
  const yearStart = parseInt(document.getElementById("yearStart").value);
  const yearEnd = parseInt(document.getElementById("yearEnd").value);
  const peli = document.getElementById("peliculaFilter").value;
  const cerro = document.getElementById("cerroFilter").value;

  const filtered = {
    type: "FeatureCollection",
    features: geojsonData.features.filter(f => {
      const p = f.properties;
      return (
        (!peli || p.pelicula === peli) &&
        (!cerro || p.cerro === cerro) &&
        p.anio >= yearStart &&
        p.anio <= yearEnd
      );
    })
  };

  addMarkers(filtered);
}

// Eventos
document.getElementById("yearStart").addEventListener("input", e => {
  document.getElementById("yearStartVal").textContent = e.target.value;
  applyFilters();
});

document.getElementById("yearEnd").addEventListener("input", e => {
  document.getElementById("yearEndVal").textContent = e.target.value;
  applyFilters();
});

document.getElementById("peliculaFilter").addEventListener("change", applyFilters);
document.getElementById("cerroFilter").addEventListener("change", applyFilters);

// Init
populateFilters(geojsonData);
addMarkers(geojsonData);
