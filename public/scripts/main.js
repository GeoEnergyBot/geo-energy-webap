const SUPABASE_FUNCTION_URL = 'https://ptkzsrlicfhufdnegwjl.functions.supabase.co/generate-points';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0a3pzcmxpY2ZodWZkbmVnd2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NzA3NjAsImV4cCI6MjA2ODA0Njc2MH0.eI0eF_imdgGWPLiUULTprh52Jo9P69WGpe3RbCg3Afo';

const map = L.map('map').setView([51.1605, 71.4704], 15);

// Добавление слоя карты
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Кастомные иконки
const ghostIcon = L.icon({
    iconUrl: 'ghost.gif',
    iconSize: [48, 48],
    iconAnchor: [24, 24]
});

const energyIcons = {
    common: L.icon({
        iconUrl: 'energy-green.gif',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    }),
    advanced: L.icon({
        iconUrl: 'energy-purple.gif',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    }),
    rare: L.icon({
        iconUrl: 'energy-gold.gif',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    })
};

let userMarker = null;
let energyMarkers = [];

function getEnergyTypeName(type) {
    switch (type) {
        case 'common':
            return 'Обычная энергия';
        case 'advanced':
            return 'Продвинутая энергия';
        case 'rare':
            return 'Редкая энергия';
        default:
            return 'Неизвестно';
    }
}

function displayPoints(points) {
    energyMarkers.forEach(marker => map.removeLayer(marker));
    energyMarkers = [];

    points.forEach(point => {
        const marker = L.marker([point.lat, point.lng], {
            icon: energyIcons[point.type] || energyIcons.common
        });

        marker.bindPopup(`${getEnergyTypeName(point.type)}<br>Собери меня!`);
        marker.addTo(map);
        energyMarkers.push(marker);
    });
}

function fetchEnergyPoints(lat, lng) {
    fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            center_lat: lat,
            center_lng: lng
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.points) {
                displayPoints(data.points);
            } else {
                console.error('Ошибка получения точек:', data);
            }
        })
        .catch(err => console.error('Ошибка запроса:', err));
}

function updateUserLocation(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
    } else {
        userMarker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map);
    }

    map.setView([lat, lng], 15);
    fetchEnergyPoints(lat, lng);
}

// Получение геопозиции
if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(updateUserLocation, err => {
        alert('Ошибка получения геопозиции: ' + err.message);
    }, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
    });
} else {
    alert('Геолокация не поддерживается в этом браузере.');
}
