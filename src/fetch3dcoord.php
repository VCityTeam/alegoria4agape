<?php
   
    //collect data sent as XML 
    $xml2 = file_get_contents('php://input');
    if ($xml2 === '') {
        $xml2 = file_get_contents('php://stdin');
    }

    preg_match('/<NameIm>(.*?)<\/NameIm>/s', $xml2, $matches);
    $imagename = html_entity_decode($matches[1] ?? '', ENT_QUOTES | ENT_XML1, 'UTF-8');
    $imagename = preg_replace('/\\.[^.\\s]{3,4}$/', '', $imagename);
    if ($imagename === '') {
        http_response_code(400);
        echo 'Missing NameIm in 3D points XML';
        exit;
    }

    //open a file handler with read and write permission
    $fh2 = fopen(__DIR__ . '/../outputs/test/gcp_'. $imagename . '.xml', 'w+');
    //writing XML string to the new file
    fwrite($fh2, $xml2);
    //closing the file handler
    fclose($fh2);
    echo($xml2);
?>
