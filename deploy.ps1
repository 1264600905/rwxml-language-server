# RimWorld XML Language Server 自动编译脚本

$ErrorActionPreference = "Stop"

Write-Host ">>> 步骤 1/3: 编译 analyzer..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot/analyzer"
npx tsc -b
if ($LASTEXITCODE -ne 0) { Write-Error "analyzer 编译失败"; exit $LASTEXITCODE }

Write-Host "`n>>> 步骤 2/3: 编译 language-server..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot/language-server"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "language-server 编译失败"; exit $LASTEXITCODE }

Write-Host "`n>>> 步骤 3/3: 编译 vsc-extension..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot/vsc-extension"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "vsc-extension 编译失败"; exit $LASTEXITCODE }

Set-Location $PSScriptRoot
Write-Host "`n[成功] 所有模块已完成编译！" -ForegroundColor Green
