// Configuración
const API_BASE_URL = './api';
const UPDATE_INTERVAL = 5000;

// Mapeo de sensores y actuadores - CORREGIDO CON NOMBRES REALES DE LA BASE DE DATOS
const SENSOR_actuador_PAIRS = {
    temperatura: {
        // Sensor: "Sensor de Temperatura 1" (Unidad: Celsius)
        sensorKeywords: ['temperatura', 'Celsius', 'temp', 'DHT'],
        chartId: 'chartTemperatura',
        sensorLabel: 'Temperatura (C)',
        actuadorLabel: 'Ventilador'
    },
    distancia: {
        // Sensor: "Sensor de Proximidad" (Unidad: Cm)
        sensorKeywords: ['Proximidad', 'proximidad', 'Cm', 'cm', 'distancia'],
        chartId: 'chartDistancia',
        sensorLabel: 'Distancia (cm)',
        actuadorLabel: 'Buzzer'
    },
    luz: {
        // Sensor: "Luz Parada Zona Tec" (Unidad: Iluminacion)
        sensorKeywords: ['Luz', 'luz', 'Iluminacion', 'iluminacion', 'Parada', 'Tec'],
        chartId: 'chartLuz',
        sensorLabel: 'Iluminación',
        actuadorLabel: 'Luces'
    },
    pir: {
        // Sensores: "Sensor de Movimiento Entrada" y "Sensor de Movimiento Salida" (Unidad: Movimiento)
        sensorKeywords: ['Movimiento', 'movimiento', 'Entrada', 'entrada', 'Salida', 'salida', 'PIR'],
        chartId: 'chartPIR',
        sensorLabel: 'Movimiento',
        actuadorLabel: 'Puertas'
    },
    boton: {
        // Sensor: "Boton Parada Zona Tec" (Unidad: Pasajeros)
        sensorKeywords: ['Boton', 'boton', 'button', 'Parada', 'parada', 'Tec', 'Zona', 'Pasajeros'],
        chartId: 'chartBoton',
        sensorLabel: 'Botón',
        actuadorLabel: 'Pantalla LCD'
    }
};

let charts = {};
let autoRefreshInterval = null;
let currentFilters = {};

const elements = {
    vehiculo: document.getElementById('vehiculo'),
    conductor: document.getElementById('conductor'),
    ruta: document.getElementById('ruta'),
    parada: document.getElementById('parada'),
    fechaInicio: document.getElementById('fechaInicio'),
    fechaFin: document.getElementById('fechaFin'),
    btnApplyFilters: document.getElementById('btnApplyFilters'),
    btnResetFilters: document.getElementById('btnResetFilters'),
    autoRefresh: document.getElementById('autoRefresh'),
    kpiVehiculos: document.getElementById('kpiVehiculos'),
    kpiViajes: document.getElementById('kpiViajes'),
    kpiLecturas: document.getElementById('kpiLecturas'),
    kpiCapacidad: document.getElementById('kpiCapacidad'),
    connectionStatus: document.getElementById('connectionStatus'),
    statusText: document.getElementById('statusText'),
    updateTime: document.getElementById('updateTime'),
    errorMessage: document.getElementById('errorMessage')
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    updateConnectionStatus('Cargando...', false);
    try {
        await loadFilterOptions();
        initializeCharts();
        await loadAllData();
        setupEventListeners();
        startAutoRefresh();
        updateConnectionStatus('Conectado', true);
    } catch (error) {
        console.error('Error:', error);
        showError('Error al inicializar');
        updateConnectionStatus('Error', false);
    }
}

function setupEventListeners() {
    elements.btnApplyFilters.addEventListener('click', handleApplyFilters);
    elements.btnResetFilters.addEventListener('click', handleResetFilters);
    elements.autoRefresh.addEventListener('change', handleAutoRefreshToggle);
}

