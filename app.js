document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización del Mapa
    const map = L.map('map').setView([-33.0472, -71.6127], 14); // Valparaíso, Chile
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    let locacionesLayerGroup = L.featureGroup().addTo(map); // Para los puntos de locaciones
    let sectoresLayerGroup = L.featureGroup().addTo(map);   // Para los polígonos de sectores
    let allLocacionesData = []; // Para almacenar todos los datos de locaciones
    let allSectoresData = null; // Para almacenar los datos de sectores una vez cargados

    // 2. Elementos del DOM
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

    // 3. Manejo del Menú Hamburguesa
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        menuToggle.classList.toggle('active'); // Para animar el icono
    });

    // Cerrar menú al hacer clic en el overlay
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
            allLocacionesData = await locacionesResponse.json();

            // Cargar sectores_valparaiso.geojson (polígonos)
            const sectoresResponse = await fetch('data/sectores_valparaiso.geojson');
            allSectoresData = await sectoresResponse.json();

            // Rellenar filtros y dibujar el mapa inicialmente
            populateFilters(allLocacionesData.features, allSectoresData.features);
            drawMap(allLocacionesData.features, allSectoresData.features);

        } catch (error) {
            console.error('Error al cargar los datos GeoJSON:', error);
            alert('No se pudieron cargar los datos del mapa. Inténtalo de nuevo más tarde.');
        }
    }

    // 5. Rellenar Filtros
    function populateFilters(locacionesFeatures, sectoresFeatures) {
        // Rellenar filtro de Películas
        const peliculas = [...new Set(locacionesFeatures.map(f => f.properties.Nombre_peli))].sort();
        peliculas.forEach(pelicula => {
            const option = document.createElement('option');
            option.value = pelicula;
            option.textContent = pelicula;
            peliculaFilter.appendChild(option);
        });

        // Rellenar filtro de Sectores
        const sectores = [...new Set(sectoresFeatures.map(f => f.properties.Nombre_Sector || f.properties.name))].sort(); // Asume 'Nombre_Sector' o 'name'
        sectores.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });
    }

    // 6. Dibujar Capas en el Mapa
    function drawMap(locacionesFeatures, sectoresFeatures) {
        // Limpiar capas existentes
        locacionesLayerGroup.clearLayers();
        sectoresLayerGroup.clearLayers();

        // Dibujar polígonos de sectores
        L.geoJson(sectoresFeatures, {
            style: function (feature) {
                return {
                    color: '#ff7800',
                    weight: 2,
                    opacity: 0.6,
                    fillOpacity: 0.1,
                    fillColor: '#ff7800'
                };
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && (feature.properties.Nombre_Sector || feature.properties.name)) {
                    layer.bindPopup(`<h4>Sector: ${feature.properties.Nombre_Sector || feature.properties.name}</h4>`);
                }
            }
        }).addTo(sectoresLayerGroup);


        // Dibujar puntos de locaciones
        L.geoJson(locacionesFeatures, {
            pointToLayer: function (feature, latlng) {
                // Puedes usar un icono personalizado si tienes uno
                // const customIcon = L.icon({
                //     iconUrl: 'images/movie-icon.png',
                //     iconSize: [32, 32],
                //     iconAnchor: [16, 32]
                // });
                // return L.marker(latlng, { icon: customIcon });
                return L.marker(latlng);
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties) {
                    const props = feature.properties;
                    const imageUrl = props.Imagen_asociada ? `images/${props.Imagen_asociada}` : 'images/no-image.jpg'; // Ruta por defecto si no hay imagen
                    const popupContent = `
                        <div class="popup-content">
                            <img src="${imageUrl}" alt="Imagen de la escena" class="popup-image">
                            <h4>${props.Nombre_peli || 'N/A'} (${props.Año_produccion || 'N/A'})</h4>
                            <p><strong>Director:</strong> ${props.Director || 'N/A'}</p>
                            <p><strong>Género:</strong> ${props.Género || 'N/A'}</p>
                            <p><strong>Año de Ambientación:</strong> ${props.Año_ambientacion || 'N/A'}</p>
                            <p><strong>Sector:</strong> ${props.Sector || 'N/A'}</p>
                            <p><strong>Nota Breve:</strong> ${props.Nota_breve || 'N/A'}</p>
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

            // Filtrar por Año de Producción
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
                }
            }

            // Filtrar por Película
            let passesPeliculaFilter = true;
            if (selectedPelicula !== 'todas') {
                passesPeliculaFilter = nombrePelicula === selectedPelicula;
            }

            // Filtrar por Sector (asume que el campo 'Sector' en el GeoJSON del punto coincide con el 'Nombre_Sector' o 'name' del GeoJSON de polígonos)
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
    acercaDeLink.addEventListener('click', (e) => {
        e.preventDefault(); // Evita que el enlace recargue la página
        aboutModal.style.display = 'flex'; // Usamos flex para centrar
    });

    closeModalBtn.addEventListener('click', () => {
        aboutModal.style.display = 'none';
    });

    // Cerrar modal al hacer clic fuera del contenido
    window.addEventListener('click', (event) => {
        if (event.target === aboutModal) {
            aboutModal.style.display = 'none';
        }
    });

    // Iniciar la carga de datos cuando el DOM esté listo
    loadGeoJSONData();
});
