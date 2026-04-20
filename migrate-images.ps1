# =============================================================
# PERFUME IPORDISE SITE - Image Migration Script
# Copies product images to assets/images/products/{brand}/{slug}/
# Renames files to SEO-friendly names
# Updates all HTML files to use local paths
# =============================================================

$base = "c:\Users\Ziko\Desktop\PERFUME IPORDISE SITE"
$assetsProducts = "$base\assets\images\products"

# ---- Helper: folder name -> SEO slug ----
function Get-Slug {
    param([string]$name)
    $s = $name.ToLower()
    $s = $s -replace "l['']homme", "lhomme"
    $s = $s -replace "l['']intense", "lintense"
    $s = $s -replace "[àáâä]", "a"
    $s = $s -replace "[éèêë]", "e"
    $s = $s -replace "[îï]", "i"
    $s = $s -replace "[ôö]", "o"
    $s = $s -replace "[ùûüú]", "u"
    $s = $s -replace "[ç]", "c"
    $s = $s -replace "['']", ""
    $s = $s -replace "[^a-z0-9\s\-]", " "
    $s = $s.Trim()
    $s = $s -replace "\s+", "-"
    $s = $s -replace "-+", "-"
    $s = $s.Trim("-")
    return $s
}

# ---- Brand mapping for products/ folder ----
$brandMap = @{
    "Armani Stronger With You Absolutely Perfume"                        = "armani"
    "Armani Stronger With You Powerfully Eau de Parfum"                  = "armani"
    "Azzaro Forever Wanted Elixir Eau de Parfum"                         = "azzaro"
    "Azzaro The Most Wanted Eau de Parfum Intense"                       = "azzaro"
    "Azzaro The Most Wanted Parfum"                                      = "azzaro"
    "BLEU DE CHANEL Eau de Parfum spray"                                 = "chanel"
    "Boss Bottled Absolu Intense"                                        = "hugo-boss"
    "Carolina Herrera Bad Boy Eau de Toilette"                           = "carolina-herrera"
    "DIOR HOMME INTENSE Eau de Parfum"                                   = "dior"
    "Dior SAUVAGE Eau de Parfum"                                         = "dior"
    "Emporio Armani Stronger With You Intensely"                         = "armani"
    "Gentleman Private Reserve Eau de Parfum"                            = "givenchy"
    "Givenchy Gentleman Society Amber Eau de Parfum"                     = "givenchy"
    "Givenchy Gentleman Society Extreme Eau de Parfum"                   = "givenchy"
    "Givenchy Gentleman Society Nomade Eau de Parfum"                    = "givenchy"
    "Gucci Guilty Absolu de Parfum Pour Homme"                           = "gucci"
    "Gucci Guilty Elixir Pour Homme"                                     = "gucci"
    "Hugo Boss Boss Bottled Elixir Intense"                              = "hugo-boss"
    "Hugo Boss The Scent For Him Elixir"                                 = "hugo-boss"
    "Jean Paul Gaultier Le Beau Eau de Parfum"                           = "jean-paul-gaultier"
    "Jean Paul Gaultier Le Male Elixir"                                  = "jean-paul-gaultier"
    "Jean Paul Gaultier Le Male In Blue Eau de Parfum"                   = "jean-paul-gaultier"
    "Jean Paul Gaultier Le Male Le Parfum Eau de Parfum"                 = "jean-paul-gaultier"
    "Jean Paul Gaultier Scandal Elixir"                                  = "jean-paul-gaultier"
    "Jean Paul Gaultier Scandal Intense Eau de Parfum"                   = "jean-paul-gaultier"
    "L'homme Ideal Extreme"                                              = "guerlain"
    "L'homme Idéal Extrême"                                              = "guerlain"
    "L'Homme Ideal L'Intense Eau de Parfum"                              = "guerlain"
    "L'Homme Idéal L'Intense Eau de Parfum"                              = "guerlain"
    "Le Male Eau de Toilette"                                            = "jean-paul-gaultier"
    "Montale Arabians Tonka"                                             = "montale"
    "Prada L'Homme EDT"                                                  = "prada"
    "Prada Luna Rossa Black Eau de Parfum"                               = "prada"
    "Prada Luna Rossa Carbon EDT"                                        = "prada"
    "Prada Luna Rossa Men EDT"                                           = "prada"
    "Prada Luna Rossa Ocean Eau de Parfum"                               = "prada"
    "Prada Luna Rossa Ocean Le Parfum"                                   = "prada"
    "Prada Paradigme Eau de Parfum"                                      = "prada"
    "Rabanne One Million Elixir Intense"                                 = "rabanne"
    "Rabanne One Million Parfum"                                         = "rabanne"
    "Valentino Born In Roma Donna Intense Eau de Parfum"                 = "valentino"
    "Valentino Born In Roma Uomo Intense Eau de Parfum"                  = "valentino"
    "Valentino Born in Rome Extradose"                                   = "valentino"
    "Valentino Donna Born in Roma Eau de Parfum"                         = "valentino"
    "Valentino Uomo Born In Roma Coral Fantasy Eau de Toilette"          = "valentino"
    "Valentino Uomo Born in Roma Eau de Toilette"                        = "valentino"
    "Valentino Uomo Born In Roma Purple Melancholia Eau de Toilette"     = "valentino"
    "Versace Dylan Blue  Eau de Toilette"                                = "versace"
    "Versace Eros Eau de Parfum"                                         = "versace"
    "Versace Eros Energy Eau de Parfum"                                  = "versace"
    "Versace Eros Flame Eau de Parfum"                                   = "versace"
    "Yves Saint Laurent Myslf Eau de Parfum"                             = "ysl"
    "Yves Saint Laurent MYSLF Le Parfum"                                 = "ysl"
    "Yves Saint Laurent Y Eau de Parfum"                                 = "ysl"
}

