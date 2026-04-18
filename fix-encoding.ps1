
# ── Fix 1: dashboard.html special symbols ──
Set-Location "c:\Users\Ziko\Desktop\PERFUME IPORDISE SITE"

function Replace-Bytes($src, $pattern, $repl) {
    $result = [System.Collections.Generic.List[byte]]::new($src.Length)
    $i = 0
    while ($i -lt $src.Length) {
        $match = $true
        if ($i + $pattern.Length -le $src.Length) {
            for ($j = 0; $j -lt $pattern.Length; $j++) {
                if ($src[$i + $j] -ne $pattern[$j]) { $match = $false; break }
            }
        } else { $match = $false }
        if ($match) { foreach ($b in $repl) { $result.Add($b) }; $i += $pattern.Length }
        else { $result.Add($src[$i]); $i++ }
    }
    return $result.ToArray()
}

$bytes = [System.IO.File]::ReadAllBytes("pages\dashboard.html")
$orig = $bytes.Length

# ✔ (U+2714, E2 9C 94): corrupted as C3A2 C593 E2809D
$bytes = Replace-Bytes $bytes ([byte[]](0xC3,0xA2, 0xC5,0x93, 0xE2,0x80,0x9D)) ([byte[]](0xE2,0x9C,0x94))

# ✗ (U+2717, E2 9C 97): corrupted as C3A2 C593 E28094
$bytes = Replace-Bytes $bytes ([byte[]](0xC3,0xA2, 0xC5,0x93, 0xE2,0x80,0x94)) ([byte[]](0xE2,0x9C,0x97))

# ✓ (U+2713, E2 9C 93): corrupted as C3A2 C593 E2809C
$bytes = Replace-Bytes $bytes ([byte[]](0xC3,0xA2, 0xC5,0x93, 0xE2,0x80,0x9C)) ([byte[]](0xE2,0x9C,0x93))

# → (U+2192, E2 86 92): corrupted as C3A2 E280A0 E28098
$bytes = Replace-Bytes $bytes ([byte[]](0xC3,0xA2, 0xE2,0x80,0xA0, 0xE2,0x80,0x98)) ([byte[]](0xE2,0x86,0x92))

# Français ç (U+00E7, C3 A7): corrupted as C3 83 C2 A7
$bytes = Replace-Bytes $bytes ([byte[]](0xC3,0x83, 0xC2,0xA7)) ([byte[]](0xC3,0xA7))

# é (U+00E9, C3 A9): corrupted as C3 83 C2 A9
$bytes = Replace-Bytes $bytes ([byte[]](0xC3,0x83, 0xC2,0xA9)) ([byte[]](0xC3,0xA9))

[System.IO.File]::WriteAllBytes("pages\dashboard.html", $bytes)

$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$checkmark = [string][char]0x2714
$cross     = [string][char]0x2717
Write-Host "Saved. Bytes: $orig -> $($bytes.Length)"
Write-Host "checkmark Verified: $($text.Contains($checkmark + ' Verified'))"
Write-Host "cross Not verified: $($text.Contains($cross + ' Not verified'))"
$idx = $text.LastIndexOf('settingEmailVerified')
Write-Host "Verified JS line: $($text.Substring([Math]::Max(0,$idx-10), 120))"

# ── Fix 2: mojibake â€" → — and â€¦ → … in all other HTML files ──
# The pattern: UTF-8 bytes E2 80 94 were double-encoded as the Latin-1 string
# "â€"" which in UTF-8 is: C3 A2  E2 80 9C  E2 80 9C  94  (varies by browser)
# Simplest fix: read file bytes as Latin-1, re-encode as UTF-8

function Fix-MojibakeFile($path) {
    # Read raw bytes, interpret as Latin-1 (1252), get the original Unicode string
    $rawBytes = [System.IO.File]::ReadAllBytes($path)
    $latin1 = [System.Text.Encoding]::GetEncoding(1252).GetString($rawBytes)
    # Now re-save as clean UTF-8
    [System.IO.File]::WriteAllText($path, $latin1, [System.Text.Encoding]::UTF8)
    Write-Host "Reencoded: $path"
}

$htmlFiles = @(
    "pages\product.html",
    "pages\how-to-order.html",
    "pages\unique-luxury.html",
    "pages\register.html",
    "en\index.html",
    "fr\index.html"
)

foreach ($f in $htmlFiles) {
    # Only process if the mojibake marker bytes are present
    $bytes = [System.IO.File]::ReadAllBytes($f)
    # Look for C3 A2 (â in UTF-8) followed by E2 80 (start of â€)
    $hasMojibake = $false
    for ($i = 0; $i -lt $bytes.Length - 3; $i++) {
        if ($bytes[$i] -eq 0xC3 -and $bytes[$i+1] -eq 0xA2 -and $bytes[$i+2] -eq 0xE2) {
            $hasMojibake = $true; break
        }
    }
    if ($hasMojibake) {
        Fix-MojibakeFile $f
    } else {
        Write-Host "Clean: $f"
    }
}

