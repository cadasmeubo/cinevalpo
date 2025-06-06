document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización del Mapa Leaflet
    const map = L.map('map').setView([-33.0472, -71.6127], 14); // Valparaíso, Chile

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    let locacionesLayerGroup = L.featureGroup().addTo(map); // Grupo para los puntos de locaciones
    let sectoresLayerGroup = L.featureGroup().addTo(map);   // Grupo para los polígonos de sectores

    let allLocacionesData = []; // Para almacenar todos los datos de locaciones
    let allSectoresData = null; // Para almacenar los datos de sectores una vez cargados

    // 2. Selección de Elementos del DOM
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    const fechaFilter = document.getElementById('fecha-filter');
    const peliculaFilter = document.getElementById('pelicula-filter');
    const sectorFilter = document.getElementById('sector-filter');
    const aplicarFiltrosBtn = document.getElementById('aplicar-filtros');
    const acercaDeLink = document.getElementById('acerca-de-link');
    const aboutModal = document.getElementById('about-modal');
    const closeModalBtn = document.querySelector('.close-button');

    // 3. Manejo del Menú Hamburguesa y Overlay
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        menuToggle.classList.toggle('active'); // Para animar el icono de hamburguesa
    });

    // Cerrar menú al hacer clic en el overlay (fuera del sidebar)
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        menuToggle.classList.remove('active');
    });

    // 4. Carga de Datos GeoJSON
    async function loadGeoJSONData() {
        try {
            // Cargar locaciones_valparaiso.geojson (puntos)
            const locacionesResponse = await fetch('data/locaciones_valparaiso.geojson');
            if (!locacionesResponse.ok) throw new Error('Error al cargar locaciones_valparaiso.geojson');
            allLocacionesData = await locacionesResponse.json();

            // Cargar sectores_valparaiso.geojson (polígonos)
            const sectoresResponse = await fetch('data/sectores_valparaiso.geojson');
            if (!sectoresResponse.ok) throw new Error('Error al cargar sectores_valparaiso.geojson');
            allSectoresData = await sectoresResponse.json();

            // Una vez cargados los datos, rellenar filtros y dibujar el mapa
            populateFilters(allLocacionesData.features, allSectoresData.features);
            drawMap(allLocacionesData.features, allSectoresData.features);

        } catch (error) {
            console.error('Error al cargar los datos GeoJSON:', error);
            alert(`No se pudieron cargar los datos del mapa: ${error.message}. Asegúrate de que los archivos GeoJSON estén en la carpeta 'data/'.`);
        }
    }

    // 5. Rellenar Filtros Desplegables
    function populateFilters(locacionesFeatures, sectoresFeatures) {
        // Rellenar filtro de Películas
        const peliculas = [...new Set(locacionesFeatures.map(f => f.properties.Nombre_peli))].filter(Boolean).sort(); // filter(Boolean) para eliminar undefined/null
        peliculaFilter.innerHTML = '<option value="todas">Todas</option>'; // Reiniciar opciones
        peliculas.forEach(pelicula => {
            const option = document.createElement('option');
            option.value = pelicula;
            option.textContent = pelicula;
            peliculaFilter.appendChild(option);
        });

        // Rellenar filtro de Sectores
        const sectores = [...new Set(sectoresFeatures.map(f => f.properties.Nombre_Sector || f.properties.name))].filter(Boolean).sort(); // Asume 'Nombre_Sector' o 'name'
        sectorFilter.innerHTML = '<option value="todos">Todos</option>'; // Reiniciar opciones
        sectores.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });
    }

    // 6. Dibujar Capas en el Mapa (Puntos y Polígonos)
    function drawMap(locacionesFeatures, sectoresFeatures) {
        // Limpiar capas existentes antes de dibujar nuevas
        locacionesLayerGroup.clearLayers();
        sectoresLayerGroup.clearLayers();

        // Dibujar polígonos de sectores
        L.geoJson(sectoresFeatures, {
            style: function (feature) {
                return {
                    color: '#ff7800', // Color del borde
                    weight: 2,
                    opacity: 0.6,
                    fillOpacity: 0.1,
                    fillColor: '#ff7800' // Color de relleno
                };
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && (feature.properties.Nombre_Sector || feature.properties.name)) {
                    layer.bindPopup(`<h4>Sector: ${feature.properties.Nombre_Sector || feature.properties.name}</h4>`);
                }
            }
        }).addTo(sectoresLayerGroup);


        // Dibujar puntos de locaciones cinematográficas
        L.geoJson(locacionesFeatures, {
            pointToLayer: function (feature, latlng) {
                // Puedes usar un icono personalizado si tienes uno en 'images/movie-icon.png'
                // const customIcon = L.icon({
                //     iconUrl: 'images/movie-icon.png',
                //     iconSize: [32, 32],
                //     iconAnchor: [16, 32]
                // });
                // return L.marker(latlng, { icon: customIcon });
                return L.marker(latlng); // Marcador por defecto de Leaflet
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties) {
                    const props = feature.properties;
                    // Construir la URL de la imagen. Usa 'no-image.jpg' si no se especifica
                    const imageUrl = props.Imagen_asociada ? `images/${props.Imagen_asociada}` : 'images/no-image.jpg';

                    const popupContent = `
                        <div class="popup-content">
                            <img src="${imageUrl}" alt="Imagen de la escena" class="popup-image" onerror="this.src='images/no-image.jpg';">
                            <h4>${props.Nombre_peli || 'Sin Nombre'} (${props.Año_produccion || 'N/A'})</h4>
                            <p><strong>Director:</strong> ${props.Director || 'N/A'}</p>
                            <p><strong>Género:</strong> ${props.Género || 'N/A'}</p>
                            <p><strong>Año de Ambientación:</strong> ${props.Año_ambientacion || 'N/A'}</p>
                            <p><strong>Sector:</strong> ${props.Sector || 'N/A'}</p>
                            <p><strong>Nota Breve:</strong> ${props.Nota_breve || 'Sin descripción'}</p>
                        </div>
                    `;
                    layer.bindPopup(popupContent);
                }
            }
        }).addTo(locacionesLayerGroup);
    }

    // 7. Lógica de Aplicación de Filtros
    aplicarFiltrosBtn.addEventListener('click', () => {
        const selectedFecha = fechaFilter.value;
        const selectedPelicula = peliculaFilter.value;
        const selectedSector = sectorFilter.value;

        const filteredFeatures = allLocacionesData.features.filter(feature => {
            const props = feature.properties;
            const añoProduccion = parseInt(props.Año_produccion);
            const nombrePelicula = props.Nombre_peli;
            const sectorPunto = props.Sector; // Asume que el punto tiene un campo 'Sector'

            // Filtrar por Año de Producción (rangos)
            let passesFechaFilter = true;
            if (selectedFecha !== 'todos') {
                switch (selectedFecha) {
                    case 'antes1950':
                        passesFechaFilter = añoProduccion < 1950;
                        break;
                    case '1951-1973':
                        passesFechaFilter = añoProduccion >= 1951 && añoProduccion <= 1973;
                        break;
                    case '1974-1990':
                        passesFechaFilter = añoProduccion >= 1974 && añoProduccion <= 1990;
                        break;
                    case '1990-actualidad':
                        passesFechaFilter = añoProduccion >= 1990;
                        break;
                    default:
                        passesFechaFilter = true; // Por si hay un valor inesperado
                }
            }

            // Filtrar por Película
            let passesPeliculaFilter = true;
            if (selectedPelicula !== 'todas') {
                passesPeliculaFilter = nombrePelicula === selectedPelicula;
            }

            // Filtrar por Sector
            let passesSectorFilter = true;
            if (selectedSector !== 'todos') {
                passesSectorFilter = sectorPunto === selectedSector;
            }

            return passesFechaFilter && passesPeliculaFilter && passesSectorFilter;
        });

        // Volver a dibujar el mapa con los puntos filtrados
        drawMap(filteredFeatures, allSectoresData.features);
        // Opcional: Cerrar el menú lateral después de aplicar filtros
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        menuToggle.classList.remove('active');
    });

    // 8. Manejo de la Ventana Modal "Acerca de"
    if (acercaDeLink) {
        acercaDeLink.addEventListener('click', (e) => {
            e.preventDefault(); // Evita que el enlace recargue la página
            aboutModal.style.display = 'flex'; // Usamos 'flex' para centrar la modal
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            aboutModal.style.display = 'none';
        });
    }

    // Cerrar modal al hacer clic fuera del contenido del modal
    window.addEventListener('click', (event) => {
        if (event.target === aboutModal) { // Si el clic fue directamente en el fondo del modal (no en su contenido)
            aboutModal.style.display = 'none';
        }
    });

    // Iniciar la carga de datos cuando el DOM esté completamente listo
    loadGeoJSONData();
});
