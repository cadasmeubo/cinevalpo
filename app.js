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

            // Una vez cargados ambos, poblar los filtros y dibujar el mapa
            populateFilters(allLocacionesData.features, allSectoresData.features);
            drawMap(allLocacionesData.features, allSectoresData.features);

        } catch (error) {
            console.error('Error al cargar los datos GeoJSON:', error);
            alert(`No se pudieron cargar los datos del mapa: ${error.message}. Asegúrate de que los archivos GeoJSON estén en la carpeta 'data/' y que los nombres de los archivos sean correctos.`);
        }
    }

    // --- Poblar Selectores de Filtros ---
    function populateFilters(locacionesFeatures, sectoresFeatures) {
        // Películas
        // Se utiliza 'nombre_peli' de las propiedades de 'locaciones_valparaiso.geojson'
        const peliculas = [...new Set(locacionesFeatures.map(f => f.properties.nombre_peli))].filter(Boolean).sort();
        peliculaFilter.innerHTML = '<option value="todas">Todas</option>'; // Restablecer a "Todas"
        peliculas.forEach(pelicula => {
            const option = document.createElement('option');
            option.value = pelicula;
            option.textContent = pelicula;
            peliculaFilter.appendChild(option);
        });

        // Sectores
        // Se utiliza 'Nombre_Sector' (preferido) o 'name' de 'sectores_valparaiso.geojson'
        const sectores = [...new Set(sectoresFeatures.map(f => f.properties.Nombre_Sector || f.properties.name))].filter(Boolean).sort();
        sectorFilter.innerHTML = '<option value="todos">Todos</option>'; // Restablecer a "Todos"
        sectores.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });
    }

    // --- Dibujar Elementos en el Mapa ---
    function drawMap(locacionesFeatures, sectoresFeatures) {
        // Limpiar capas existentes antes de dibujar nuevas
        locacionesLayerGroup.clearLayers();
        sectoresLayerGroup.clearLayers();

        // Dibujar sectores
        L.geoJson(sectoresFeatures, {
            style: function (feature) {
                return {
                    color: '#ff7800', // Color del borde del sector
                    weight: 2,        // Grosor del borde
                    opacity: 0.6,     // Opacidad del borde
                    fillOpacity: 0.1, // Opacidad del relleno
                    fillColor: '#ff7800' // Color de relleno
                };
            },
            onEachFeature: function (feature, layer) {
                // Asegurarse de que el popup muestre el nombre del sector
                const sectorName = feature.properties.Nombre_Sector || feature.properties.name;
                if (sectorName) {
                    layer.bindPopup(`<h4>Sector: ${sectorName}</h4>`);
                }
            }
        }).addTo(sectoresLayerGroup); // Añadir al grupo de capas de sectores

        // Dibujar locaciones
        L.geoJson(locacionesFeatures, {
            pointToLayer: function (feature, latlng) {
                // Puedes personalizar el ícono del marcador aquí si lo deseas
                return L.marker(latlng);
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties) {
                    const props = feature.properties;
                    // Construir la URL de la imagen, manejando casos donde no haya imagen o sea una URL externa
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
                    layer.bindPopup(popupContent, {maxWidth: 400}); // Limitar el ancho del popup
                }
            }
        }).addTo(locacionesLayerGroup); // Añadir al grupo de capas de locaciones
    }

    // --- Lógica de Aplicación de Filtros ---
    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener('click', () => {
            const selectedFecha = fechaFilter.value;
            const selectedPelicula = peliculaFilter.value;
            const selectedSector = sectorFilter.value;

            // Filtrar las locaciones
            const filteredLocaciones = allLocacionesData.features.filter(feature => {
                const props = feature.properties;
                const añoProduccion = props.año_producción; // Usar 'año_producción' según tu estructura
                const nombrePelicula = props.nombre_peli;
                const sectorPunto = props.sector; // 'sector' para los puntos de locación

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

                const passesPeliculaFilter = (selectedPelicula === 'todas' || nombrePelicula === selectedPelicula);
                const passesSectorFilter = (selectedSector === 'todos' || sectorPunto === selectedSector);

                return passesFechaFilter && passesPeliculaFilter && passesSectorFilter;
            });

            // Re-dibujar solo las locaciones filtradas, manteniendo los sectores
            drawMap(filteredLocaciones, allSectoresData.features);

            // Cerrar la barra lateral después de aplicar los filtros
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    }

    // --- Manejo del Modal "Acerca de" ---
    if (acercaDeLink && aboutModal && closeModalBtn) {
        acercaDeLink.addEventListener('click', (e) => {
            e.preventDefault(); // Evita que el navegador navegue a '#'
            aboutModal.style.display = 'flex'; // Usamos 'flex' para centrar el contenido con CSS
        });

        closeModalBtn.addEventListener('click', () => {
            aboutModal.style.display = 'none';
        });

        // Cerrar el modal haciendo clic fuera de su contenido
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
