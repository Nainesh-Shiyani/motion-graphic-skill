# Installs the web-motion-graphics skill for the AI coding tools on this machine (Windows PowerShell 5.1+ / PowerShell 7).
#
#   .\install.ps1                        install for every supported tool (default)
#   .\install.ps1 -Targets claude,agents only some targets
#   .\install.ps1 -Uninstall             remove it everywhere
# If Windows says running scripts is disabled:
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 [-Targets claude,agents] [-Uninstall]
#
# Without cloning:
#   irm https://raw.githubusercontent.com/Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude/main/install.ps1 | iex
#
# Targets:
#   claude       ~\.claude\skills               Claude Code (terminal + desktop app); Cursor also reads it
#   agents       ~\.agents\skills               OpenAI Codex, Gemini CLI, GitHub Copilot, Cursor
#   antigravity  ~\.gemini\config\skills        Google Antigravity (IDE), and ~\.gemini\antigravity-cli\skills (CLI)
# Claude.ai and ChatGPT: upload dist\web-motion-graphics.zip in their Skills settings instead.
param(
  [string[]]$Targets = @('claude', 'agents', 'antigravity'),
  [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
# powershell -File passes "claude,agents" as one string, so split it here
$Targets = @($Targets | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$Repo = 'Nainesh-Shiyani/motion-graphic-skill-for-website-creation-using-claude'
$Name = 'web-motion-graphics'
$HomeDir = [Environment]::GetFolderPath('UserProfile')

function Get-TargetDirs([string]$t) {
  switch ($t) {
    'claude' { @(Join-Path $HomeDir '.claude\skills') }
    'agents' { @(Join-Path $HomeDir '.agents\skills') }
    'antigravity' {
      $list = @(Join-Path $HomeDir '.gemini\config\skills')
      if (Test-Path (Join-Path $HomeDir '.gemini\antigravity-cli')) { $list += (Join-Path $HomeDir '.gemini\antigravity-cli\skills') }
      $list
    }
    default { throw "unknown target '$t' (use claude, agents, antigravity)" }
  }
}

if ($Uninstall) {
  foreach ($t in $Targets) {
    foreach ($d in (Get-TargetDirs $t)) {
      $p = Join-Path $d $Name
      if (Test-Path $p) { Remove-Item $p -Recurse -Force; Write-Host "removed $p" }
    }
  }
  return
}

# find the skill: next to this script (cloned repo) or download the latest version
$src = $null
if ($PSScriptRoot) { $src = Join-Path $PSScriptRoot "skills\$Name" }
$tmp = $null
if (-not $src -or -not (Test-Path (Join-Path $src 'SKILL.md'))) {
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("mk-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  $zip = Join-Path $tmp 'repo.zip'
  Write-Host "downloading $Repo ..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/archive/refs/heads/main.zip" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $found = Get-ChildItem -Path $tmp -Directory -Recurse -Filter $Name | Where-Object { Test-Path (Join-Path $_.FullName 'SKILL.md') } | Select-Object -First 1
  if (-not $found) { throw "could not find skills\$Name in the download" }
  $src = $found.FullName
}

foreach ($t in $Targets) {
  if ($t -eq 'antigravity' -and -not (Test-Path (Join-Path $HomeDir '.gemini'))) { Write-Host 'skipped antigravity (~\.gemini not found)'; continue }
  foreach ($d in (Get-TargetDirs $t)) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
    $dest = Join-Path $d $Name
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    Copy-Item -Path $src -Destination $dest -Recurse
    Write-Host "installed $dest"
  }
}
if ($tmp) { Remove-Item $tmp -Recurse -Force }
Write-Host 'done - start a new session of your AI tool and ask it to build a website.'
