$files = @("index.html", "men.html", "women.html", "style.css")

$pattern = 'https?://[^\s"''<>\)]+'

$counter = 1
$urlMap = @{}

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $matches = [regex]::Matches($content, $pattern)
        
        foreach ($match in $matches) {
            $url = $match.Value
            if ($url -match "unsplash\.com" -or $url -match "githubusercontent\.com") {
                if (-not $urlMap.ContainsKey($url)) {
                    $ext = "jpg"
                    if ($url -match "\.png") { $ext = "png" }
                    if ($url -match "\.webp") { $ext = "webp" }
                    $filename = "img_$counter.$ext"
                    $urlMap[$url] = $filename
                    
                    try {
                        Write-Host "Downloading $filename..."
                        Invoke-WebRequest -Uri $url -OutFile "assets/$filename"
                        $counter++
                    } catch {
                        Write-Host "Failed to download $url"
                    }
                }
            }
        }
    }
}

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        foreach ($url in $urlMap.Keys) {
            $content = $content.Replace($url, "assets/" + $urlMap[$url])
        }
        Set-Content -Path $file -Value $content
        Write-Host "Updated $file"
    }
}
Write-Host "Done!"