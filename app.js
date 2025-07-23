document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([-33.0472, -71.6127], 14); // Valparaíso, Chile

    // CAMBIO 1: Nuevo mapa base CartoDB Voyager
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    let locacionesLayerGroup = L.featureGroup().addTo(map);
    let sectoresLayerGroup = L.featureGroup().addTo(map);

    let allLocacionesData = []; // Mantendrá todos los datos de locaciones
    let allSectoresData = null; // Mantendrá todos los datos de sectores

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

    // Inicialización de la UI del menú
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

    // Funciones de carga de datos
    async function loadGeoJSONData() {
        try {
            const locacionesResponse = await fetch('data/locaciones_valparaiso.geojson');
            if (!locacionesResponse.ok) throw new Error('Error al cargar locaciones_valparaiso.geojson');
            allLocacionesData = await locacionesResponse.json();

            const sectoresResponse = await fetch('data/sectores_valparaiso.geojson');
            if (!sectoresResponse.ok) throw new Error('Error al cargar sectores_valparaiso.geojson');
            allSectoresData = await sectoresResponse.json();

            // Inicialmente, actualiza las opciones de todos los filtros y dibuja el mapa con todos los datos
            updateAllFilterOptionsAndMap();

        } catch (error) {
            console.error('Error al cargar los datos GeoJSON:', error);
            alert(`No se pudieron cargar los datos del mapa: ${error.message}. Asegúrate de que los archivos GeoJSON estén en la carpeta 'data/' y que los nombres de los archivos sean correctos.`);
        }
    }

    // Función para obtener años únicos para el filtro de fecha
    function getUniqueYears(features) {
        const years = new Set();
        features.forEach(f => {
            if (f.properties && f.properties.año_producción) {
                years.add(parseInt(f.properties.año_producción));
            }
        });
        return Array.from(years).filter(year => !isNaN(year)).sort((a, b) => a - b);
    }

    // Función para determinar qué opciones de rango de fecha son válidas
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

    // Función para obtener solo los sectores que tienen puntos de locación asociados
    function getSectorsWithPoints(locacionesFeatures, sectoresFeatures) {
        const sectorsWithPoints = new Set(locacionesFeatures.map(f => f.properties.sector).filter(Boolean));
        
        // Filtrar los sectores del GeoJSON de polígonos para incluir solo los que tienen puntos
        return sectoresFeatures.filter(f => {
            const sectorName = f.properties.Nombre_Cer || f.properties.name;
            return sectorsWithPoints.has(sectorName);
        }).map(f => f.properties.Nombre_Cer || f.properties.name).sort();
    }

    // Función para poblar un selector dado sus opciones y la selección actual
    function populateSelector(selectorElement, options, currentValue, defaultValue) {
        selectorElement.innerHTML = `<option value="${defaultValue}">${defaultValue.charAt(0).toUpperCase() + defaultValue.slice(1)}</option>`;
        options.forEach(optionValue => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            selectorElement.appendChild(option);
        });
        // Intentar restablecer la selección, si no es válida, ir al valor por defecto
        if (options.includes(currentValue) || currentValue === defaultValue) {
            selectorElement.value = currentValue;
        } else {
            selectorElement.value = defaultValue;
        }
    }

    // CAMBIO 3: Función central para actualizar las opciones de los filtros y el mapa
    function updateAllFilterOptionsAndMap() {
        const currentFechaSelection = fechaFilter.value;
        const currentPeliculaSelection = peliculaFilter.value;
        const currentSectorSelection = sectorFilter.value;

        // 1. Filtrar los datos base para obtener las locaciones que *podrían* ser mostradas
        // Basamos el filtrado para las opciones en las selecciones actuales
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

        // 2. Poblar los filtros con las opciones válidas basadas en los datos filtrados
        // Opciones de películas
        const peliculas = [...new Set(filteredForOptions.map(f => f.properties.nombre_peli))].filter(Boolean).sort();
        populateSelector(peliculaFilter, peliculas, currentPeliculaSelection, 'todas');

        // Opciones de años (rangos)
        const availableYears = getUniqueYears(filteredForOptions);
        const validFechaRanges = getValidFechaRanges(availableYears);
        
        // Reconstruir las opciones de fecha, mostrando solo las válidas
        fechaFilter.innerHTML = '<option value="todos">Todos</option>';
        if (validFechaRanges['antes1950']) fechaFilter.innerHTML += '<option value="antes1950">Antes de 1950</option>';
        if (validFechaRanges['1951-1973']) fechaFilter.innerHTML += '<option value="1951-1973">1951-1973</option>';
        if (validFechaRanges['1974-1990']) fechaFilter.innerHTML += '<option value="1974-1990">1974-1990</option>';
        if (validFechaRanges['1990-actualidad']) fechaFilter.innerHTML += '<option value="1990-actualidad">1990-Actualidad</option>';

        // Intentar restablecer la selección de fecha
        if (validFechaRanges[currentFechaSelection]) {
            fechaFilter.value = currentFechaSelection;
        } else {
            fechaFilter.value = 'todos';
        }
        
        // CAMBIO 2: Opciones de sectores (solo con puntos y existentes en los datos filtrados)
        const validSectorsForDropdown = getSectorsWithPoints(filteredForOptions, allSectoresData.features);
        populateSelector(sectorFilter, validSectorsForDropdown, currentSectorSelection, 'todos');
        
        // 3. Redibujar el mapa con los datos *actualmente filtrados*
        // Asegurarse de usar las selecciones más recientes después de la posible corrección de valores no válidos
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

        // Se pasa el sector seleccionado para el resaltado del polígono
        drawMap(featuresToDisplayOnMap, allSectoresData.features, finalSectorSelection);
    }

    // Función para dibujar/actualizar el mapa
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
        }).addTo(locacionesLayerGroup);
    }

    // Escuchadores de eventos para los filtros y botones
    fechaFilter.addEventListener('change', updateAllFilterOptionsAndMap);
    peliculaFilter.addEventListener('change', updateAllFilterOptionsAndMap);
    sectorFilter.addEventListener('change', updateAllFilterOptionsAndMap);

    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener('click', () => {
            // El mapa ya se actualiza automáticamente con cada cambio en el filtro.
            // Este botón solo cerrará el sidebar
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

            // Volver a actualizar las opciones de los filtros y dibujar el mapa
            updateAllFilterOptionsAndMap();

            // Cerrar el sidebar y el overlay
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    }

    // Funcionalidad de la modal "Acerca de"
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
