Set-Location "c:\Users\Ziko\Desktop\PERFUME IPORDISE SITE"

# Build replacement strings from char codes so the script file
# itself has no encoding dependency (pure ASCII source).

# mojibake for em-dash — (byte sequence E2 80 94 misread as CP1252)
$moji_emdash   = [string][char]0x00E2 + [char]0x20AC + [char]0x201D
$fix_emdash    = [string][char]0x2014

# mojibake for en-dash – (byte sequence E2 80 93 misread as CP1252)
$moji_endash   = [string][char]0x00E2 + [char]0x20AC + [char]0x201C
$fix_endash    = [string][char]0x2013

# mojibake for ellipsis ... (byte sequence E2 80 A6 misread as CP1252)
$moji_ellipsis = [string][char]0x00E2 + [char]0x20AC + [char]0x00A6
$fix_ellipsis  = [string][char]0x2026

# mojibake for e-grave (byte sequence C3 A8 misread as CP1252)
$moji_egrave   = [string][char]0x00C3 + [char]0x00A8
$fix_egrave    = [string][char]0x00E8

# mojibake for E-acute (byte sequence C3 89 misread as CP1252)
$moji_Eacute   = [string][char]0x00C3 + [char]0x2030
$fix_Eacute    = [string][char]0x00C9

# mojibake for e-acute (byte sequence C3 A9 misread as CP1252)
$moji_eacute   = [string][char]0x00C3 + [char]0x00A9
$fix_eacute    = [string][char]0x00E9

$enc = [System.Text.Encoding]::UTF8

$files = @(
    "pages\product.html",
    "pages\how-to-order.html",
    "pages\unique-luxury.html",
    "pages\register.html",
    "en\index.html",
    "fr\index.html"
)

foreach ($f in $files) {
    $before = [System.IO.File]::ReadAllText($f, $enc)
    $after  = $before
    $after  = $after.Replace($moji_emdash,   $fix_emdash)
    $after  = $after.Replace($moji_endash,   $fix_endash)
    $after  = $after.Replace($moji_ellipsis, $fix_ellipsis)
    $after  = $after.Replace($moji_egrave,   $fix_egrave)
    $after  = $after.Replace($moji_Eacute,   $fix_Eacute)
    $after  = $after.Replace($moji_eacute,   $fix_eacute)

    if ($after -ne $before) {
        [System.IO.File]::WriteAllText($f, $after, $enc)
        Write-Host "Fixed: $f"
    } else {
        Write-Host "No changes: $f"
    }
}

Write-Host "DONE"