# ---- URL replacement table: [oldUrlSubpath, newRelativePathFromRoot] ----
# We store tuples of (old encoded URL segment, new local path from project root)
$urlMap = [System.Collections.Generic.List[PSCustomObject]]::new()

# ---- STEP 1: Process products/ ----
Write-Host "`n=== Processing products/ ===" -ForegroundColor Cyan
Get-ChildItem "$base\products" -Directory | ForEach-Object {
    $folderName = $_.Name
    $brand = $brandMap[$folderName]
    if (-not $brand) {
        Write-Warning "  No brand mapped for: '$folderName'"
        return
    }

    $slug = Get-Slug -name $folderName
    $targetDir = "$assetsProducts\$brand\$slug"
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

    Get-ChildItem $_.FullName -File | Where-Object { $_.Extension -imatch '\.(jpg|jpeg|png|webp|gif|avif|jfif)$' } | ForEach-Object {
        $img = $_
        $newName = $img.Name.ToLower() -replace "^first\.", "1."
        Copy-Item -Path $img.FullName -Destination "$targetDir\$newName" -Force

        # Build URL mapping entries (both URL-encoded variants used in GitHub)
        $encFolder = [System.Uri]::EscapeDataString($folderName) -replace '\+', '%20'
        $encFile   = [System.Uri]::EscapeDataString($img.Name)   -replace '\+', '%20'
        $newPath   = "assets/images/products/$brand/$slug/$newName"

        # main branch variant
        $urlMap.Add([PSCustomObject]@{
            Old = "raw.githubusercontent.com/perfumiro/max/main/products/$encFolder/$encFile"
            New = $newPath
        })
        # refs/heads/main variant
        $urlMap.Add([PSCustomObject]@{
            Old = "raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/$encFolder/$encFile"
            New = $newPath
        })
        # Handle original "first.webp" -> now "1.webp" for old URLs that referenced "first.webp"
        if ($img.Name -imatch "^first\.") {
            $encOldFile = [System.Uri]::EscapeDataString($img.Name) -replace '\+', '%20'
            $urlMap.Add([PSCustomObject]@{
                Old = "raw.githubusercontent.com/perfumiro/max/main/products/$encFolder/$encOldFile"
                New = $newPath
            })
            $urlMap.Add([PSCustomObject]@{
                Old = "raw.githubusercontent.com/perfumiro/max/refs/heads/main/products/$encFolder/$encOldFile"
                New = $newPath
            })
        }
    }

    Write-Host "  [products] $brand/$slug" -ForegroundColor Green
}

