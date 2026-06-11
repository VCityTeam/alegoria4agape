<?php
//collect data sent as XML 
$xml = file_get_contents('php://input');
if ($xml === '') {
    $xml = file_get_contents('php://stdin');
}
preg_match('/<NameIm>(.*?)<\/NameIm>/s', $xml, $matches);
$imagename = html_entity_decode($matches[1] ?? '', ENT_QUOTES | ENT_XML1, 'UTF-8');
$imagename = preg_replace('/\\.[^.\\s]{3,4}$/', '', $imagename);
if ($imagename === '') {
    http_response_code(400);
    echo 'Missing NameIm in 2D points XML';
    exit;
}

//open a file handler with read and write permission
$fh = fopen(__DIR__ . '/../outputs/test/appuis_'. $imagename . '.xml', 'w+');
//writing XML string to the new file
fwrite($fh, $xml);
//closing the file handler
fclose($fh);
echo($xml);
?>
