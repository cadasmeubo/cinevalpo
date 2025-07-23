document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([-33.0472, -71.6127], 14);

    // Nuevo mapa base CartoDB Voyager (sin cambios)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
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
    const imageViewerOverlay = document.createElement('div');
    imageViewerOverlay.className = 'image-viewer-overlay';
    document.body.appendChild(imageViewerOverlay);

    // Inicialización de la UI del menú (sin cambios)
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

    // Funciones de carga de datos (sin cambios)
    async function loadGeoJSONData() {
        try {
            const locacionesResponse = await fetch('data/locaciones_valparaiso.geojson');
            if (!locacionesResponse.ok) throw new Error('Error al cargar locaciones_valparaiso.geojson');
            allLocacionesData = await locacionesResponse.json();

            const sectoresResponse = await fetch('data/sectores_valparaiso.geojson');
            if (!sectoresResponse.ok) throw new Error('Error al cargar sectores_valparaiso.geojson');
            allSectoresData = await sectoresResponse.json();

            updateAllFilterOptionsAndMap();

        } catch (error) {
            console.error('Error al cargar los datos GeoJSON:', error);
            alert(`No se pudieron cargar los datos del mapa: ${error.message}. Asegúrate de que los archivos GeoJSON estén en la carpeta 'data/' y que los nombres de los archivos sean correctos.`);
        }
    }

    // Funciones de filtrado y población de selectores (sin cambios importantes)
    function getUniqueYears(features) {
        const years = new Set();
        features.forEach(f => {
            if (f.properties && f.properties.año_producción) {
                years.add(parseInt(f.properties.año_producción));
            }
        });
        return Array.from(years).filter(year => !isNaN(year)).sort((a, b) => a - b);
    }

    function getValidFechaRanges(availableYears) {
        const validRanges = {
            'todos': true,
            'antes1950': false,
            '1951-1973': false,
            '1974-1990': false,
            '1990-actualidad': false
        };

        availableYears.forEach(year => {
            if (year < 1950) validRanges['antes1950'] = true;
            if (year >= 1951 && year <= 1973) validRanges['1951-1973'] = true;
            if (year >= 1974 && year <= 1990) validRanges['1974-1990'] = true;
            if (year >= 1990) validRanges['1990-actualidad'] = true;
        });

        return validRanges;
    }

    function getSectorsWithPoints(locacionesFeatures, sectoresFeatures) {
        const sectorsWithPoints = new Set(locacionesFeatures.map(f => f.properties.sector).filter(Boolean));
        return sectoresFeatures.filter(f => {
            const sectorName = f.properties.Nombre_Cer || f.properties.name;
            return sectorsWithPoints.has(sectorName);
        }).map(f => f.properties.Nombre_Cer || f.properties.name).sort();
    }

    function populateSelector(selectorElement, options, currentValue, defaultValue) {
        selectorElement.innerHTML = `<option value="${defaultValue}">${defaultValue.charAt(0).toUpperCase() + defaultValue.slice(1)}</option>`;
        options.forEach(optionValue => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            selectorElement.appendChild(option);
        });
        if (options.includes(currentValue) || currentValue === defaultValue) {
            selectorElement.value = currentValue;
        } else {
            selectorElement.value = defaultValue;
        }
    }

    function updateAllFilterOptionsAndMap() {
        const currentFechaSelection = fechaFilter.value;
        const currentPeliculaSelection = peliculaFilter.value;
        const currentSectorSelection = sectorFilter.value;

        let filteredForOptions = allLocacionesData.features.filter(feature => {
            const props = feature.properties;
            const añoProduccion = parseInt(props.año_producción);
            const nombrePelicula = props.nombre_peli;
            const sectorPunto = props.sector;

            let passesFecha = true;
            if (currentFechaSelection !== 'todos') {
                switch (currentFechaSelection) {
                    case 'antes1950': passesFecha = añoProduccion < 1950; break;
                    case '1951-1973': passesFecha = añoProduccion >= 1951 && añoProduccion <= 1973; break;
                    case '1974-1990': passesFecha = añoProduccion >= 1974 && añoProduccion <= 1990; break;
                    case '1990-actualidad': passesFecha = añoProduccion >= 1990; break;
                }
            }

            let passesPelicula = true;
            if (currentPeliculaSelection !== 'todas') {
                passesPelicula = nombrePelicula === currentPeliculaSelection;
            }

            let passesSector = true;
            if (currentSectorSelection !== 'todos') {
                passesSector = sectorPunto === currentSectorSelection;
            }

            return passesFecha && passesPelicula && passesSector;
        });

        const peliculas = [...new Set(filteredForOptions.map(f => f.properties.nombre_peli))].filter(Boolean).sort();
        populateSelector(peliculaFilter, peliculas, currentPeliculaSelection, 'todas');

        const availableYears = getUniqueYears(filteredForOptions);
        const validFechaRanges = getValidFechaRanges(availableYears);

        fechaFilter.innerHTML = '<option value="todos">Todos</option>';
        if (validFechaRanges['antes1950']) fechaFilter.innerHTML += '<option value="antes1950">Antes de 1950</option>';
        if (validFechaRanges['1951-1973']) fechaFilter.innerHTML += '<option value="1951-1973">1951-1973</option>';
        if (validFechaRanges['1974-1990']) fechaFilter.innerHTML += '<option value="1974-1990">1974-1990</option>';
        if (validFechaRanges['1990-actualidad']) fechaFilter.innerHTML += '<option value="1990-actualidad">1990-Actualidad</option>';

        // Se verifica si la selección actual de fecha sigue siendo válida
        if (validFechaRanges[currentFechaSelection]) {
            fechaFilter.value = currentFechaSelection;
        } else {
            fechaFilter.value = 'todos';
        }

        const validSectorsForDropdown = getSectorsWithPoints(filteredForOptions, allSectoresData.features);
        populateSelector(sectorFilter, validSectorsForDropdown, currentSectorSelection, 'todos');

        const finalFechaSelection = fechaFilter.value;
        const finalPeliculaSelection = peliculaFilter.value;
        const finalSectorSelection = sectorFilter.value;

        const featuresToDisplayOnMap = allLocacionesData.features.filter(feature => {
            const props = feature.properties;
            const añoProduccion = parseInt(props.año_producción);
            const nombrePelicula = props.nombre_peli;
            const sectorPunto = props.sector;

            let passesFechaFilter = true;
            if (finalFechaSelection !== 'todos') {
                switch (finalFechaSelection) {
                    case 'antes1950': passesFechaFilter = añoProduccion < 1950; break;
                    case '1951-1973': passesFechaFilter = añoProduccion >= 1951 && añoProduccion <= 1973; break;
                    case '1974-1990': passesFechaFilter = añoProduccion >= 1974 && añoProduccion <= 1990; break;
                    case '1990-actualidad': passesFechaFilter = añoProduccion >= 1990; break;
                }
            }

            let passesPeliculaFilter = true;
            if (finalPeliculaSelection !== 'todas') {
                passesPeliculaFilter = nombrePelicula === finalPeliculaSelection;
            }

            let passesSectorFilter = true;
            if (finalSectorSelection !== 'todos') {
                passesSectorFilter = sectorPunto === finalSectorSelection;
            }

            return passesFechaFilter && passesPeliculaFilter && passesSectorFilter;
        });

        drawMap(featuresToDisplayOnMap, allSectoresData.features, finalSectorSelection);
    }

    // Función para dibujar/actualizar el mapa (con cambio de marcador y evento para ampliar imagen)
    function drawMap(locacionesFeatures, sectoresFeatures, currentSelectedSector) {
        locacionesLayerGroup.clearLayers();
        sectoresLayerGroup.clearLayers();

        const sectorStyle = function (feature) {
            const sectorName = feature.properties.Nombre_Cer || feature.properties.name;
            const isSelected = currentSelectedSector !== 'todos' && sectorName === currentSelectedSector;
            return {
                color: isSelected ? '#38b6ff' : '#707076', // Activados: #38b6ff, Pasivos: #707076
                weight: isSelected ? 4 : 2,
                opacity: 0.6,
                fillOpacity: isSelected ? 0.3 : 0.1,
                fillColor: isSelected ? '#38b6ff' : '#707076'
            };
        };

        L.geoJson(sectoresFeatures, {
            style: sectorStyle,
            onEachFeature: function (feature, layer) {
                if (feature.properties && (feature.properties.Nombre_Cer || feature.properties.name)) {
                    layer.bindPopup(`<h4>Sector: ${feature.properties.Nombre_Cer || feature.properties.name}</h4>`);
                }
            }
        }).addTo(sectoresLayerGroup);

        // CAMBIO 3: Icono personalizado para los marcadores
        const locationIcon = L.icon({
            iconUrl: 'images/location_icon.png',
            iconSize: [32, 32], // Ajusta el tamaño si es necesario
            iconAnchor: [16, 32], // Ajusta el punto de anclaje para que la punta del icono esté en la ubicación
            popupAnchor: [0, -32] // Ajusta el punto donde se abre el popup relativo al icono
        });

        L.geoJson(locacionesFeatures, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng, {icon: locationIcon});
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.geometry && feature.geometry.coordinates) {
                    const props = feature.properties;

                    const imageUrl = props.imagen_asociada && props.imagen_asociada.startsWith('http')
                                   ? props.imagen_asociada
                                   : `images/${props.imagen_asociada || 'no-image.jpg'}`;

                    const popupContent = `
                        <div class="popup-content">
                            <img src="${imageUrl}" alt="Imagen de la escena" class="popup-image" onerror="this.src='images/no-image.jpg';" style="cursor: pointer;">
                            <h4>${props.nombre_peli || 'Sin Nombre'} (${props.año_producción || 'N/A'})</h4>
                            <p><strong>Director:</strong> ${props.director || 'N/A'}</p>
                            <p><strong>Género:</strong> ${props.genero || 'N/A'}</p>
                            <p><strong>Nota Breve:</strong> ${props.nota_breve || 'Sin descripción'}</p>
                            <p><strong>Sector:</strong> ${props.sector || 'N/A'}</p>
                        </div>
                    `;
                    layer.bindPopup(popupContent, {maxWidth: 400});

                    // CAMBIO 4: Evento para ampliar la imagen del popup
                    layer.on('popupopen', () => {
                        const popupImage = layer.getPopup().getElement()?.querySelector('.popup-image');
                        if (popupImage) {
                            popupImage.addEventListener('click', () => {
                                const img = document.createElement('img');
                                img.src = popupImage.src;
                                imageViewerOverlay.innerHTML = '';
                                imageViewerOverlay.appendChild(img);
                                imageViewerOverlay.style.display = 'flex'; // Muestra el overlay
                            });
                        }
                    });
                }
            }
        }).addTo(locacionesLayerGroup);
    }

    // Cerrar el visor de imágenes al hacer clic fuera de la imagen
    imageViewerOverlay.addEventListener('click', (event) => {
        if (event.target === imageViewerOverlay) { // Solo cierra si se hace clic en el fondo del overlay
            imageViewerOverlay.style.display = 'none';
        }
    });

    // Escuchadores de eventos para los filtros y botones (sin cambios)
    fechaFilter.addEventListener('change', updateAllFilterOptionsAndMap);
    peliculaFilter.addEventListener('change', updateAllFilterOptionsAndMap);
    sectorFilter.addEventListener('change', updateAllFilterOptionsAndMap);

    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    }

    if (resetFiltrosBtn) {
        resetFiltrosBtn.addEventListener('click', () => {
            fechaFilter.value = 'todos';
            peliculaFilter.value = 'todas';
            sectorFilter.value = 'todos';
            updateAllFilterOptionsAndMap();
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    }

    // Funcionalidad de la modal "Acerca de" (sin cambios)
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
