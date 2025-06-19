// Inisialisasi Peta
const map = L.map('map').setView([42.5063, 1.5218], 12);

// Menambahkan Basemap (Peta Dasar)
const basemap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Tambahkan basemap Satelit
const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// Objek untuk kontrol layer basemap
const baseMaps = {
    "Street View": basemap,
    "Satelit View": satellite
};

// --- FUNGSI UNTUK POP-UP ---
// Fungsi ini akan kita gunakan untuk semua layer agar tidak menulis kode berulang
function onEachFeature(feature, layer) {
    if (feature.properties) {
        // Mencari properti yang kemungkinan berisi nama (case-insensitive)
        let nameProp = Object.keys(feature.properties).find(p => p.toLowerCase().includes('name') || p.toLowerCase().includes('nama') || p.toLowerCase().includes('namobj') || p.toLowerCase().includes('remark'));
        let title = nameProp ? feature.properties[nameProp] : 'Informasi Fitur';

        let popupContent = `<h4>${title}</h4>`;
        for (let key in feature.properties) {
            // Hindari menampilkan nama lagi jika sudah jadi judul dan mempersingkat popup
            if (key !== nameProp) {
                 popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
            }
        }
        layer.bindPopup(popupContent);
    }
}

// --- PENGELOLAAN LAYER ---

// Style untuk highlight saat hover
const highlightStyle = {
    weight: 5,
    color: '#FFFF00', // Kuning cerah
    dashArray: '',
    fillOpacity: 0.7
};

// Daftar file GeoJSON yang akan dimuat
const geojsonFiles = [
    { name: 'Jalan', path: 'data/Jalan.geojson', style: { color: '#ff7800', weight: 2 } },
    { name: 'Bangunan', path: 'data/Bangunan.geojson', style: { color: '#808080', weight: 2, fillColor: '#C0C0C0', fillOpacity: 0.6 } },
    { name: 'Air', path: 'data/Air.geojson', style: { color: '#0000FF', weight: 1, fillColor: '#ADD8E6', fillOpacity: 0.7 } },
    { name: 'Wilayah', path: 'data/Wilayah.geojson', style: { color: '#006400', weight: 3, fillColor: '#90EE90', fillOpacity: 0.5 } },
    { name: 'Lokasi Kota/Desa', path: 'data/Lokasi_Kota_Desa.geojson', type: 'point' }
];

// Memuat semua data GeoJSON secara paralel
Promise.all(geojsonFiles.map(file => fetch(file.path).then(response => {
    if (!response.ok) {
        throw new Error(`Gagal memuat ${file.path}: ${response.statusText}`);
    }
    return response.json();
})))
.then(allData => {
    const overlayMaps = {};

    allData.forEach((data, index) => {
        const layerInfo = geojsonFiles[index];
        let layer;

        if (layerInfo.type === 'point') {
            // Gunakan MarkerClusterGroup untuk layer titik
            const markers = L.markerClusterGroup();
            const geojsonLayer = L.geoJson(data, {
                onEachFeature: onEachFeature, // Cluster tidak perlu hover, hanya popup
                pointToLayer: function (feature, latlng) {
                    return L.marker(latlng); // Marker standar lebih baik untuk cluster
                }
            });
            markers.addLayer(geojsonLayer);
            layer = markers;
        } else {
            const geojsonLayer = L.geoJson(data, {
                style: layerInfo.style,
                onEachFeature: function(feature, layer) {
                    onEachFeature(feature, layer); // Panggil fungsi popup generik

                    // Efek highlight saat hover
                    layer.on({
                        mouseover: (e) => {
                            const target = e.target;
                            target.setStyle(highlightStyle);
                            // Bawa ke depan agar highlight tidak terhalang
                            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                                target.bringToFront();
                            }
                        },
                        mouseout: (e) => {
                            // Gunakan closure untuk merujuk ke geojsonLayer yang benar
                            geojsonLayer.resetStyle(e.target);
                        }
                    });
                }
            });
            layer = geojsonLayer;
        }

        overlayMaps[layerInfo.name] = layer;
    });

    // Tambahkan SEMUA layer ke peta secara default
    for (const layerName in overlayMaps) {
        overlayMaps[layerName].addTo(map);
    }


    // --- KONTROL LAYER (LEGENDA) ---
    const legendControl = L.control.layers(baseMaps, overlayMaps, {
        position: 'bottomleft', // Pindah ke kiri bawah
        collapsed: false // Selalu terbuka sebagai legenda
    }).addTo(map);

    // --- Kustomisasi Legenda menjadi lebih visual ---
    createVisualLegend();

    // --- KONTROL TAMBAHAN ---

    // 1. Skala
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);

    // 2. Minimap
    const osm2 = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {minZoom: 0, maxZoom: 13});
    const miniMap = new L.Control.MiniMap(osm2, { 
        position: 'bottomright', 
        toggleDisplay: true, 
        minimized: true, // Mulai dalam keadaan terminimize
        zoomLevelOffset: -5 
    }).addTo(map);


    // --- KONTROL PENCARIAN BARU (MODAL) ---
    initializeSearchModal(overlayMaps);

})
.catch(error => {
    console.error("Gagal memuat atau memproses data GeoJSON:", error);
    alert("Terjadi kesalahan saat memuat data peta. Silakan periksa konsol untuk detailnya.");
});

