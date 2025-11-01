# Script para Verificar Versión del Repositorio
# Job Platform - Frontend y Backend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICACIÓN DE VERSIÓN - PLATFORM   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Repositorio
Write-Host "📦 REPOSITORIO:" -ForegroundColor Yellow
git remote -v
Write-Host ""

# Branch actual
Write-Host "🌿 BRANCH ACTUAL:" -ForegroundColor Yellow
$branch = git branch --show-current
Write-Host "Branch: $branch" -ForegroundColor Green
Write-Host ""

# FRONTEND
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "  FRONTEND (Platform Dashboard)         " -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host ""

Set-Location frontend
Write-Host "📝 ÚLTIMO COMMIT (Frontend):" -ForegroundColor Yellow
git log -1 --format="SHA: %H%nAutor: %an%nFecha: %ad%nMensaje: %s" --date=format:"%Y-%m-%d %H:%M:%S"
Write-Host ""
Write-Host "📊 ESTADO:" -ForegroundColor Yellow
git status --short
Write-Host ""
Set-Location ..

# BACKEND
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "  BACKEND (API)                         " -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host ""

Set-Location backend
Write-Host "📝 ÚLTIMO COMMIT (Backend):" -ForegroundColor Yellow
git log -1 --format="SHA: %H%nAutor: %an%nFecha: %ad%nMensaje: %s" --date=format:"%Y-%m-%d %H:%M:%S"
Write-Host ""
Write-Host "📊 ESTADO:" -ForegroundColor Yellow
git status --short
Write-Host ""
Set-Location ..

# Verificar commits sin push (desde root)
Write-Host "🔄 COMMITS SIN PUSH (Repositorio completo):" -ForegroundColor Yellow
try {
    git fetch origin 2>&1 | Out-Null
    $unpushed = git log origin/$branch..HEAD --oneline
    if ($unpushed) {
        Write-Host "⚠️  Hay commits locales sin push:" -ForegroundColor Red
        $unpushed
    } else {
        Write-Host "✅ Todo sincronizado con remoto" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  No se pudo verificar remoto" -ForegroundColor Yellow
}
Write-Host ""

# URL del repositorio
Write-Host "🔗 VERIFICAR EN GITHUB:" -ForegroundColor Yellow
$remoteUrl = (git remote get-url origin)
$githubUrl = $remoteUrl -replace '\.git$', '' -replace 'git@github\.com:', 'https://github.com/' -replace 'https://github\.com/', 'https://github.com/'
Write-Host "GitHub: $githubUrl" -ForegroundColor Cyan
Write-Host "Último commit: $githubUrl/commit/$(git rev-parse HEAD)" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICACIÓN COMPLETADA              " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