# ---- STEP 2: Process uniqueeluxury products/ ----
Write-Host "`n=== Processing uniqueeluxury products/ ===" -ForegroundColor Cyan
Get-ChildItem "$base\uniqueeluxury products" -Directory | ForEach-Object {
    $folderName = $_.Name
    $slug = Get-Slug -name $folderName
    $targetDir = "$assetsProducts\unique-luxury\$slug"
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

    Get-ChildItem $_.FullName -File | Where-Object { $_.Extension -imatch '\.(jpg|jpeg|png|webp|gif|avif|jfif)$' } | ForEach-Object {
        $img = $_
        $newName = $img.Name.ToLower()
        Copy-Item -Path $img.FullName -Destination "$targetDir\$newName" -Force

        $encSourceFolder = "uniqueeluxury%20products"
        $encFolder = [System.Uri]::EscapeDataString($folderName) -replace '\+', '%20'
        $encFile   = [System.Uri]::EscapeDataString($img.Name)   -replace '\+', '%20'
        $newPath   = "assets/images/products/unique-luxury/$slug/$newName"

        $urlMap.Add([PSCustomObject]@{
            Old = "raw.githubusercontent.com/perfumiro/max/refs/heads/main/$encSourceFolder/$encFolder/$encFile"
            New = $newPath
        })
    }

    Write-Host "  [unique-luxury] $slug" -ForegroundColor Green
}

# ---- STEP 3: Process Xerjoff Products/ ----
Write-Host "`n=== Processing Xerjoff Products/ ===" -ForegroundColor Cyan
Get-ChildItem "$base\Xerjoff Products" -Directory | ForEach-Object {
    $folderName = $_.Name
    $slug = Get-Slug -name $folderName
    $targetDir = "$assetsProducts\xerjoff\$slug"
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

    Get-ChildItem $_.FullName -File | Where-Object { $_.Extension -imatch '\.(jpg|jpeg|png|webp|gif|avif|jfif)$' } | ForEach-Object {
        $img = $_
        $newName = $img.Name.ToLower()
        Copy-Item -Path $img.FullName -Destination "$targetDir\$newName" -Force

        $encSourceFolder = "Xerjoff%20Products"
        $encFolder = [System.Uri]::EscapeDataString($folderName) -replace '\+', '%20'
        $encFile   = [System.Uri]::EscapeDataString($img.Name)   -replace '\+', '%20'
        $newPath   = "assets/images/products/xerjoff/$slug/$newName"

        $urlMap.Add([PSCustomObject]@{
            Old = "raw.githubusercontent.com/perfumiro/max/refs/heads/main/$encSourceFolder/$encFolder/$encFile"
            New = $newPath
        })
    }

    Write-Host "  [xerjoff] $slug" -ForegroundColor Green
}

Write-Host "`n=== Total URL mappings: $($urlMap.Count) ===" -ForegroundColor Yellow

# ---- STEP 4: Add asset-folder URL mappings (already local) ----
# These files already exist locally under assets/ - just map their GitHub URLs to local paths
$assetFolderMaps = @(
    @{ GitPath = "assets/Herosectionphotos"; LocalPath = "assets/Herosectionphotos" }
    @{ GitPath = "assets/XERJOFFFALEXANDERIPHOTOSECTION"; LocalPath = "assets/XERJOFFFALEXANDERIPHOTOSECTION" }
    @{ GitPath = "assets/Shop%20by%20Scent%20Family"; LocalPath = "assets/Shop by Scent Family" }
    @{ GitPath = "assets/Shop by Scent Family"; LocalPath = "assets/Shop by Scent Family" }
)

