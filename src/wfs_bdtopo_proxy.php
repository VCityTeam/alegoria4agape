<?php
$allowed_type_names = [
    'BDTOPO_V3:batiment',
    'BDTOPO_BDD_WLD_WGS84G:bati_remarquable',
    'BDTOPO_BDD_WLD_WGS84G:bati_indifferencie',
    'BDTOPO_BDD_WLD_WGS84G:bati_industriel',
];

$request = strtoupper($_GET['REQUEST'] ?? $_GET['request'] ?? 'GetFeature');
$service = strtoupper($_GET['SERVICE'] ?? $_GET['service'] ?? 'WFS');

if ($service !== 'WFS' || !in_array($request, ['GETFEATURE', 'GETCAPABILITIES'], true)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Only WFS GetFeature/GetCapabilities requests are allowed.']);
    exit;
}

$type_name = $_GET['typeName'] ?? $_GET['TYPENAME'] ?? $_GET['TYPENAMES'] ?? $_GET['typeNames'] ?? '';
if ($request === 'GETFEATURE') {
    $requested = array_filter(array_map('trim', explode(',', $type_name)));
    $unexpected = array_diff($requested, $allowed_type_names);
    if (!$requested || $unexpected) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Only BDTOPO building layers are allowed.']);
        exit;
    }
}

$forward = $_GET;
$forward['SERVICE'] = 'WFS';
$forward['VERSION'] = $forward['VERSION'] ?? $forward['version'] ?? '2.0.0';
$forward['REQUEST'] = $request === 'GETCAPABILITIES' ? 'GetCapabilities' : 'GetFeature';

$url = 'https://data.geopf.fr/wfs/ows?' . http_build_query($forward, '', '&', PHP_QUERY_RFC3986);
$context = stream_context_create([
    'http' => [
        'ignore_errors' => true,
        'timeout' => 30,
        'header' => "User-Agent: alegoria4agape-wfs-proxy\r\n",
    ],
]);

$body = @file_get_contents($url, false, $context);
$status = 502;
if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches)) {
    $status = (int) $matches[1];
}

http_response_code($status);
header('Content-Type: ' . (stripos($forward['outputFormat'] ?? $forward['OUTPUTFORMAT'] ?? '', 'json') !== false ? 'application/json' : 'text/xml'));
header('Cache-Control: public, max-age=300');

if ($body === false) {
    echo json_encode(['error' => 'Could not fetch BDTOPO WFS data.']);
    exit;
}

echo $body;
?>
