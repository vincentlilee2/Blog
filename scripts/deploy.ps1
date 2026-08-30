# ─────────────────────────────────────────────────────────────
# 记忆花园 (MemoryGarden) Blog 一键部署脚本（Windows / PowerShell）
#
# 多用户子站模式：每个人把自己的 Blog 构建后上传到服务器的专属子目录，
# 如 https://your-domain.com/wesley。无需登录注册，SSH key 即身份。
#
# 用法：
#   1. 把下面「配置区」改成你自己的（服务器、子站路径、SSH key）
#   2. 生成 SSH key 并把公钥交给管理员，授权到你的子目录
#   3. 在仓库根目录运行:  ./scripts/deploy.ps1
#   4. 首次部署后，日常更新 = 本地写文章 → 运行本脚本
#
# 前置：Windows 10 1803+（自带 tar / ssh / scp）；Node.js 20+
# ─────────────────────────────────────────────────────────────
param(
  [string]$Server    = "user@your-server.com",  # SSH 服务器（改成你自己的）
  [string]$RemoteDir = "/var/www/your-domain.com", # 站点根目录（服务器上）
  [string]$SubPath   = "/wesley",      # 你的子站路径（对应你的用户名）
  [string]$Domain    = "your-domain.com", # 域名（RSS 地址用）
  [string]$SshKey    = "$env:USERPROFILE\.ssh\id_ed25519" # 你的私钥
)

$ErrorActionPreference = "Stop"
$Repo = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent)   # scripts/ 的上两级 = 仓库根
Set-Location $Repo

Write-Host "`n📝 记忆花园 Blog 部署  (子站: $Domain$SubPath/)`n" -ForegroundColor Cyan

# 1. admin 后台媒体 URL 前缀（上传/预览用，自动生成配置）
$adminConf = Join-Path $Repo "admin\server-config.json"
if (-not (Test-Path $adminConf)) {
  Set-Content -Path $adminConf -Value "{`"publicBase`": `"$SubPath`"}" -Encoding UTF8 -NoNewline
  Write-Host "✓ 已生成 admin/server-config.json (publicBase=$SubPath)"
}

# 2. 构建线上版（注入域名 + 子站 base）
Write-Host "`n▶ 构建中… (base=$SubPath)"
$env:PUBLIC_SITE_URL = "https://$Domain"
$env:PUBLIC_BASE = $SubPath
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "✗ 构建失败" -ForegroundColor Red; exit 1 }
Write-Host "✓ 构建完成"

# 3. 打包并上传到服务器子目录（tar 管道 ssh，免装 rsync）
Write-Host "`n▶ 上传到 ${Server}:${RemoteDir}${SubPath}/"
$tmp = Join-Path $env:TEMP "blog-deploy.tar.gz"
tar -czf $tmp -C "dist" .
if (-not (Test-Path $SshKey)) { Write-Host "✗ SSH key 不存在: $SshKey" -ForegroundColor Red; exit 1 }
Get-Content $tmp -AsByteStream -ReadCount 65536 |
  & ssh -i $SshKey -o StrictHostKeyChecking=no $Server "mkdir -p ${RemoteDir}${SubPath} && tar -xzf - -C ${RemoteDir}${SubPath}"
if ($LASTEXITCODE -ne 0) { Remove-Item $tmp; Write-Host "✗ 上传失败" -ForegroundColor Red; exit 1 }
Remove-Item $tmp

Write-Host "`n✅ 已上线: https://$Domain$SubPath/`n" -ForegroundColor Green
