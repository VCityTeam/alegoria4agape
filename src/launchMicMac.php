<?php
header('Content-Type: application/json');

$img_name = basename(urldecode($_GET['imagename'] ?? ''));
if ($img_name === '') {
    http_response_code(400);
    echo json_encode(['output' => 'Missing imagename parameter', 'status' => 1]);
    exit;
}
//Method to execute a command in the terminal
function terminal($command)
{
    //system
    //add MicMac to global Path
    $path = getenv('MICMAC_BIN') ?: realpath(__DIR__ . '/../../micmac/bin');
    putenv('PATH=' . getenv('PATH') . PATH_SEPARATOR . $path);
    $command = $command . ' 2>&1';
    if(function_exists('system'))
    {
        ob_start();
        system($command , $return_var);
        $output = ob_get_contents();
        ob_end_clean();
    }
    //passthru
    else if(function_exists('passthru'))
    {
        ob_start();
        passthru($command , $return_var);
        $output = ob_get_contents();
        ob_end_clean();
    }
     
    //exec
    else if(function_exists('exec'))
    {
        exec($command , $output , $return_var);
        $output = implode("n" , $output);
    }
     
    //shell_exec
    else if(function_exists('shell_exec'))
    {
        $output = shell_exec($command) ;
    }
     
    else
    {
        $output = 'Command execution not possible on this system';
        $return_var = 1;
    }
     
    return array('output' => $output , 'status' => $return_var);
}

//MicMac inputs
$path_to_output = __DIR__ . "/../outputs/test";
$path_to_data = __DIR__ . "/../data";
//$img_name = "FRAN_0207_0628_L.jpg";
$calib_file = "Ori-CalInit";
$imagename = preg_replace('/\\.[^.\\s]{3,4}$/', '', $img_name);
$gcp_file = 'gcp_'. $imagename . '.xml';
$appuis_file = 'appuis_'. $imagename . '.xml';
$calib_name = preg_replace('/[\.\s\-\_]+/', '', $img_name);
$calib_path = $path_to_output . DIRECTORY_SEPARATOR . $calib_file . DIRECTORY_SEPARATOR . 'AutoCal_Foc-50000_Cam-' . $calib_name . '.xml';

//copy image from data directory to outputs directory for micmac reasons...
//copy($path_to_data."\\".$img_name,$path_to_output."\\".$img_name);
$data_image = $path_to_data.DIRECTORY_SEPARATOR.$img_name;
$output_image = $path_to_output.DIRECTORY_SEPARATOR.$img_name;
if (!is_file($data_image)) {
    http_response_code(404);
    echo json_encode([
        'output' => 'Image not found in data directory: ' . $data_image,
        'status' => 1,
    ]);
    exit;
}

if (!copy($data_image, $output_image)) {
    http_response_code(500);
    echo json_encode([
        'output' => 'Could not copy image to output directory: ' . $output_image,
        'status' => 1,
    ]);
    exit;
}

$missing = [];
foreach ([
    '3D ground points' => $path_to_output . DIRECTORY_SEPARATOR . $gcp_file,
    '2D image points' => $path_to_output . DIRECTORY_SEPARATOR . $appuis_file,
    'camera calibration' => $calib_path,
] as $label => $file) {
    if (!is_file($file)) {
        $missing[] = $label . ': ' . basename($file);
    }
}

if ($missing) {
    http_response_code(400);
    echo json_encode([
        'output' => "Missing MicMac input files:\n" . implode("\n", $missing) . "\n\nRegister at least 7 matched points: Shift-click each point in the photo, then Alt-click the corresponding point in the 3D scene.",
        'status' => 1,
        'command' => null,
    ]);
    exit;
}

//change current directory to outputs directory
chdir($path_to_output);

//MicMac command to compute image orientation based on calibration file, 2D image coordinates file, and 3D ground control points file
$cmd = "mm3d Aspro" . " " . $img_name . " " . $calib_file . " " . $gcp_file . " " . $appuis_file;

// $cmd = "mm3d Init11P " . $gcp_file . " " . $appuis_file . " Rans=[500,6]"  ;

//retrieve MicMac command output and store it into an array
$output_array = terminal($cmd);
$output_array['command'] = $cmd;

//encode the output as json
echo json_encode($output_array);

?>
