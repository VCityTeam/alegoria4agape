<?php
//collect data sent as XML 
$xmlC = file_get_contents('php://input');
if ($xmlC === '') {
    $xmlC = file_get_contents('php://stdin');
}

preg_match('/<NameIn>(.*?)<\/NameIn>/s', $xmlC, $matches);
$imgname = html_entity_decode($matches[1] ?? '', ENT_QUOTES | ENT_XML1, 'UTF-8');
$pattern = '/[\.\s\-\_]+/';  // We remove dot dash and bottom dash as micmac seems to remove them when looking for calib...
$imgname = preg_replace($pattern, '', $imgname);
if ($imgname === '') {
    http_response_code(400);
    echo 'Missing NameIn in calibration XML';
    exit;
}
// We write a calib file even if exif. (associated with local chantier descripteur infoss)
$fh2 =  fopen(__DIR__ . '/../outputs/test/Ori-CalInit/AutoCal_Foc-50000_Cam-'. $imgname . '.xml', 'w+');
//fopen('../outputs/test/Ori-CalInit/AutoCal_Foc-50000_'. $imagename . '.xml', 'w+');
//writing XML string to the new file
fwrite($fh2, $xmlC);
//closing the file handler
fclose($fh2);
?>
