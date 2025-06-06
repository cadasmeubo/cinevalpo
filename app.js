document.addEventListener('DOMContentLoaded', () => {
    // *** IMPORTANTE: REEMPLAZA 'TU_API_KEY_AQUI' CON TU CLAVE DE API DE GOOGLE CLOUD ***
    const Maps_API_KEY = 'TU_API_KEY_AQUI'; // ¡No olvides reemplazar esto!
    // ********************************************************************************

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
            drawMap(allLocacionesData.features, allSectoresData.features);

        } catch (error) {
            console.error('Error al cargar los datos GeoJSON:', error);
            alert(`No se pudieron cargar los datos del mapa: ${error.message}. Asegúrate de que los archivos GeoJSON estén en la carpeta 'data/' y que los nombres de los archivos sean correctos.`);
        }
    }

    function populateFilters(locacionesFeatures, sectoresFeatures) {
        // Usa 'nombre_peli' en minúsculas
        const peliculas = [...new Set(locacionesFeatures.map(f => f.properties.nombre_peli))].filter(Boolean).sort();
        peliculaFilter.innerHTML = '<option value="todas">Todas</option>';
        peliculas.forEach(pelicula => {
            const option = document.createElement('option');
            option.value = pelicula;
            option.textContent = pelicula;
            peliculaFilter.appendChild(option);
        });

        const sectores = [...new Set(sectoresFeatures.map(f => f.properties.Nombre_Sector || f.properties.name))].filter(Boolean).sort();
        sectorFilter.innerHTML = '<option value="todos">Todos</option>';
        sectores.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });
    }

    function drawMap(locacionesFeatures, sectoresFeatures) {
        locacionesLayerGroup.clearLayers();
        sectoresLayerGroup.clearLayers();

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

        L.geoJson(locacionesFeatures, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng);
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.geometry && feature.geometry.coordinates) {
                    const props = feature.properties;
                    const coords = feature.geometry.coordinates; // [longitud, latitud]
                    const lat = coords[1];
                    const lng = coords[0];

                    // Si la imagen_asociada es una URL completa, úsala directamente
                    // Si es solo un nombre de archivo, prefieres 'images/' + nombre
                    const imageUrl = props.imagen_asociada && props.imagen_asociada.startsWith('http')
                                   ? props.imagen_asociada
                                   : `images/${props.imagen_asociada || 'no-image.jpg'}`;


                    // URL para incrustar Street View
                    const streetViewEmbedUrl = `https://www.google.com/maps/embed/v1/streetview?key=${Maps_API_KEY}&location=${lat},${lng}&heading=0&pitch=0&fov=90`; // Ajusta heading, pitch, fov si lo necesitas

                    const popupContent = `
                        <div class="popup-content">
                            <img src="${imageUrl}" alt="Imagen de la escena" class="popup-image" onerror="this.src='images/no-image.jpg';">
                            <h4>${props.nombre_peli || 'Sin Nombre'} (${props.año || 'N/A'})</h4>
                            <p><strong>Director:</strong> ${props.director || 'N/A'}</p>
                            <p><strong>Género:</strong> ${props.género || 'N/A'}</p>
                            <p><strong>Nota Breve:</strong> ${props.nota_breve || 'Sin descripción'}</p>
                            <p><strong>Sector:</strong> ${props.sector || 'N/A'}</p>
                            
                            <div class="street-view-container">
                                <iframe
                                    width="100%"
                                    height="200"
                                    frameborder="0"
                                    style="border:0"
                                    src="${streetViewEmbedUrl}"
                                    allowfullscreen
                                    loading="lazy"
                                    referrerpolicy="no-referrer-when-downgrade">
                                </iframe>
                            </div>
                            <small class="street-view-note">Vista panorámica de Street View (requiere API Key).</small>
                        </div>
                    `;
                    layer.bindPopup(popupContent, {maxWidth: 400}); // Ajusta el maxWidth del popup si es necesario
                }
            }
        }).addTo(locacionesLayerGroup);
    }

    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener('click', () => {
            const selectedFecha = fechaFilter.value;
            const selectedPelicula = peliculaFilter.value;
            const selectedSector = sectorFilter.value;

            const filteredFeatures = allLocacionesData.features.filter(feature => {
                const props = feature.properties;
                const añoProduccion = parseInt(props.año); // Usa 'props.año' ahora
                const nombrePelicula = props.nombre_peli; // Usa 'props.nombre_peli' ahora
                const sectorPunto = props.sector; // Usa 'props.sector' ahora

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

            drawMap(filteredFeatures, allSectoresData.features);
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
