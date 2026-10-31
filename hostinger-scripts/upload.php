<?php
/**
 * upload.php — hardened upload endpoint for uploads.ndscbd.net
 *
 * Called ONLY by the Next.js server (Vercel) with the X-Upload-Secret header.
 * - Secret compared in constant time.
 * - File type decided from the file CONTENTS (never the client's filename/MIME).
 * - Extension chosen from the detected type, so a .php/.html file can never be stored.
 * - Every upload folder gets a .htaccess that blocks script execution.
 * - Errors never expose server details.
 */

// ===================== CONFIG: EDIT THIS ONE LINE =====================
// Must be EXACTLY the same value as UPLOAD_SECRET in Vercel.
// Generate with:  openssl rand -hex 32
$secret = '____';
// ======================================================================

// Includes both the apex domain and the www subdomain — next.config.ts treats
// both as valid hostnames for this site, and only the apex was previously
// listed here, which would silently fail CORS (and fall back to the slower,
// Vercel-size-limited proxy path) for anyone reaching the admin panel via
// https://www.ndscbd.net.
$allowed_origins = ['https://arnob.ndscbd.net', 'https://ndscbd.net', 'https://www.ndscbd.net'];
// Extended to match every folder the Next.js API route's BUCKET_TO_FOLDER map
// actually sends (see app/api/admin/upload/route.ts). Previously this list
// only had a handful of folders, so anything else — certificates, olympiad
// covers/pdfs, survey covers, publications, legacy/glance galleries — quietly
// fell back to 'misc' below instead of landing in its intended folder.
$allowed_folders = [
    'covers', 'gallery', 'pdfs', 'misc', 'executives', 'about-hero',
    'certificates', 'certificate-templates',
    'olympiad-covers', 'olympiad-pdfs',
    'survey-covers', 'publications',
    'legacy-gallery', 'glance-gallery',
];
$public_host     = 'uploads.ndscbd.net';
$max_bytes       = 100 * 1024 * 1024; // 100 MB hard cap (PHP's own limits may be lower)

// Never print PHP errors to the client.
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

function respond($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload);
    exit;
}
function fail($msg, $code) {
    respond(['error' => $msg], $code);
}

// Any unexpected error -> clean JSON 500, no details leaked.
set_exception_handler(function ($e) {
    error_log('upload.php exception: ' . $e->getMessage());
    fail('Server error', 500);
});

// ---- CORS (harmless for server-to-server calls; kept for the legacy sites) ----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: X-Upload-Secret, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'OPTIONS') respond([], 200);
if ($method !== 'POST')    fail('Method not allowed', 405);

// ---- Refuse to run with an unset secret ----
if (!is_string($secret) || strlen($secret) < 16 || strpos($secret, 'PASTE_') === 0) {
    error_log('upload.php: secret not configured');
    fail('Server not configured', 500);
}

// ---- Authenticate (constant-time) ----
$incoming = $_SERVER['HTTP_X_UPLOAD_SECRET'] ?? '';
if (!is_string($incoming) || !hash_equals($secret, $incoming)) {
    usleep(300000); // small delay slows guessing
    fail('Unauthorized', 401);
}

// ---- Validate the upload ----
if (!isset($_FILES['file']) || !is_array($_FILES['file']) || is_array($_FILES['file']['error'])) {
    fail('No file uploaded', 400);
}
$f = $_FILES['file'];
if ($f['error'] !== UPLOAD_ERR_OK) {
    $code = ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) ? 413 : 400;
    fail($code === 413 ? 'File too large' : 'Upload error', $code);
}
if (!is_uploaded_file($f['tmp_name'])) fail('Invalid upload', 400);
if ($f['size'] <= 0)          fail('Empty file', 400);
if ($f['size'] > $max_bytes)  fail('File too large', 413);

// ---- Folder (whitelist; anything else -> misc) ----
$folder = $_POST['folder'] ?? 'misc';
if (!is_string($folder) || !in_array($folder, $allowed_folders, true)) $folder = 'misc';

// ---- Detect the REAL type from the file contents ----
if (class_exists('finfo')) {
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
} elseif (function_exists('mime_content_type')) {
    $mime = mime_content_type($f['tmp_name']);
} else {
    error_log('upload.php: fileinfo extension missing');
    fail('Server not configured', 500);
}

// detected MIME => extension we will store it with
$ext_map = [
    'image/jpeg'      => 'jpg',
    'image/png'       => 'png',
    'image/webp'      => 'webp',
    'image/gif'       => 'gif',
    'image/heic'      => 'heic',
    'image/heif'      => 'heif',
    'application/pdf' => 'pdf',
    'video/mp4'       => 'mp4',
    'video/quicktime' => 'mov',
    'video/webm'      => 'webm',
];
if (!is_string($mime) || !isset($ext_map[$mime])) {
    fail('File type not allowed', 400);
}
$ext     = $ext_map[$mime];
$is_pdf  = ($mime === 'application/pdf');
$is_img  = (strpos($mime, 'image/') === 0);

if ($folder === 'pdfs' && !$is_pdf) fail('Only PDF allowed in pdfs folder', 400);

// Images (except HEIC/HEIF, which PHP can't parse) must really decode as images.
if ($is_img && $mime !== 'image/heic' && $mime !== 'image/heif') {
    if (@getimagesize($f['tmp_name']) === false) fail('Invalid image', 400);
}

// ---- Make sure no upload folder can ever execute scripts ----
$deny = "# Block script execution in this upload folder\n"
      . "<FilesMatch \"(?i)\\.(php[0-9]*|phtml|phar|pht|phps|cgi|pl|py|sh|asp|aspx|jsp|html?|js)$\">\n"
      . "  Require all denied\n"
      . "</FilesMatch>\n";

foreach ($allowed_folders as $name) {
    $d = __DIR__ . '/' . $name . '/';
    if (is_dir($d) && !file_exists($d . '.htaccess')) @file_put_contents($d . '.htaccess', $deny);
}

$target_dir = __DIR__ . '/' . $folder . '/';
if (!is_dir($target_dir) && !@mkdir($target_dir, 0755, true) && !is_dir($target_dir)) {
    error_log('upload.php: cannot create ' . $target_dir);
    fail('Server error', 500);
}
if (!file_exists($target_dir . '.htaccess')) @file_put_contents($target_dir . '.htaccess', $deny);

// ---- Save (filename is fully server-generated) ----
$filename  = time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
$dest_path = $target_dir . $filename;

if (!move_uploaded_file($f['tmp_name'], $dest_path)) {
    error_log('upload.php: move_uploaded_file failed');
    fail('Failed to save file', 500);
}
@chmod($dest_path, 0644);

respond([
    'success'  => true,
    'url'      => 'https://' . $public_host . '/uploads/' . $folder . '/' . $filename,
    'filename' => $filename,
    'folder'   => $folder,
]);
