document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map', {
        zoomControl: false // Deshabilita el control de zoom predeterminado de Leaflet
    }).setView([-33.0472, -71.6127], 14); // Inicialmente Valparaíso, pero se ajustará

    // Nuevo mapa base CartoDB Voyager
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    let sectoresLayerGroup = L.featureGroup().addTo(map);
    // Declarar el grupo de clusters para las locaciones y personalizar su apariencia
    let markers = new L.markerClusterGroup({
        iconCreateFunction: function (cluster) {
            const childCount = cluster.getChildCount();
            let size = 'small'; // Clase CSS por defecto

            // Determinar el tamaño del cluster basado en el número de marcadores
            if (childCount < 10) {
                size = 'small';
            } else if (childCount < 100) {
                size = 'medium';
            } else {
                size = 'large';
            }

            // Aquí generamos el HTML para el icono del cluster.
            // Los colores de fondo específicos para cada tamaño se definirán en style.css
            // Esto permite una mayor flexibilidad de diseño en el CSS.
            return L.divIcon({
                html: `<span>${childCount}</span>`,
                className: `marker-cluster marker-cluster-${size}`,
                iconSize: [40, 40] // Este es el tamaño base del divIcon. El span interno se autoajusta.
            });
        },
        // Opciones de animación para los popups al abrirse desde el cluster
        // Esto ayudará a que la animación de zoom del popup se vea más natural
        // al interactuar con los clusters.
        chunkedLoading: true, // Carga optimizada para grandes conjuntos de datos
        // Configuración de animaciones para los popups (si no se especifica, usa por defecto)
        // Puedes añadir aquí opciones como 'disableClusteringAtZoom' si quieres que en ciertos zooms no haya clusters
    });
    map.addLayer(markers); // Añadir el grupo de clusters al mapa

    let allLocacionesData = [];
    let allSectoresData = null;

    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    const fechaFilter = document.getElementById('fecha-filter');
    const peliculaFilter = document.getElementById('pelicula-filter');
    const sectorFilter = document.getElementById('sector-filter');
    const resetFiltrosBtn = document.getElementById('reset-filters-btn');
    const acercaDeLink = document.getElementById('acerca-de-link');
    const aboutModal = document.getElementById('about-modal');
    const closeModalBtn = document.querySelector('.close-button');
    const imageViewerOverlay = document.createElement('div');
    imageViewerOverlay.className = 'image-viewer-overlay';
    document.body.appendChild(imageViewerOverlay);

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

    async function loadGeoJSONData() {
        try {
            const locacionesResponse = await fetch('data/locaciones_valparaiso.geojson');
            if (!locacionesResponse.ok) throw new Error('Error al cargar locaciones_valparaiso.geojson');
            allLocacionesData = await locacionesResponse.json();

            const sectoresResponse = await fetch('data/sectores_valparaiso.geojson');
            if (!sectoresResponse.ok) throw new Error('Error al cargar sectores_valparaiso.geojson');
            allSectoresData = await sectoresResponse.json();

            updateAllFilterOptionsAndMap();
            // Centrar el mapa en todos los puntos al inicio
            if (allLocacionesData.features.length > 0) {
                const allCoords = allLocacionesData.features.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
                const bounds = L.latLngBounds(allCoords);
                map.fitBounds(bounds);
            }

        } catch (error) {
            console.error('Error al cargar los datos GeoJSON:', error);
            alert(`No se pudieron cargar los datos del mapa: ${error.message}. Asegúrate de que los archivos GeoJSON estén en la carpeta 'data/' y que los nombres de los archivos sean correctos.`);
        }
    }

    // Helper para filtrar características basado en filtros dados
    function filterFeatures(features, fechaVal, peliculaVal, sectorVal) {
        return features.filter(feature => {
            const props = feature.properties;
            const añoProduccion = parseInt(props.año_producción);
            const nombrePelicula = props.nombre_peli;
            const sectorPunto = props.sector;

            let passesFecha = true;
            if (fechaVal !== 'todos') {
                switch (fechaVal) {
                    case 'antes1950': passesFecha = añoProduccion < 1950; break;
                    case '1951-1973': passesFecha = añoProduccion >= 1951 && añoProduccion <= 1973; break;
                    case '1974-1990': passesFecha = añoProduccion >= 1974 && añoProduccion <= 1990; break;
                    case '1990-actualidad': passesFecha = añoProduccion >= 1990; break;
                }
            }

            let passesPelicula = true;
            if (peliculaVal !== 'todas') {
                passesPelicula = nombrePelicula === peliculaVal;
            }

            let passesSector = true;
            if (sectorVal !== 'todos') {
                passesSector = sectorPunto === sectorVal;
            }

            return passesFecha && passesPelicula && passesSector;
        });
    }

    function updateAllFilterOptionsAndMap() {
        const currentFechaSelection = fechaFilter.value;
        const currentPeliculaSelection = peliculaFilter.value;
        const currentSectorSelection = sectorFilter.value;

        // --- Actualizar opciones y contadores para Película ---
        const peliculasOptions = {};
        allLocacionesData.features.forEach(f => {
            const nombre = f.properties.nombre_peli;
            if (nombre) {
                // Contar cuántas locaciones de esta película coinciden con los otros filtros activos
                const count = filterFeatures(allLocacionesData.features, currentFechaSelection, nombre, currentSectorSelection).length;
                if (count > 0) { // Solo añadir si hay locaciones para esa película con los filtros activos
                    peliculasOptions[nombre] = count;
                }
            }
        });
        const sortedPeliculas = Object.keys(peliculasOptions).sort();
        peliculaFilter.innerHTML = '<option value="todas">Todas</option>';
        sortedPeliculas.forEach(pelicula => {
            const option = document.createElement('option');
            option.value = pelicula;
            option.textContent = `${pelicula} (${peliculasOptions[pelicula]})`;
            peliculaFilter.appendChild(option);
        });
        peliculaFilter.value = currentPeliculaSelection;


        // --- Actualizar opciones y contadores para Año de Producción ---
        const fechaRangesOptions = {
            'antes1950': { text: 'Antes de 1950', count: 0 },
            '1951-1973': { text: '1951-1973', count: 0 },
            '1974-1990': { text: '1974-1990', count: 0 },
            '1990-actualidad': { text: '1990-Actualidad', count: 0 }
        };

        allLocacionesData.features.forEach(f => {
            const año = parseInt(f.properties.año_producción);
            // Para contar correctamente los rangos de fecha, necesitamos un filtro temporario
            // que solo considere la película y el sector actuales, y luego verificar el año.
            // Esto es crucial para que los contadores de fecha reflejen el estado actual de los otros filtros.
            const matchesOtherFilters = filterFeatures([f], 'todos', currentPeliculaSelection, currentSectorSelection).length > 0;

            if (matchesOtherFilters) { // Incluimos solo si pasa los otros filtros
                if (año < 1950) fechaRangesOptions['antes1950'].count++;
                if (año >= 1951 && año <= 1973) fechaRangesOptions['1951-1973'].count++;
                if (año >= 1974 && año <= 1990) fechaRangesOptions['1974-1990'].count++;
                if (año >= 1990) fechaRangesOptions['1990-actualidad'].count++;
            }
        });


        fechaFilter.innerHTML = '<option value="todos">Todos</option>';
        for (const key in fechaRangesOptions) {
            if (fechaRangesOptions[key].count > 0) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = `${fechaRangesOptions[key].text} (${fechaRangesOptions[key].count})`;
                fechaFilter.appendChild(option);
            }
        }
        fechaFilter.value = currentFechaSelection;

        // --- Actualizar opciones y contadores para Sector ---
        const sectoresOptions = {};
        if (allSectoresData) { // Asegúrate de que allSectoresData esté cargado
            allSectoresData.features.forEach(sectorFeature => {
                const sectorName = sectorFeature.properties.Nombre_Cer || sectorFeature.properties.name;
                if (sectorName) {
                    const count = filterFeatures(allLocacionesData.features, currentFechaSelection, currentPeliculaSelection, sectorName).length;
                    if (count > 0) {
                        sectoresOptions[sectorName] = count;
                    }
                }
            });
        }
        const sortedSectores = Object.keys(sectoresOptions).sort();
        sectorFilter.innerHTML = '<option value="todos">Todos</option>';
        sortedSectores.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = `${sector} (${sectoresOptions[sector]})`;
            sectorFilter.appendChild(option);
        });
        sectorFilter.value = currentSectorSelection;


        // --- Filtrado final para el mapa ---
        const featuresToDisplayOnMap = filterFeatures(allLocacionesData.features, currentFechaSelection, currentPeliculaSelection, currentSectorSelection);
        drawMap(featuresToDisplayOnMap, allSectoresData.features, currentSectorSelection);
    }

    function drawMap(locacionesFeatures, sectoresFeatures, currentSelectedSector) {
        sectoresLayerGroup.clearLayers();
        markers.clearLayers(); // Limpiar los marcadores existentes en el grupo de clusters

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

        const locationIcon = L.icon({
            iconUrl: 'images/location_icon.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        const geoJsonLayer = L.geoJson(locacionesFeatures, {
            pointToLayer: function (feature, latlng) {
                const marker = L.marker(latlng, {icon: locationIcon});
                
                // Eventos para añadir/quitar clases de animación al abrir/cerrar popup
                marker.on('popupopen', function() {
                    const popupElement = this.getPopup().getElement();
                    if (popupElement) {
                        // Asegurar que la clase de cierre no esté presente y añadir la de apertura
                        popupElement.classList.remove('leaflet-popup-close-animation');
                        popupElement.classList.add('leaflet-popup-open');
                    }
                });

                marker.on('popupclose', function() {
                    const popupElement = this.getPopup().getElement();
                    if (popupElement) {
                        // Asegurar que la clase de apertura no esté presente y añadir la de cierre
                        popupElement.classList.remove('leaflet-popup-open');
                        popupElement.classList.add('leaflet-popup-close-animation');
                    }
                });

                return marker;
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.geometry && feature.geometry.coordinates) {
                    const props = feature.properties;

                    const imageUrl = props.imagen_asociada && props.imagen_asociada.startsWith('http')
                                    ? props.imagen_asociada
                                    : `images/${props.imagen_asociada || 'no-image.jpg'}`;

                    // Contenido del popup con el wrapper para la imagen y el icono de lupa
                    const popupContent = `
                        <div class="popup-content">
                            <div class="popup-image-wrapper">
                                <img src="${imageUrl}" alt="Imagen de la escena" class="popup-image" onerror="this.src='images/no-image.jpg';" style="cursor: pointer;">
                                <i class="fas fa-search-plus zoom-icon"></i>
                            </div>
                            <h4>${props.nombre_peli || 'Sin Nombre'} (${props.año_producción || 'N/A'})</h4>
                            <p><strong>Director:</strong> ${props.director || 'N/A'}</p>
                            <p><strong>Género:</strong> ${props.genero || 'N/A'}</p>
                            <p><strong>Nota Breve:</strong> ${props.nota_breve || 'Sin descripción'}</p>
                            <p><strong>Sector:</strong> ${props.sector || 'N/A'}</p>
                        </div>
                    `;
                    layer.bindPopup(popupContent, {maxWidth: 400});

                    layer.on('popupopen', () => {
                        const popupImage = layer.getPopup().getElement()?.querySelector('.popup-image');
                        if (popupImage) {
                            popupImage.addEventListener('click', () => {
                                const img = document.createElement('img');
                                img.src = popupImage.src;
                                imageViewerOverlay.innerHTML = '';
                                imageViewerOverlay.appendChild(img);
                                imageViewerOverlay.style.display = 'flex';
                            });
                        }
                    });
                }
            }
        });
        
        markers.addLayer(geoJsonLayer); // Añadir los marcadores al grupo de clusters

        // Re-centrar el mapa en los puntos filtrados
        if (locacionesFeatures.length > 0) {
            const visibleCoords = locacionesFeatures.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
            const bounds = L.latLngBounds(visibleCoords);
            map.fitBounds(bounds, { padding: [50, 50] }); // Añadir padding para que no se pegue a los bordes
        } else {
            // Si no hay locaciones, vuelve a la vista inicial de Valparaíso
            map.setView([-33.0472, -71.6127], 14);
        }
    }

    imageViewerOverlay.addEventListener('click', (event) => {
        if (event.target === imageViewerOverlay) {
            imageViewerOverlay.style.display = 'none';
        }
    });

    // Los filtros ahora llaman directamente a updateAllFilterOptionsAndMap
    fechaFilter.addEventListener('change', updateAllFilterOptionsAndMap);
    peliculaFilter.addEventListener('change', updateAllFilterOptionsAndMap);
    sectorFilter.addEventListener('change', updateAllFilterOptionsAndMap);

    if (resetFiltrosBtn) {
        resetFiltrosBtn.addEventListener('click', () => {
            fechaFilter.value = 'todos';
            peliculaFilter.value = 'todas';
            sectorFilter.value = 'todos';
            updateAllFilterOptionsAndMap(); // Llama a la función para actualizar el mapa
            // Cierra el sidebar después de resetear los filtros, ya que no hay botón "aplicar"
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
