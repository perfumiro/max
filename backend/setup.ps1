# IPORDISE Backend Setup Script
# Run this ONCE after installing Node.js: Right-click → Run with PowerShell
# Or from terminal: cd backend ; .\setup.ps1

Write-Host ""
Write-Host "=== IPORDISE Admin Backend Setup ===" -ForegroundColor Cyan
Write-Host ""

# Install dependencies
Write-Host "1. Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: npm install failed" -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }

Write-Host ""
Write-Host "2. Generate your admin password" -ForegroundColor Yellow
$password = Read-Host "   Enter the password you want to use for admin login (min 10 chars)"
if ($password.Length -lt 10) { Write-Host "ERROR: Password too short (min 10 chars)" -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }

$hash = node scripts/hash-password.js $password
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Could not hash password" -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }

# Update .env with the real hash
(Get-Content .env) -replace 'PASTE_YOUR_HASH_HERE', $hash | Set-Content .env
Write-Host "   Password hash saved to .env" -ForegroundColor Green

Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "To START the backend server, run:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Cyan
Write-Host "   npm start" -ForegroundColor Cyan
Write-Host ""
Write-Host "Then open: http://localhost:5050/admin.html" -ForegroundColor White
Write-Host ""
Write-Host "Login email:    admin@ipordise.com" -ForegroundColor White
Write-Host "Login password: (the one you just entered)" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
