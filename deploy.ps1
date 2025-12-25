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

# 在编译插件前，确保提取器已拷贝到插件内部的 bin 目录
$vscBinDir = "$PSScriptRoot/vsc-extension/bin"
if (!(Test-Path $vscBinDir)) { New-Item -ItemType Directory -Path $vscBinDir }
$extractorSrc = "$PSScriptRoot/extractor/extractor/bin/Debug/net472/*"
Write-Host ">>> 正在同步提取器到插件目录..." -ForegroundColor Gray
Copy-Item -Path $extractorSrc -Destination $vscBinDir -Recurse -Force

npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "vsc-extension 编译失败"; exit $LASTEXITCODE }

Set-Location $PSScriptRoot
Write-Host "`n[成功] 所有模块已完成编译！" -ForegroundColor Green
