<?php
require_once '../config.php';

try {
    $db = getDBConnection();

    // Obtener parámetros de filtro
    $vehiculo_id = $_GET['vehiculo_id'] ?? null;
    $conductor_id = $_GET['conductor_id'] ?? null;
    $ruta_id = $_GET['ruta_id'] ?? null;
    $parada_id = $_GET['parada_id'] ?? null;
    $fecha_inicio = $_GET['fecha_inicio'] ?? null;
    $fecha_fin = $_GET['fecha_fin'] ?? null;

    // KPI 1: Total de vehículos
    $sql = "SELECT COUNT(DISTINCT vehiculo_id) as total FROM Vehiculo";
    $whereConditions = [];
    $params = [];

    if ($vehiculo_id) {
        $whereConditions[] = 'vehiculo_id = :vehiculo_id';
        $params[':vehiculo_id'] = $vehiculo_id;
    }

    if ($conductor_id) {
        $sql = "SELECT COUNT(DISTINCT v.vehiculo_id) as total
                FROM Vehiculo v
                INNER JOIN Conductor c ON v.vehiculo_id = c.vehiculo_id
                WHERE c.conductor_id = :conductor_id";
        $params = [':conductor_id' => $conductor_id];
    }

    if (count($whereConditions) > 0 && !$conductor_id) {
        $sql .= ' WHERE ' . implode(' AND ', $whereConditions);
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $totalVehiculos = $stmt->fetch()['total'] ?? 0;

    // KPI 2: Total de viajes
    $params = [];
    $whereConditions = [];

    if ($vehiculo_id) {
        $whereConditions[] = 'vehiculo_id = :vehiculo_id';
        $params[':vehiculo_id'] = $vehiculo_id;
    }
    if ($ruta_id) {
        $whereConditions[] = 'ruta_id = :ruta_id';
        $params[':ruta_id'] = $ruta_id;
    }
    if ($fecha_inicio) {
        $whereConditions[] = 'inicio_fechaHora >= :fecha_inicio';
        $params[':fecha_inicio'] = $fecha_inicio;
    }
    if ($fecha_fin) {
        $whereConditions[] = 'inicio_fechaHora <= :fecha_fin';
        $params[':fecha_fin'] = $fecha_fin;
    }

    $sql = "SELECT COUNT(*) as total FROM Viajes";
    if (count($whereConditions) > 0) {
        $sql .= ' WHERE ' . implode(' AND ', $whereConditions);
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $totalViajes = $stmt->fetch()['total'] ?? 0;

    // KPI 3: Total de lecturas
    // Estructura real: Lecturas.sensor_id → Sensores.sensor_id → Sensores.node_id → Nodes.node_id → Nodes.vehiculo_id
    $params = [];
    $whereConditions = [];

    if ($fecha_inicio) {
        $whereConditions[] = 'l.fechaHora >= :fecha_inicio';
        $params[':fecha_inicio'] = $fecha_inicio;
    }
    if ($fecha_fin) {
        $whereConditions[] = 'l.fechaHora <= :fecha_fin';
        $params[':fecha_fin'] = $fecha_fin;
    }

    // Si hay filtro de vehículo, necesitamos JOIN con Sensores y Nodes
    if ($vehiculo_id) {
        $sql = "SELECT COUNT(*) as total
                FROM Lecturas l
                INNER JOIN Sensores s ON l.sensor_id = s.sensor_id
                INNER JOIN Nodes n ON s.node_id = n.node_id
                WHERE n.vehiculo_id = :vehiculo_id";
        $params[':vehiculo_id'] = $vehiculo_id;

        if ($fecha_inicio) {
            $sql .= ' AND l.fechaHora >= :fecha_inicio';
            $params[':fecha_inicio'] = $fecha_inicio;
        }
        if ($fecha_fin) {
            $sql .= ' AND l.fechaHora <= :fecha_fin';
            $params[':fecha_fin'] = $fecha_fin;
        }
    } else {
        $sql = "SELECT COUNT(*) as total FROM Lecturas l";
        if (count($whereConditions) > 0) {
            $sql .= ' WHERE ' . implode(' AND ', $whereConditions);
        }
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $totalLecturas = $stmt->fetch()['total'] ?? 0;

    // KPI 4: Promedio de capacidad
    $params = [];
    $sql = "SELECT AVG(capacidad) as promedio FROM Vehiculo";

    if ($vehiculo_id) {
        $sql .= ' WHERE vehiculo_id = :vehiculo_id';
        $params[':vehiculo_id'] = $vehiculo_id;
    } elseif ($conductor_id) {
        $sql = "SELECT AVG(v.capacidad) as promedio
                FROM Vehiculo v
                INNER JOIN Conductor c ON v.vehiculo_id = c.vehiculo_id
                WHERE c.conductor_id = :conductor_id";
        $params[':conductor_id'] = $conductor_id;
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $promedioCapacidad = round($stmt->fetch()['promedio'] ?? 0);

    echo json_encode([
        'success' => true,
        'data' => [
            'totalVehiculos' => (int)$totalVehiculos,
            'totalViajes' => (int)$totalViajes,
            'totalLecturas' => (int)$totalLecturas,
            'promedioCapacidad' => (int)$promedioCapacidad
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error obteniendo KPIs: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
?>