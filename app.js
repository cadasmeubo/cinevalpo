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
    const resetFiltrosBtn = document.getElementById('reset-filters-btn'); // AÑADIDO: Elemento del botón de reset
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

            console.log("Datos de locaciones cargados:", allLocacionesData);
            console.log("Datos de sectores cargados:", allSectoresData);

            populateFilters(allLocacionesData.features, allSectoresData.features);
            drawMap(allLocacionesData.features, allSectoresData.features);

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

        const sectores = [...new Set(sectoresFeatures.map(f => f.properties.Nombre_Sector || f.properties.name))].filter(Boolean).sort();
        sectorFilter.innerHTML = '<option value="todos">Todos</option>';
        sectores.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });
        
        // Populate fecha-filter (added this part as it was missing from your last provided app.js)
        const fechas = [...new Set(locacionesFeatures.map(f => f.properties.año))].filter(Boolean).sort();
        fechaFilter.innerHTML = '<option value="todos">Todos</option>';
        
        // Add specific year ranges for 'fecha-filter'
        const hasPre1950 = fechas.some(year => parseInt(year) < 1950);
        if (hasPre1950) {
            const option = document.createElement('option');
            option.value = 'antes1950';
            option.textContent = 'Antes de 1950';
            fechaFilter.appendChild(option);
        }

        const has1951_1973 = fechas.some(year => parseInt(year) >= 1951 && parseInt(year) <= 1973);
        if (has1951_1973) {
            const option = document.createElement('option');
            option.value = '1951-1973';
            option.textContent = '1951-1973';
            fechaFilter.appendChild(option);
        }

        const has1974_1990 = fechas.some(year => parseInt(year) >= 1974 && parseInt(year) <= 1990);
        if (has1974_1990) {
            const option = document.createElement('option');
            option.value = '1974-1990';
            option.textContent = '1974-1990';
            fechaFilter.appendChild(option);
        }

        const has1990_present = fechas.some(year => parseInt(year) >= 1990);
        if (has1990_present) {
            const option = document.createElement('option');
            option.value = '1990-actualidad';
            option.textContent = '1990-Actualidad';
            fechaFilter.appendChild(option);
        }
    }

    function drawMap(locacionesFeatures, sectoresFeatures) {
        locacionesLayerGroup.clearLayers();
        sectoresLayerGroup.clearLayers();

        // Añadir Sectores (Polígonos)
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
                let sectorName = feature.properties.Nombre_Sector || feature.properties.name || 'Sector Desconocido';
                let sectorPopupContent = `<b>${sectorName}</b>`;
                console.log("Binding popup for sector:", sectorName);
                console.log("Popup content for sector (HTML string):", sectorPopupContent); // NUEVA LÍNEA DE DEPURACIÓN
                layer.bindPopup(sectorPopupContent);
            }
        }).addTo(sectoresLayerGroup);

        // Añadir Locaciones (Puntos)
        L.geoJson(locacionesFeatures, {
            pointToLayer: function (feature, latlng) {
                 // Personalizar el icono para cada marcador según Tipo_Locacion
                let iconClass;
                // Asumiendo que 'Tipo_Locacion' existe en las propiedades de tu GeoJSON de locaciones
                // Si no existe o tiene otro nombre, por favor ajusta 'feature.properties.Tipo_Locacion'
                switch (feature.properties.Tipo_Locacion) { 
                    case 'Casa':
                        iconClass = 'fa-house';
                        break;
                    case 'Calle':
                        iconClass = 'fa-road';
                        break;
                    case 'Plaza':
                        iconClass = 'fa-tree';
                        break;
                    case 'Cerro':
                        iconClass = 'fa-mountain';
                        break;
                    case 'Puerto':
                        iconClass = 'fa-ship';
                        break;
                    default:
                        iconClass = 'fa-location-dot'; // Icono por defecto si no hay tipo o el tipo no coincide
                }

                const customIcon = L.divIcon({
                    html: `<i class="fa-solid ${iconClass}" style="color: #ff0000; font-size: 24px;"></i>`,
                    className: 'custom-div-icon',
                    iconSize: [30, 30], // Tamaño del div que contiene el icono
                    iconAnchor: [15, 30] // Punto del icono que corresponde a la latlng (centro inferior)
                });
                return L.marker(latlng, { icon: customIcon });
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
                            <h4>${props.nombre_peli || 'Sin Nombre'} (${props.año || 'N/A'})</h4>
                            <p><strong>Director:</strong> ${props.director || 'N/A'}</p>
                            <p><strong>Género:</strong> ${props.género || 'N/A'}</p>
                            <p><strong>Nota Breve:</strong> ${props.nota_breve || 'Sin descripción'}</p>
                            <p><strong>Sector:</strong> ${props.sector || 'N/A'}</p>
                        </div>
                    `;
                    layer.bindPopup(popupContent, {maxWidth: 400});
                }
            }
        }).addTo(locacionesLayerGroup);
        
        // Ajustar el mapa para que muestre todas las capas si hay datos
        if (locacionesFeatures.length > 0 || sectoresFeatures.length > 0) {
            const allFeaturesGroup = L.featureGroup([...locacionesLayerGroup.getLayers(), ...sectoresLayerGroup.getLayers()]);
            if (allFeaturesGroup.getLayers().length > 0) {
                map.fitBounds(allFeaturesGroup.getBounds());
            }
        }
    }

    // Manejo de filtros
    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener('click', () => {
            const selectedFecha = fechaFilter.value;
            const selectedPelicula = peliculaFilter.value;
            const selectedSector = sectorFilter.value;

            const filteredFeatures = allLocacionesData.features.filter(feature => {
                const props = feature.properties;
                const añoProduccion = parseInt(props.año);
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

            drawMap(filteredFeatures, allSectoresData.features);
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    }

    // AÑADIDO: Manejador para el botón de reset de filtros
    if (resetFiltrosBtn) { 
        resetFiltrosBtn.addEventListener('click', () => {
            fechaFilter.value = 'todos';
            peliculaFilter.value = 'todas';
            sectorFilter.value = 'todos';
            drawMap(allLocacionesData.features, allSectoresData.features); // Vuelve a dibujar con todos los datos
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
