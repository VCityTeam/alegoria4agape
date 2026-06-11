<?php 
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['files'])) {
        $errors = [];
        $uploaded = [];
        $path = __DIR__ . '/../data/';
        $extensions = ['jpg', 'jpeg', 'png', 'gif'];
		
        $all_files = count($_FILES['files']['tmp_name']);

        for ($i = 0; $i < $all_files; $i++) {  
            $file_name = basename($_FILES['files']['name'][$i]);
            $file_tmp = $_FILES['files']['tmp_name'][$i];
            $file_type = $_FILES['files']['type'][$i];
            $file_size = $_FILES['files']['size'][$i];
            $file_ext = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));

            $file = $path . $file_name;

            if (!in_array($file_ext, $extensions)) {
                $errors[] = 'Extension not allowed: ' . $file_name . ' ' . $file_type;
            }

            if ($file_size > 18497152) {
                $errors[] = 'File size exceeds limit: ' . $file_name . ' ' . $file_type;
            }

            if (empty($errors)) {
                if (move_uploaded_file($file_tmp, $file)) {
                    $uploaded[] = $file_name;
                } else {
                    $errors[] = 'Could not save file: ' . $file_name;
                }
            }
        }

        if ($errors) {
            http_response_code(400);
            echo json_encode(['errors' => $errors, 'uploaded' => $uploaded]);
            exit;
        }
        echo json_encode(['uploaded' => $uploaded]);
    }
}
