$files = @("index.html", "men.html", "women.html", "style.css")

$pattern = "https?://[a-zA-Z0-9.-_/%?=&]+"

# Create assets folder if not exists
if (!(Test-Path -Path "assets")) {
    New-Item -ItemType Directory -Path "assets"
}

$counter = 1
$urlMap = @{}

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $matches = [regex]::Matches($content, $pattern)
        
        foreach ($match in $matches) {
            $url = $match.Value
            if ($url -match "(unsplash\.com)|(^https(.*?)png$)|(^https(.*?)jpg$)") {
                if (-not $urlMap.ContainsKey($url)) {
                    $ext = "jpg"
                    if ($url -match "\.png$") { $ext = "png" }
                    if ($url -match "\.webp$") { $ext = "webp" }
                    $filename = "img_$counter.$ext"
                    $urlMap[$url] = $filename
                    
                    try {
                        Write-Host "Downloading $url to assets/$filename..."
                        Invoke-WebRequest -Uri $url -OutFile "assets/$filename"
                        $counter++
                    } catch {
                        Write-Host "Failed to download $url"
                    }
                }
                
                # Replace in content
                if ($urlMap.ContainsKey($url)) {
                    $localPath = "assets/" + $urlMap[$url]
                    $content = $content.Replace($url, $localPath)
                }
            }
        }
        
        Set-Content -Path $file -Value $content
        Write-Host "Updated $file"
    }
}
Write-Host "Done!"
