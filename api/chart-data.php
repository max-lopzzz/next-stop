<?php
require_once '../config.php';

try {
    $db = getDBConnection();

    // Obtener parámetros
    $vehiculo_id = $_GET['vehiculo_id'] ?? null;
    $conductor_id = $_GET['conductor_id'] ?? null;
    $ruta_id = $_GET['ruta_id'] ?? null;
    $parada_id = $_GET['parada_id'] ?? null;
    $fecha_inicio = $_GET['fecha_inicio'] ?? null;
    $fecha_fin = $_GET['fecha_fin'] ?? null;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;

    // Query optimizada con JOINs
    // Estructura: Lecturas → Sensores → Nodes → Vehiculo
    $params = [':limit' => $limit];

    $sql = "SELECT
                l.lectura_id,
                l.fechaHora,
                l.valor_num,
                l.valor_int,
                l.valor_bool,
                l.unidad,
                s.sensor_id,
                s.nombre as sensor_nombre,
                n.node_id,
                v.vehiculo_id,
                v.modelo
            FROM Lecturas l
            INNER JOIN Sensores s ON l.sensor_id = s.sensor_id
            INNER JOIN Nodes n ON s.node_id = n.node_id
            LEFT JOIN Vehiculo v ON n.vehiculo_id = v.vehiculo_id
            WHERE l.fechaHora IS NOT NULL";

    if ($vehiculo_id) {
        $sql .= ' AND v.vehiculo_id = :vehiculo_id';
        $params[':vehiculo_id'] = $vehiculo_id;
    }

    if ($fecha_inicio) {
        $sql .= ' AND l.fechaHora >= :fecha_inicio';
        $params[':fecha_inicio'] = $fecha_inicio;
    }

    if ($fecha_fin) {
        $sql .= ' AND l.fechaHora <= :fecha_fin';
        $params[':fecha_fin'] = $fecha_fin;
    }

    $sql .= " ORDER BY l.fechaHora DESC LIMIT :limit";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $sensorData = $stmt->fetchAll();

    // Obtener datos de actuadores con timestamps similares
    $actuadorMap = [];

    // Query optimizada para actuadores
    $actuadorSql = "SELECT
                        a.actuador_id,
                        a.nombre AS actuador_nombre,
                        l.fechaHora,
                        l.valor_bool AS estado,
                        s.sensor_id,
                        n.vehiculo_id
                    FROM Actuadores a
                    INNER JOIN Sensores s ON a.sensor_id = s.sensor_id
                    INNER JOIN Lecturas l ON s.sensor_id = l.sensor_id
                    INNER JOIN Nodes n ON s.node_id = n.node_id
                    WHERE l.fechaHora IS NOT NULL";

    if ($vehiculo_id) {
        $actuadorSql .= ' AND n.vehiculo_id = :vehiculo_id';
    }
    if ($fecha_inicio) {
        $actuadorSql .= ' AND l.fechaHora >= :fecha_inicio';
    }
    if ($fecha_fin) {
        $actuadorSql .= ' AND l.fechaHora <= :fecha_fin';
    }
    
    $actuadorSql .= " ORDER BY l.fechaHora DESC LIMIT :limit";

    $actuadorStmt = $db->prepare($actuadorSql);
    $actuadorStmt->execute($params);
    $actuadorData = $actuadorStmt->fetchAll();

    // Crear mapa de actuadores por timestamp
    foreach ($actuadorData as $act) {
        $timestamp = $act['fechaHora'];
        if (!isset($actuadorMap[$timestamp])) {
            $actuadorMap[$timestamp] = [];
        }
        $actuadorMap[$timestamp][] = $act;
    }

    // Construir datos de gráfica
    $chartData = [];

    foreach ($sensorData as $sensor) {
        $item = [
            'timestamp' => $sensor['fechaHora'],
            'sensor_valor' => null,
            'sensor_nombre' => $sensor['sensor_nombre'],
            'sensor_id' => $sensor['sensor_id'],
            'actuador_estado' => null,
            'actuador_nombre' => null,
            'actuador_id' => null,
            'vehiculo_id' => $sensor['vehiculo_id'],
            'modelo' => $sensor['modelo'],
            'unidad' => $sensor['unidad']
        ];

        // Determinar valor del sensor
        if ($sensor['valor_num'] !== null) {
            $item['sensor_valor'] = (float)$sensor['valor_num'];
        } elseif ($sensor['valor_int'] !== null) {
            $item['sensor_valor'] = (float)$sensor['valor_int'];
        } elseif ($sensor['valor_bool'] !== null) {
            $item['sensor_valor'] = (float)($sensor['valor_bool'] ? 1 : 0);
        }

        // Buscar actuador en el timestamp exacto o cercano
        $timestamp = $sensor['fechaHora'];
        if (isset($actuadorMap[$timestamp]) && count($actuadorMap[$timestamp]) > 0) {
            $act = $actuadorMap[$timestamp][0];
            $item['actuador_id'] = $act['actuador_id'];
            $item['actuador_nombre'] = $act['actuador_nombre'];
            $item['actuador_estado'] = $act['estado'] ? 1 : 0;
        } else {
            // Buscar actuador con timestamp similar (dentro de 1 minuto)
            $found = false;
            foreach ($actuadorMap as $actTimestamp => $acts) {
                $timeDiff = abs(strtotime($actTimestamp) - strtotime($timestamp));
                if ($timeDiff < 60 && count($acts) > 0) {
                    $act = $acts[0];
                    $item['actuador_id'] = $act['actuador_id'];
                    $item['actuador_nombre'] = $act['actuador_nombre'];
                    $item['actuador_estado'] = $act['estado'] ? 1 : 0;
                    $found = true;
                    break;
                }
            }
        }

        $chartData[] = $item;
    }

    // Invertir para orden cronológico
    $chartData = array_reverse($chartData);

    echo json_encode([
        'success' => true,
        'data' => $chartData
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error obteniendo datos de gráfica: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
?>
