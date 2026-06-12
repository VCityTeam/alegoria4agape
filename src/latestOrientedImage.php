<?php
header('Content-Type: application/json');

$city = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['city'] ?? 'default');
$latest_file = __DIR__ . '/../outputs/test/latest_oriented_' . $city . '.json';

if (!is_file($latest_file)) {
    $orientation_files = glob(__DIR__ . '/../outputs/test/Ori-Aspro/Orientation-*.xml') ?: [];
    usort($orientation_files, function ($a, $b) {
        return filemtime($b) <=> filemtime($a);
    });

    if (!$orientation_files) {
        http_response_code(404);
        echo json_encode(['error' => 'No oriented image has been recorded for this city yet.']);
        exit;
    }

    $orientation = basename($orientation_files[0]);
    $image = preg_replace('/^Orientation-/', '', $orientation);
    $image = preg_replace('/\.xml$/', '', $image);
    echo json_encode([
        'image' => $image,
        'city' => $city,
        'zone' => 'default',
        'orientation' => 'Ori-Aspro/' . $orientation,
        'source' => 'latest-orientation-file',
        'updatedAt' => gmdate('c', filemtime($orientation_files[0])),
    ]);
    exit;
}

readfile($latest_file);
?>