function updateConnectionStatus(text, isConnected) {
    elements.statusText.textContent = text;
    const dot = elements.connectionStatus.querySelector('.status-dot');
    if (isConnected) {
        dot.classList.remove('disconnected');
    } else {
        dot.classList.add('disconnected');
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'flex';
    setTimeout(() => {
        elements.errorMessage.style.display = 'none';
    }, 8000);
}

async function loadFilterOptions() {
    const response = await fetch(API_BASE_URL + '/filters.php');
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    
    const { vehiculos, conductores, rutas, paradas } = result.data;
    
    vehiculos.forEach(v => {
        const option = document.createElement('option');
        option.value = v.vehiculo_id;
        option.textContent = v.vehiculo_id + ' - ' + v.modelo;
        elements.vehiculo.appendChild(option);
    });
    
    conductores.forEach(c => {
        const option = document.createElement('option');
        option.value = c.conductor_id;
        option.textContent = c.nombre;
        elements.conductor.appendChild(option);
    });
    
    rutas.forEach(r => {
        const option = document.createElement('option');
        option.value = r.ruta_id;
        option.textContent = r.nombre;
        elements.ruta.appendChild(option);
    });
    
    paradas.forEach(p => {
        const option = document.createElement('option');
        option.value = p.parada_id;
        option.textContent = p.nombre;
        elements.parada.appendChild(option);
    });
}

function getCurrentFilters() {
    return {
        vehiculo_id: elements.vehiculo.value,
        conductor_id: elements.conductor.value,
        ruta_id: elements.ruta.value,
        parada_id: elements.parada.value,
        fecha_inicio: elements.fechaInicio.value,
        fecha_fin: elements.fechaFin.value
    };
}

async function handleApplyFilters() {
    currentFilters = getCurrentFilters();
    await loadAllData();
}

async function handleResetFilters() {
    elements.vehiculo.value = '';
    elements.conductor.value = '';
    elements.ruta.value = '';
    elements.parada.value = '';
    elements.fechaInicio.value = '';
    elements.fechaFin.value = '';
    currentFilters = {};
    await loadAllData();
}

function handleAutoRefreshToggle() {
    if (elements.autoRefresh.checked) {
        startAutoRefresh();
    } else {
        stopAutoRefresh();
    }
}

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(async () => {
        if (elements.autoRefresh.checked) {
            await loadAllData(true);
        }
    }, UPDATE_INTERVAL);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

async function loadAllData(isAutoUpdate = false) {
    try {
        if (!isAutoUpdate) updateConnectionStatus('Actualizando...', true);
        await Promise.all([loadKPIs(), loadChartData()]);
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        elements.updateTime.textContent = 'Última actualización: ' + hours + ':' + minutes + ':' + seconds;
        if (!isAutoUpdate) updateConnectionStatus('Conectado', true);
    } catch (error) {
        console.error('Error:', error);
        if (!isAutoUpdate) {
            showError('Error al cargar datos');
            updateConnectionStatus('Error', false);
        }
    }
}

async function loadKPIs() {
    const queryParams = new URLSearchParams(currentFilters);
    const response = await fetch(API_BASE_URL + '/kpis.php?' + queryParams);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    
    const data = result.data;
    animateValue(elements.kpiVehiculos, parseInt(elements.kpiVehiculos.textContent) || 0, data.totalVehiculos);
    animateValue(elements.kpiViajes, parseInt(elements.kpiViajes.textContent) || 0, data.totalViajes);
    animateValue(elements.kpiLecturas, parseInt(elements.kpiLecturas.textContent) || 0, data.totalLecturas);
    animateValue(elements.kpiCapacidad, parseInt(elements.kpiCapacidad.textContent) || 0, data.promedioCapacidad);
}

function animateValue(element, start, end, duration = 500) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current).toLocaleString();
    }, 16);
}

async function loadChartData() {
    const queryParams = new URLSearchParams(currentFilters);
    queryParams.set('limit', '100');
    const response = await fetch(API_BASE_URL + '/chart-data.php?' + queryParams);
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    
    // LOG PARA DEBUG (puedes comentarlo después de verificar que funciona)
    console.log('=== DATOS RECIBIDOS DEL API ===');
    console.log('Total de registros:', result.data.length);
    if (result.data.length > 0) {
        console.log('Ejemplo de registro:', result.data[0]);
    }
    
    updateAllCharts(result.data);
}

