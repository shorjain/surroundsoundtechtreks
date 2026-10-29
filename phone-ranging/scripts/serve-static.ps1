# serve-static.ps1 — serve this folder on http://localhost:8090 WITHOUT Node.
# Enough to run tests/index.html and frontend/lab.html in a browser (the API needs Node).
#   powershell -ExecutionPolicy Bypass -File scripts/serve-static.ps1
param([int]$Port = 8090)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mime = @{ '.html'='text/html'; '.js'='text/javascript'; '.css'='text/css'; '.json'='application/json'; '.svg'='image/svg+xml'; '.md'='text/plain' }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$Port/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if ($rel -eq '') { $rel = 'frontend/lab.html' }
  $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
  if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file)
    $ctx.Response.ContentType = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
    $ctx.Response.Headers.Add('Cache-Control', 'no-store')
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
  }
  $ctx.Response.Close()
}
