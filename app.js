// app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Variables Globales ---
    // Instancia del mapa Leaflet
    const map = L.map('map').setView([-33.0472, -71.6127], 14); // Coordenadas y zoom inicial para Valparaíso

    // Capa base de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Grupos de capas para gestionar marcadores y sectores de forma independiente
    let locacionesLayerGroup = L.featureGroup().addTo(map);
    let sectoresLayerGroup = L.featureGroup().addTo(map);

    // Variables para almacenar todos los datos GeoJSON una vez cargados
    let allLocacionesData = null; // Almacena el FeatureCollection de locaciones
    let allSectoresData = null;   // Almacena el FeatureCollection de sectores

    // Referencias a elementos del DOM
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    const fechaFilter = document.getElementById('fecha-filter');
    const peliculaFilter = document.getElementById('pelicula-filter');
    const sectorFilter = document.getElementById('sector-filter');
    const aplicarFiltrosBtn = document.getElementById('aplicar-filtros');
    const resetFiltrosBtn = document.getElementById('reset-filtros'); // Nuevo botón de reset
    const acercaDeLink = document.getElementById('acerca-de-link');
    const aboutModal = document.getElementById('about-modal');
    const closeModalBtn = document.querySelector('.close-button');

    // --- Manejo del Menú Lateral (Sidebar) ---
    if (menuToggle && sidebar && overlay) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            menuToggle.classList.toggle('active'); // Para la animación del icono hamburguesa
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    } else {
        console.warn("Algunos elementos del menú (menuToggle, sidebar, overlay) no fueron encontrados en el DOM.");
    }

    // --- Carga de Datos GeoJSON ---
    async function loadGeoJSONData() {
        try {
            // Cargar locaciones_valparaiso.geojson
            const locacionesResponse = await fetch('data/locaciones_valparaiso.geojson');
            if (!locacionesResponse.ok) throw new Error('Error al cargar data/locaciones_valparaiso.geojson');
            allLocacionesData = await locacionesResponse.json();

            // Cargar sectores_valparaiso.geojson
            const sectoresResponse = await fetch('data/sectores_valparaiso.geojson');
            if (!sectoresResponse.ok) throw new Error('Error al cargar data/sectores_valparaiso.geojson');
            allSectoresData = await sectoresResponse.json();

            // Una vez cargados ambos, poblar los filtros iniciales y dibujar el mapa
            populatePeliculaAndSectorFilters(allLocacionesData.features);
            drawMap(allLocacionesData.features); // Dibuja todas las locaciones y sectores
            
        } catch (error) {
            console.error('Error al cargar los datos GeoJSON:', error);
            alert(`No se pudieron cargar los datos del mapa: ${error.message}. Asegúrate de que los archivos GeoJSON estén en la carpeta 'data/' y que los nombres de los archivos sean correctos.`);
        }
    }

    // --- Función para poblar dinámicamente los selectores de Películas y Sectores ---
    function populatePeliculaAndSectorFilters(locacionesFeaturesToUse) {
        // Películas
        const peliculas = [...new Set(locacionesFeaturesToUse.map(f => f.properties.nombre_peli))].filter(Boolean).sort();
        const currentSelectedPelicula = peliculaFilter.value; // Guardar la selección actual
        peliculaFilter.innerHTML = '<option value="todas">Todas</option>';
        peliculas.forEach(pelicula => {
            const option = document.createElement('option');
            option.value = pelicula;
            option.textContent = pelicula;
            peliculaFilter.appendChild(option);
        });
        // Intentar restablecer la selección si todavía existe
        if (peliculas.includes(currentSelectedPelicula)) {
            peliculaFilter.value = currentSelectedPelicula;
        }


        // Sectores - EXTRAÍDOS DE LAS LOCACIONES como solicitado
        const sectorsFromLocaciones = [...new Set(locacionesFeaturesToUse.map(f => f.properties.sector))].filter(Boolean).sort();
        const currentSelectedSector = sectorFilter.value; // Guardar la selección actual
        sectorFilter.innerHTML = '<option value="todos">Todos</option>';
        sectorsFromLocaciones.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });
        // Intentar restablecer la selección si todavía existe
        if (sectorsFromLocaciones.includes(currentSelectedSector)) {
            sectorFilter.value = currentSelectedSector;
        }
    }

    // --- Obtener Locaciones Filtradas ---
    function getFilteredLocaciones() {
        if (!allLocacionesData) return []; // Asegurarse de que los datos estén cargados

        const selectedFecha = fechaFilter.value;
        const selectedPelicula = peliculaFilter.value;
        const selectedSector = sectorFilter.value;

        return allLocacionesData.features.filter(feature => {
            const props = feature.properties;
            const añoProduccion = props.año_producción;
            const nombrePelicula = props.nombre_peli;
            const sectorPunto = props.sector;

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
                        passesFechaFilter = true;
                }
            }

            const passesPeliculaFilter = (selectedPelicula === 'todas' || nombrePelicula === selectedPelicula);
            const passesSectorFilter = (selectedSector === 'todos' || sectorPunto === selectedSector);

            return passesFechaFilter && passesPeliculaFilter && passesSectorFilter;
        });
    }

    // --- Dibujar Elementos en el Mapa ---
    function drawMap(locacionesToDraw) {
        // Limpiar capas existentes antes de dibujar nuevas
        locacionesLayerGroup.clearLayers();
        sectoresLayerGroup.clearLayers();

        const selectedSectorFromFilter = sectorFilter.value; // Obtener el sector seleccionado para el resaltado

        // Dibujar sectores
        L.geoJson(allSectoresData, { // Usa allSectoresData para dibujar todos los polígonos de sectores
            style: function (feature) {
                const sectorNameFromPolygon = feature.properties.Nombre_Sector || feature.properties.name;
                // Resaltar el sector si coincide con el filtro y no es 'todos'
                const isSelected = (selectedSectorFromFilter !== 'todos' && sectorNameFromPolygon === selectedSectorFromFilter);
                return {
                    color: isSelected ? '#007bff' : '#ff7800', // Color azul para el resaltado, naranja por defecto
                    weight: isSelected ? 4 : 2,        // Borde más grueso para el resaltado
                    opacity: isSelected ? 0.9 : 0.6,     // Más opaco para el resaltado
                    fillOpacity: isSelected ? 0.3 : 0.1, // Relleno más denso para el resaltado
                    fillColor: isSelected ? '#007bff' : '#ff7800' // Color de relleno azul para el resaltado
                };
            },
            onEachFeature: function (feature, layer) {
                const sectorName = feature.properties.Nombre_Sector || feature.properties.name;
                if (sectorName) {
                    layer.bindPopup(`<h4>Sector: ${sectorName}</h4>`);
                }
            }
        }).addTo(sectoresLayerGroup); // Añadir al grupo de capas de sectores

        // Dibujar locaciones filtradas
        L.geoJson(locacionesToDraw, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng);
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties) {
                    const props = feature.properties;
                    const imageUrl = props.imagen_asociada 
                                     ? (props.imagen_asociada.startsWith('http') 
                                        ? props.imagen_asociada 
                                        : `images/${props.imagen_asociada}`)
                                     : 'images/no-image.jpg'; // Imagen por defecto si no hay

                    const popupContent = `
                        <div class="popup-content">
                            <img src="${imageUrl}" alt="Imagen de la escena" class="popup-image" onerror="this.src='images/no-image.jpg';">
                            <h4>${props.nombre_peli || 'Sin Nombre'} (${props.año_producción || 'N/A'})</h4>
                            <p><strong>Director:</strong> ${props.director || 'N/A'}</p>
                            <p><strong>Género:</strong> ${props.genero || 'N/A'}</p>
                            <p><strong>Nota Breve:</strong> ${props.nota_breve || 'Sin descripción'}</p>
                            <p><strong>Sector:</strong> ${props.sector || 'N/A'}</p>
                        </div>
                    `;
                    layer.bindPopup(popupContent, {maxWidth: 400});
                }
            }
        }).addTo(locacionesLayerGroup); // Añadir al grupo de capas de locaciones
    }

    // --- Event Listeners de Filtros ---

    // Manejar el botón "Aplicar Filtros"
    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener('click', () => {
            drawMap(getFilteredLocaciones());
            // Cerrar la barra lateral después de aplicar los filtros
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    }

    // Manejar el botón "Resetear Filtros"
    if (resetFiltrosBtn) {
        resetFiltrosBtn.addEventListener('click', () => {
            fechaFilter.value = 'todos'; // Restablecer el filtro de fecha
            peliculaFilter.value = 'todas'; // Restablecer el filtro de película
            sectorFilter.value = 'todos'; // Restablecer el filtro de sector

            // Volver a poblar los filtros con todas las opciones
            populatePeliculaAndSectorFilters(allLocacionesData.features);
            
            // Dibujar el mapa con todos los datos sin filtrar
            drawMap(allLocacionesData.features);

            // Cerrar la barra lateral
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    }

    // Manejar cambios en el filtro de Fecha
    if (fechaFilter) {
        fechaFilter.addEventListener('change', () => {
            // Filtrar locaciones solo por la fecha seleccionada para actualizar los otros selectores
            const selectedFecha = fechaFilter.value;
            let locacionesFilteredByDate = allLocacionesData.features;
            if (selectedFecha !== 'todos') {
                locacionesFilteredByDate = allLocacionesData.features.filter(feature => {
                    const añoProduccion = feature.properties.año_producción;
                    switch (selectedFecha) {
                        case 'antes1950': return añoProduccion < 1950;
                        case '1951-1973': return añoProduccion >= 1951 && añoProduccion <= 1973;
                        case '1974-1990': return añoProduccion >= 1974 && añoProduccion <= 1990;
                        case '1990-actualidad': return añoProduccion >= 1990;
                        default: return true;
                    }
                });
            }
            populatePeliculaAndSectorFilters(locacionesFilteredByDate); // Actualiza opciones de película y sector
            peliculaFilter.value = 'todas'; // Resetear selección de película al cambiar la fecha
            sectorFilter.value = 'todos'; // Resetear selección de sector al cambiar la fecha
            drawMap(getFilteredLocaciones()); // Redibujar el mapa con los filtros actuales
        });
    }

    // Manejar cambios en el filtro de Película (solo redibuja el mapa)
    if (peliculaFilter) {
        peliculaFilter.addEventListener('change', () => {
            drawMap(getFilteredLocaciones());
        });
    }

    // Manejar cambios en el filtro de Sector (solo redibuja el mapa y resalta el sector)
    if (sectorFilter) {
        sectorFilter.addEventListener('change', () => {
            drawMap(getFilteredLocaciones());
        });
    }

    // --- Manejo del Modal "Acerca de" ---
    if (acercaDeLink && aboutModal && closeModalBtn) {
        acercaDeLink.addEventListener('click', (e) => {
            e.preventDefault();
            aboutModal.style.display = 'flex';
        });

        closeModalBtn.addEventListener('click', () => {
            aboutModal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === aboutModal) {
                aboutModal.style.display = 'none';
            }
        });
    } else {
        console.warn("Algunos elementos de la modal 'Acerca de' (acercaDeLink, aboutModal, closeModalBtn) no fueron encontrados en el DOM.");
    }

    // --- Iniciar la Carga de Datos al cargar la página ---
    loadGeoJSONData();
});