function initializeCharts() {
    for (const key in SENSOR_actuador_PAIRS) {
        const config = SENSOR_actuador_PAIRS[key];
        charts[key] = createChart(config.chartId, config.sensorLabel, config.actuadorLabel);
    }
}

function createChart(canvasId, sensorLabel, actuadorLabel) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: sensorLabel,
                    data: [],
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    yAxisID: 'y',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: actuadorLabel,
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    yAxisID: 'y1',
                    stepped: 'before',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#2d3748',
                    bodyColor: '#4a5568',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                x: {
                    display: true,
                    title: { display: true, text: 'Tiempo', font: { weight: 'bold' } },
                    ticks: { maxRotation: 45, minRotation: 45 }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: sensorLabel, font: { weight: 'bold' } },
                    grid: { drawOnChartArea: true }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: actuadorLabel, font: { weight: 'bold' } },
                    min: 0,
                    max: 1,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return value === 1 ? 'ON' : 'OFF';
                        }
                    },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function updateAllCharts(data) {
    if (!data || data.length === 0) {
        console.warn('⚠️ No hay datos para mostrar en las gráficas');
        return;
    }
    
    const groupedData = {
        temperatura: [],
        distancia: [],
        luz: [],
        pir: [],
        boton: []
    };
    
    // CLASIFICACIÓN MEJORADA con los nombres reales de tu base de datos
    data.forEach(item => {
        const sensorName = (item.sensor_nombre || '').toLowerCase().trim();
        const sensorUnit = (item.unidad || '').toLowerCase().trim();
        const combinedText = sensorName + ' ' + sensorUnit;
        
        let classified = false;
        
        for (const key in SENSOR_actuador_PAIRS) {
            if (classified) break; // Solo clasificar en una categoría
            
            const config = SENSOR_actuador_PAIRS[key];
            
            // Buscar coincidencias en las palabras clave
            for (const keyword of config.sensorKeywords) {
                const keywordLower = keyword.toLowerCase();
                
                if (combinedText.includes(keywordLower)) {
                    groupedData[key].push(item);
                    classified = true;
                    break;
                }
            }
        }
        
        // Log de los no clasificados para debug
        if (!classified) {
            console.log(`❌ Sensor no clasificado: "${item.sensor_nombre}" (Unidad: ${item.unidad})`);
        }
    });
    
    // Log de resultados de clasificación
    console.log('=== DATOS AGRUPADOS ===');
    for (const key in groupedData) {
        const count = groupedData[key].length;
        const config = SENSOR_actuador_PAIRS[key];
        console.log(`${config.sensorLabel}: ${count} registros`);
        
        if (count === 0) {
            console.warn(`⚠️ Sin datos para: ${config.sensorLabel}`);
        }
    }
    
    // Actualizar cada gráfica
    for (const key in groupedData) {
        updateChart(charts[key], groupedData[key]);
    }
}

function updateChart(chart, data) {
    if (!chart) {
        console.error('❌ Chart no inicializado');
        return;
    }
    
    if (!data || data.length === 0) {
        console.warn('⚠️ No hay datos para esta gráfica');
        // Limpiar la gráfica si no hay datos
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.data.datasets[1].data = [];
        chart.update('none');
        return;
    }
    
    const labels = data.map(item => {
        if (!item.timestamp) return '';
        const date = new Date(item.timestamp);
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return h + ':' + m + ':' + s;
    });
    
    const sensorData = data.map(item => item.sensor_valor);
    const actuadorData = data.map(item => item.actuador_estado);
    
    chart.data.labels = labels;
    chart.data.datasets[0].data = sensorData;
    chart.data.datasets[1].data = actuadorData;
    chart.update('none');
    
    console.log(`✓ Gráfica actualizada con ${data.length} puntos`);
}

window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});