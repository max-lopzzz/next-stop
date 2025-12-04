<?php
require_once '../config.php';

try {
    $db = getDBConnection();

    // Obtener todos los vehículos
    $vehiculos = $db->query("SELECT vehiculo_id, modelo FROM Vehiculo ORDER BY vehiculo_id")->fetchAll();

    // Obtener todos los conductores
    $conductores = $db->query("SELECT conductor_id, nombre FROM Conductor ORDER BY nombre")->fetchAll();

    // Obtener todas las rutas
    $rutas = $db->query("SELECT ruta_id, nombre FROM Ruta ORDER BY nombre")->fetchAll();

    // Obtener todas las paradas
    $paradas = $db->query("SELECT parada_id, nombre FROM Paradas ORDER BY nombre")->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => [
            'vehiculos' => $vehiculos,
            'conductores' => $conductores,
            'rutas' => $rutas,
            'paradas' => $paradas
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error obteniendo filtros: ' . $e->getMessage()
    ]);
}
?>