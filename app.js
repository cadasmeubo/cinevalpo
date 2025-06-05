// Crear el mapa centrado en Valparaíso
const map = L.map('map').setView([-33.0458, -71.6197], 13);

// Capa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Función para determinar la década
function getDecada(anio) {
  if (anio < 1950) return 'Antes de 1950';
  if (anio < 1973) return '1950–1973';
  if (anio < 1990) return '1973–1990';
  return '1990–Actualidad';
}

// Función para asignar color según década
function getColor(decada) {
  switch (decada) {
    case 'Antes de 1950': return '#9E9E9E';
    case '1950–1973': return '#4CAF50';
    case '1973–1990': return '#FFC107';
    case '1990–Actualidad': return '#9C27B0';
    default: return '#2196F3';
  }
}

// Cargar archivo GeoJSON
fetch('data/locaciones_valparaiso.geojson')
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const decada = getDecada(feature.properties.año);
        return L.circleMarker(latlng, {
          radius: 6,
          fillColor: getColor(decada),
          color: '#333',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.9
        });
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const popupContent = `
          <strong>${props.nombre_peli} (${props.año})</strong><br>
          <em>${props.director}</em><br>
          <small>${props.genero}</small><br>
          <p>${props.nota_breve}</p>
          <img src="images/${props.imagen_asociada}" alt="fotograma" style="width:100%; max-width:250px; border-radius:4px;">
        `;
        layer.bindPopup(popupContent);
      }
    }).addTo(map);
  })
  .catch(err => console.error('Error al cargar GeoJSON:', err));
