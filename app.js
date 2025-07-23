document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([-33.0472, -71.6127], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    let locacionesLayerGroup = L.featureGroup().addTo(map);
    let sectoresLayerGroup = L.featureGroup().addTo(map);
    let allLocacionesData = null;
    let allSectoresData = null;

    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    const fechaFilter = document.getElementById('fecha-filter');
    const peliculaFilter = document.getElementById('pelicula-filter');
    const sectorFilter = document.getElementById('sector-filter');
    const aplicarFiltrosBtn = document.getElementById('aplicar-filtros');
    const resetFiltrosBtn = document.getElementById('reset-filtros');
    const acercaDeLink = document.getElementById('acerca-de-link');
    const aboutModal = document.getElementById('about-modal');
    const closeModalBtn = document.querySelector('.close-button');

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

    function populatePeliculaAndSectorFilters(features) {
        const peliculas = [...new Set(features.map(f => f.properties.nombre_peli))].filter(Boolean).sort();
        peliculaFilter.innerHTML = '<option value="todas">Todas</option>';
        peliculas.forEach(pelicula => {
            const option = document.createElement('option');
            option.value = pelicula;
            option.textContent = pelicula;
            peliculaFilter.appendChild(option);
        });

        const sectores = [...new Set(features.map(f => f.properties.sector))].filter(Boolean).sort();
        sectorFilter.innerHTML = '<option value="todos">Todos</option>';
        sectores.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });
    }

    function getFilteredLocaciones() {
        if (!allLocacionesData) return [];
        const selectedFecha = fechaFilter.value;
        const selectedPelicula = peliculaFilter.value;
        const selectedSector = sectorFilter.value;

        return allLocacionesData.features.filter(f => {
            const { año_producción, nombre_peli, sector } = f.properties;
            let valid = true;
            if (selectedFecha !== 'todos') {
                if (selectedFecha === 'antes1950') valid = año_producción < 1950;
                else if (selectedFecha === '1951-1973') valid = año_producción >= 1951 && año_producción <= 1973;
                else if (selectedFecha === '1974-1990') valid = año_producción >= 1974 && año_producción <= 1990;
                else if (selectedFecha === '1990-actualidad') valid = año_producción >= 1990;
            }
            return valid &&
                (selectedPelicula === 'todas' || nombre_peli === selectedPelicula) &&
                (selectedSector === 'todos' || sector === selectedSector);
        });
    }

    function drawMap(locaciones) {
        locacionesLayerGroup.clearLayers();
        sectoresLayerGroup.clearLayers();

        const selectedSector = sectorFilter.value;

        if (allSectoresData) {
            L.geoJson(allSectoresData, {
                style: f => {
                    const name = f.properties.Nombre_Sector || f.properties.name;
                    const isSelected = selectedSector !== 'todos' && name === selectedSector;
                    return {
                        color: isSelected ? '#007bff' : '#ff7800',
                        weight: isSelected ? 4 : 2,
                        opacity: 0.8,
                        fillOpacity: 0.2,
                        fillColor: isSelected ? '#007bff' : '#ff7800'
                    };
                },
                onEachFeature: (f, l) => {
                    const name = f.properties.Nombre_Sector || f.properties.name;
                    if (name) l.bindPopup(`<h4>Sector: ${name}</h4>`);
                }
            }).addTo(sectoresLayerGroup);
        }

        L.geoJson(locaciones, {
            pointToLayer: (f, latlng) => L.marker(latlng),
            onEachFeature: (f, layer) => {
                const p = f.properties;
                const imageUrl = p.imagen_asociada
                    ? (p.imagen_asociada.startsWith('http') ? p.imagen_asociada : `images/${p.imagen_asociada}`)
                    : 'images/no-image.jpg';

                const popup = `
                    <div class="popup-content">
                        <img src="${imageUrl}" alt="Imagen" class="popup-image" onerror="this.src='images/no-image.jpg';">
                        <h4>${p.nombre_peli || 'Sin Nombre'} (${p.año_producción || 'N/A'})</h4>
                        <p><strong>Director:</strong> ${p.director || 'N/A'}</p>
                        <p><strong>Género:</strong> ${p.genero || 'N/A'}</p>
                        <p><strong>Nota:</strong> ${p.nota_breve || 'Sin descripción'}</p>
                        <p><strong>Sector:</strong> ${p.sector || 'N/A'}</p>
                    </div>
                `;
                layer.bindPopup(popup, { maxWidth: 400 });
            }
        }).addTo(locacionesLayerGroup);
    }

    async function loadGeoJSONData() {
        try {
            const resLoc = await fetch('data/locaciones_valparaiso.geojson');
            allLocacionesData = await resLoc.json();

            const resSec = await fetch('data/sectores_valparaiso.geojson');
            allSectoresData = await resSec.json();

            populatePeliculaAndSectorFilters(allLocacionesData.features);
            drawMap(allLocacionesData.features);
        } catch (e) {
            console.error("Error al cargar datos:", e);
        }
    }

    aplicarFiltrosBtn.addEventListener('click', () => {
        drawMap(getFilteredLocaciones());
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        menuToggle.classList.remove('active');
    });

    resetFiltrosBtn.addEventListener('click', () => {
        fechaFilter.value = 'todos';
        peliculaFilter.value = 'todas';
        sectorFilter.value = 'todos';
        populatePeliculaAndSectorFilters(allLocacionesData.features);
        drawMap(allLocacionesData.features);
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        menuToggle.classList.remove('active');
    });

    fechaFilter.addEventListener('change', () => {
        const f = getFilteredLocaciones();
        populatePeliculaAndSectorFilters(f);
        drawMap(f);
    });

    peliculaFilter.addEventListener('change', () => {
        drawMap(getFilteredLocaciones());
    });

    sectorFilter.addEventListener('change', () => {
        drawMap(getFilteredLocaciones());
    });

    acercaDeLink.addEventListener('click', e => {
        e.preventDefault();
        aboutModal.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', () => {
        aboutModal.style.display = 'none';
    });

    window.addEventListener('click', e => {
        if (e.target === aboutModal) aboutModal.style.display = 'none';
    });

    loadGeoJSONData();
});
