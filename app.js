document.addEventListener('DOMContentLoaded', () => {
    // Se elimina la declaración de Maps_API_KEY
    // const Maps_API_KEY = 'TU_API_KEY_AQUI'; 

    const map = L.map('map').setView([-33.0472, -71.6127], 14); // Valparaíso, Chile

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    let locacionesLayerGroup = L.featureGroup().addTo(map);
    let sectoresLayerGroup = L.featureGroup().addTo(map);

    let allLocacionesData = [];
    let allSectoresData = null;

    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    const fechaFilter = document.getElementById('fecha-filter');
    const peliculaFilter = document.getElementById('pelicula-filter');
    const sectorFilter = document.getElementById('sector-filter');
    const aplicarFiltrosBtn = document.getElementById('aplicar-filtros');
    const resetFiltrosBtn = document.getElementById('reset-filters-btn');
    const acercaDeLink = document.getElementById('acerca-de-link');
    const aboutModal = document.getElementById('about-modal');
    const closeModalBtn = document.querySelector('.close-button');

    if (menuToggle && sidebar && overlay) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    } else {
        console.warn("Algunos elementos del menú (menuToggle, sidebar, overlay) no fueron encontrados.");
    }

    async function loadGeoJSONData() {
        try {
            const locacionesResponse = await fetch('data/locaciones_valparaiso.geojson');
            if (!locacionesResponse.ok) throw new Error('Error al cargar locaciones_valparaiso.geojson');
            allLocacionesData = await locacionesResponse.json();

            const sectoresResponse = await fetch('data/sectores_valparaiso.geojson');
            if (!sectoresResponse.ok) throw new Error('Error al cargar sectores_valparaiso.geojson');
            allSectoresData = await sectoresResponse.json();

            populateFilters(allLocacionesData.features, allSectoresData.features);
            // Al cargar inicialmente, no hay ningún sector seleccionado, por lo que pasamos 'todos'
            drawMap(allLocacionesData.features, allSectoresData.features, 'todos');

        } catch (error) {
            console.error('Error al cargar los datos GeoJSON:', error);
            alert(`No se pudieron cargar los datos del mapa: ${error.message}. Asegúrate de que los archivos GeoJSON estén en la carpeta 'data/' y que los nombres de los archivos sean correctos.`);
        }
    }

    function populateFilters(locacionesFeatures, sectoresFeatures) {
        const peliculas = [...new Set(locacionesFeatures.map(f => f.properties.nombre_peli))].filter(Boolean).sort();
        peliculaFilter.innerHTML = '<option value="todas">Todas</option>';
        peliculas.forEach(pelicula => {
            const option = document.createElement('option');
            option.value = pelicula;
            option.textContent = pelicula;
            peliculaFilter.appendChild(option);
        });

        // Asegurarse de usar "Nombre_Cer" para los sectores del GeoJSON de sectores
        const sectores = [...new Set(sectoresFeatures.map(f => f.properties.Nombre_Cer || f.properties.name))].filter(Boolean).sort();
        sectorFilter.innerHTML = '<option value="todos">Todos</option>';
        sectores.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });
    }

    // drawMap ahora acepta un tercer parámetro para el sector seleccionado
    function drawMap(locacionesFeatures, sectoresFeatures, currentSelectedSector) {
        locacionesLayerGroup.clearLayers();
        sectoresLayerGroup.clearLayers();

        L.geoJson(sectoresFeatures, {
            style: function (feature) {
                const sectorName = feature.properties.Nombre_Cer || feature.properties.name;
                const isSelected = currentSelectedSector !== 'todos' && sectorName === currentSelectedSector;
                return {
                    color: isSelected ? '#007bff' : '#ff7800', // Azul para seleccionado, naranja para otros
                    weight: isSelected ? 4 : 2, // Borde más grueso para seleccionado
                    opacity: 0.6,
                    fillOpacity: isSelected ? 0.3 : 0.1, // Relleno un poco más opaco para seleccionado
                    fillColor: isSelected ? '#007bff' : '#ff7800'
                };
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && (feature.properties.Nombre_Cer || feature.properties.name)) {
                    layer.bindPopup(`<h4>Sector: ${feature.properties.Nombre_Cer || feature.properties.name}</h4>`);
                }
            }
        }).addTo(sectoresLayerGroup);

        L.geoJson(locacionesFeatures, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng);
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.geometry && feature.geometry.coordinates) {
                    const props = feature.properties;
                    
                    const imageUrl = props.imagen_asociada && props.imagen_asociada.startsWith('http')
                                   ? props.imagen_asociada
                                   : `images/${props.imagen_asociada || 'no-image.jpg'}`;

                    const popupContent = `
                        <div class="popup-content">
                            <img src="${imageUrl}" alt="Imagen de la escena" class="popup-image" onerror="this.src='images/no-image.jpg';">
                            <h4>${props.nombre_peli || 'Sin Nombre'} (${props.año_producción || 'N/A'})</h4> <p><strong>Director:</strong> ${props.director || 'N/A'}</p>
                            <p><strong>Género:</strong> ${props.genero || 'N/A'}</p>
                            <p><strong>Nota Breve:</strong> ${props.nota_breve || 'Sin descripción'}</p>
                            <p><strong>Sector:</strong> ${props.sector || 'N/A'}</p>
                            
                            </div>
                    `;
                    layer.bindPopup(popupContent, {maxWidth: 400});
                }
            }
        }).addTo(locacionesLayerGroup);
    }

    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener('click', () => {
            const selectedFecha = fechaFilter.value;
            const selectedPelicula = peliculaFilter.value;
            const selectedSector = sectorFilter.value;

            const filteredLocacionesFeatures = allLocacionesData.features.filter(feature => {
                const props = feature.properties;
                const añoProduccion = parseInt(props.año_producción); // CAMBIO: props.año_producción
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

                let passesPeliculaFilter = true;
                if (selectedPelicula !== 'todas') {
                    passesPeliculaFilter = nombrePelicula === selectedPelicula;
                }

                let passesSectorFilter = true;
                if (selectedSector !== 'todos') {
                    passesSectorFilter = sectorPunto === selectedSector;
                }

                return passesFechaFilter && passesPeliculaFilter && passesSectorFilter;
            });

            // Pasar el sector seleccionado a drawMap
            drawMap(filteredLocacionesFeatures, allSectoresData.features, selectedSector);
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    }

    if (resetFiltrosBtn) {
        resetFiltrosBtn.addEventListener('click', () => {
            // Resetear los selectores a sus valores por defecto
            fechaFilter.value = 'todos';
            peliculaFilter.value = 'todas';
            sectorFilter.value = 'todos';

            // Volver a dibujar el mapa con todos los datos originales y sin sector resaltado
            drawMap(allLocacionesData.features, allSectoresData.features, 'todos');

            // Cerrar el sidebar y el overlay
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    }

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
        console.warn("Algunos elementos de la modal 'Acerca de' no fueron encontrados.");
    }

    loadGeoJSONData();
});
