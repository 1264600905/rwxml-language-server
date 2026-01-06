# RimWorld XML Language Server 自动编译和打包脚本

$ErrorActionPreference = "Stop"

Write-Host ">>> 步骤 1/5: 编译 analyzer..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot/analyzer"
npx tsc -b
if ($LASTEXITCODE -ne 0) { Write-Error "analyzer 编译失败"; exit $LASTEXITCODE }

Write-Host "`n>>> 步骤 2/5: 编译 language-server..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot/language-server"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "language-server 编译失败"; exit $LASTEXITCODE }

Write-Host "`n>>> 步骤 3/5: 准备 vsc-extension..." -ForegroundColor Cyan
$vscDir = "$PSScriptRoot/vsc-extension"

# 复制 language-server 到 vsc-extension 内部
Write-Host ">>> 复制 language-server 到 vsc-extension/server-dist..." -ForegroundColor Gray
$serverDistTarget = "$vscDir/server-dist"
if (Test-Path $serverDistTarget) { Remove-Item -Recurse -Force $serverDistTarget }
Copy-Item -Path "$PSScriptRoot/language-server/dist" -Destination $serverDistTarget -Recurse -Force

# 修改 webpack 配置使用内部路径
$webpackConfig = "$vscDir/webpack.config.js"
$webpackConfigBackup = "$vscDir/webpack.config.js.bak"
if (!(Test-Path $webpackConfigBackup)) {
    Copy-Item -Path $webpackConfig -Destination $webpackConfigBackup -Force
}
(Get-Content $webpackConfigBackup) -replace "'\.\./language-server/dist/index\.js'", "'./server-dist/index.js'" | Set-Content $webpackConfig

# 复制提取器到 vsc-extension/bin
Write-Host ">>> 复制提取器到 vsc-extension/bin..." -ForegroundColor Gray
$vscBinDir = "$vscDir/bin"
if (!(Test-Path $vscBinDir)) { New-Item -ItemType Directory -Path $vscBinDir }
$extractorSrc = "$PSScriptRoot/extractor/extractor/bin/Debug/net472/*"
Copy-Item -Path $extractorSrc -Destination $vscBinDir -Recurse -Force

Write-Host "`n>>> 步骤 4/5: 编译 vsc-extension..." -ForegroundColor Cyan
Set-Location $vscDir
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "vsc-extension 编译失败"; exit $LASTEXITCODE }

Write-Host "`n>>> 步骤 5/5: 打包扩展..." -ForegroundColor Cyan
# 临时移动到独立目录避免打包父目录的 git 仓库
$tempDir = "$env:TEMP/rwxml-vsix-pack"
$packDir = "$tempDir/vsc-extension"

Write-Host ">>> 准备打包环境..." -ForegroundColor Gray
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Path $packDir -Force | Out-Null

# 只复制需要的文件到打包目录
Copy-Item -Path "$vscDir/package.json" -Destination $packDir -Force
Copy-Item -Path "$vscDir/LICENSE" -Destination "$packDir/LICENSE" -Force
Copy-Item -Path "$vscDir/dist" -Destination $packDir -Recurse -Force
Copy-Item -Path "$vscDir/bin" -Destination $packDir -Recurse -Force
Copy-Item -Path "$vscDir/server-dist" -Destination $packDir -Recurse -Force

# 在打包目录创建空的 .vscodeignore
"" | Out-File -FilePath "$packDir/.vscodeignore" -Encoding UTF8

# 在临时目录安装依赖（vsce 需要检查，虽然 webpack 已打包）
Set-Location $packDir
Write-Host ">>> 安装依赖（用于 vsce 检查）..." -ForegroundColor Gray
npm install --omit=dev --silent 2>$null | Out-Null

# 从临时目录打包
vsce package --allow-missing-repository
if ($LASTEXITCODE -ne 0) {
    Set-Location $PSScriptRoot
    Remove-Item -Recurse -Force $tempDir
    Write-Error "扩展打包失败"
    exit $LASTEXITCODE
}

# 移动打包好的文件到原始目录
$vsixFile = Get-ChildItem -Path "$packDir/*.vsix" | Select-Object -First 1
Move-Item -Path $vsixFile.FullName -Destination $vscDir -Force

# 清理临时目录
Set-Location $PSScriptRoot
Remove-Item -Recurse -Force $tempDir

Write-Host "`n[成功] 所有模块已完成编译和打包！" -ForegroundColor Green
Write-Host ">>> 扩展包位置: $vscDir/$($vsixFile.Name)" -ForegroundColor Green