foreach ($af in $assetFolderMaps) {
    $gitFolder = $af.GitPath
    $localFolder = $af.LocalPath
    $localDir = "$base\$localFolder"
    if (Test-Path $localDir) {
        Get-ChildItem $localDir -File | Where-Object { $_.Name -ne ".gitkeep" } | ForEach-Object {
            $img = $_
            $encFile = [System.Uri]::EscapeDataString($img.Name) -replace '\+', '%20'
            $newPath = "$localFolder/$($img.Name)"

            $urlMap.Add([PSCustomObject]@{
                Old = "raw.githubusercontent.com/perfumiro/max/refs/heads/main/$gitFolder/$encFile"
                New = $newPath
            })
            $urlMap.Add([PSCustomObject]@{
                Old = "raw.githubusercontent.com/perfumiro/max/main/$gitFolder/$encFile"
                New = $newPath
            })
        }
    }
}

Write-Host "=== Total URL mappings after assets: $($urlMap.Count) ===" -ForegroundColor Yellow

# ---- STEP 5: Update all HTML files ----
Write-Host "`n=== Updating HTML files ===" -ForegroundColor Cyan

$htmlFiles = @(
    "$base\index.html"
    "$base\discover.html"
    "$base\pages\product.html"
    "$base\pages\valentino.html"
    "$base\pages\xerjoff.html"
    "$base\pages\unique-luxury.html"
)

# Also find any other HTML files that might have GitHub raw URLs
$allHtmlWithGithub = Select-String -Path "$base\*.html", "$base\pages\*.html" -Pattern "raw\.githubusercontent\.com" -List |
    Select-Object -ExpandProperty Path
foreach ($p in $allHtmlWithGithub) {
    if ($htmlFiles -notcontains $p) { $htmlFiles += $p }
}

foreach ($filePath in $htmlFiles) {
    if (-not (Test-Path $filePath)) { continue }

    $isInPages = $filePath -match "\\pages\\"
    $prefix = if ($isInPages) { "../" } else { "" }

    $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
    $originalContent = $content
    $changeCount = 0

    foreach ($entry in $urlMap) {
        $oldFull  = "https://$($entry.Old)"
        $newFull  = "$prefix$($entry.New)"

        if ($content -match [regex]::Escape($oldFull)) {
            $content = $content -replace [regex]::Escape($oldFull), $newFull
            $changeCount++
        }
    }

    if ($content -ne $originalContent) {
        [System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
        Write-Host "  Updated: $(Split-Path $filePath -Leaf) ($changeCount replacements)" -ForegroundColor Green
    } else {
        Write-Host "  No changes: $(Split-Path $filePath -Leaf)" -ForegroundColor DarkGray
    }
}

# ---- STEP 6: Update .gitignore ----
Write-Host "`n=== Updating .gitignore ===" -ForegroundColor Cyan
$gitignorePath = "$base\.gitignore"
$gitignoreLines = @()
if (Test-Path $gitignorePath) {
    $gitignoreLines = Get-Content $gitignorePath
}

$toAdd = @(
    ""
    "# Source product image folders (images migrated to assets/images/products/)"
    "products/"
    "uniqueeluxury products/"
    "Xerjoff Products/"
)

$alreadyHas = $gitignoreLines -contains "products/"
if (-not $alreadyHas) {
    Add-Content -Path $gitignorePath -Value ($toAdd -join "`n")
    Write-Host "  Added products/, uniqueeluxury products/, Xerjoff Products/ to .gitignore" -ForegroundColor Green
} else {
    Write-Host "  .gitignore already has products/ entry" -ForegroundColor DarkGray
}

# ---- SUMMARY ----
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host " Migration complete!" -ForegroundColor Green
Write-Host " Images copied to: assets/images/products/" -ForegroundColor Green
$totalCopied = (Get-ChildItem "$assetsProducts" -Recurse -File | Where-Object { $_.Extension -imatch '\.(jpg|jpeg|png|webp|gif|avif|jfif)$' }).Count
Write-Host " Total images in assets/images/products/: $totalCopied" -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Cyan