function createVisualLegend() {
    const legendContainer = document.querySelector('.leaflet-control-layers-overlays');
    if (!legendContainer) return;

    // Loop melalui setiap layer yang ada di legenda
    geojsonFiles.forEach(layerInfo => {
        const layerName = layerInfo.name;
        const labels = legendContainer.getElementsByTagName('label');
        
        for (let lbl of labels) {
            // Cari label yang sesuai dengan nama layer
            if (lbl.textContent.trim().includes(layerName)) {
                const symbol = document.createElement('span');
                symbol.className = 'legend-symbol';
                
                let style = {};
                if (layerInfo.type === 'point') {
                    symbol.classList.add('point');
                    style.backgroundColor = '#FF0000'; // Warna dari pointToLayer
                    style.borderColor = '#000';
                } else if (layerInfo.style.fillColor) { // Polygon
                    symbol.classList.add('polygon');
                    style.backgroundColor = layerInfo.style.fillColor;
                    style.borderColor = layerInfo.style.color;
                } else { // Line
                    symbol.classList.add('line');
                    style.borderColor = layerInfo.style.color;
                }

                Object.assign(symbol.style, style);
                lbl.prepend(symbol); // Tambahkan simbol di depan teks label
                break; // Lanjut ke layer berikutnya
            }
        }
    });
}


// --- FUNGSI BARU UNTUK MODAL PENCARIAN ---
function initializeSearchModal(layers) {
    const modal = document.getElementById('search-modal');
    const btn = document.getElementById('search-btn');
    const span = document.getElementsByClassName('close-btn')[0];
    const layerSelect = document.getElementById('layer-select');
    const propSelect = document.getElementById('property-select');
    const searchInput = document.getElementById('search-input');
    const searchDatalist = document.getElementById('search-datalist');
    const findBtn = document.getElementById('find-btn');

    // Tampilkan modal saat tombol diklik
    btn.onclick = function() {
        modal.style.display = "block";
    }

    // Sembunyikan modal saat tombol close (x) diklik
    span.onclick = function() {
        modal.style.display = "none";
    }

    // Sembunyikan modal saat klik di luar area modal
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Isi dropdown layer
    for (const layerName in layers) {
        const option = document.createElement('option');
        option.value = layerName;
        option.textContent = layerName;
        layerSelect.appendChild(option);
    }

    // Event saat layer dipilih
    layerSelect.onchange = function() {
        // Reset elemen-elemen di bawahnya
        propSelect.innerHTML = '<option value="">--Pilih Properti--</option>';
        propSelect.disabled = true;
        searchInput.value = '';
        searchInput.disabled = true;
        findBtn.disabled = true;
        searchDatalist.innerHTML = '';

        const selectedLayerName = this.value;
        if (!selectedLayerName) return;

        const selectedLayer = layers[selectedLayerName];
        const features = selectedLayer.getLayers();

        if (features.length > 0) {
            // Ambil properti dari fitur pertama (asumsi semua fitur punya properti sama)
            const properties = Object.keys(features[0].feature.properties);
            properties.forEach(prop => {
                const option = document.createElement('option');
                option.value = prop;
                option.textContent = prop;
                propSelect.appendChild(option);
            });
            propSelect.disabled = false;
        }
    };

    // Event saat properti dipilih
    propSelect.onchange = function() {
        // Reset elemen-elemen di bawahnya
        searchInput.value = '';
        searchInput.disabled = true;
        findBtn.disabled = true;
        searchDatalist.innerHTML = '';

        const selectedLayerName = layerSelect.value;
        const selectedProp = this.value;
        if (!selectedProp) return;

        const selectedLayer = layers[selectedLayerName];
        const values = new Set(); // Gunakan Set untuk mendapatkan nilai unik

        selectedLayer.eachLayer(layer => {
            if (layer.feature.properties && layer.feature.properties[selectedProp] !== null) {
                values.add(layer.feature.properties[selectedProp]);
            }
        });

        // Urutkan nilai sebelum ditampilkan
        [...values].sort().forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            searchDatalist.appendChild(option);
        });
        
        searchInput.disabled = false;
        findBtn.disabled = false;
    };
    
    // Event saat tombol Cari & Zoom diklik
    findBtn.onclick = function() {
        const layerName = layerSelect.value;
        const propName = propSelect.value;
        const searchValue = searchInput.value;

        if (!layerName || !propName || !searchValue) {
            alert('Harap lengkapi semua pilihan pencarian.');
            return;
        }

        const layerGroup = layers[layerName];
        let foundLayer = null;

        layerGroup.eachLayer(layer => {
            if (foundLayer) return; // Hentikan pencarian jika sudah ditemukan
            // Perbandingan fleksibel untuk string dan angka
            if (String(layer.feature.properties[propName]).toLowerCase() === String(searchValue).toLowerCase()) {
                foundLayer = layer;
            }
        });

        if (foundLayer) {
            if (foundLayer.getBounds) { // Untuk poligon atau garis
                map.flyToBounds(foundLayer.getBounds(), { padding: [50, 50] });
            } else if (foundLayer.getLatLng) { // Untuk titik
                map.flyTo(foundLayer.getLatLng(), 18);
            }
            // Buka popup setelah animasi selesai
            setTimeout(() => {
                foundLayer.openPopup();
            }, 1000);
            
            modal.style.display = "none"; // Sembunyikan modal setelah ditemukan
        } else {
            alert(`Data tidak ditemukan untuk nilai "${searchValue}" di properti "${propName}".`);
        }
    };
}