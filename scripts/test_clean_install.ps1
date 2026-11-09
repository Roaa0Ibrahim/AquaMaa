# Tests that requirements.txt installs on a clean machine: creates a fresh, empty environment in
# a temporary folder, installs the packages, checks for conflicts, then runs check_setup.py and the
# tools self-test with it. Your own .venv is not touched.
#
# Run from the project folder:   powershell -ExecutionPolicy Bypass -File scripts\test_clean_install.ps1
# Optional: give a Python 3.13 path:  ... -File scripts\test_clean_install.ps1 C:\path\to\python.exe

param([string]$Python = "py")

$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $env:TEMP "aquamaa-clean-venv"

Write-Host "1. Creating an empty environment in $venv"
if (Test-Path $venv) { Remove-Item -Recurse -Force $venv }
if ($Python -eq "py") { & py -3.13 -m venv $venv } else { & $Python -m venv $venv }
$clean = Join-Path $venv "Scripts\python.exe"

Write-Host "2. Installing requirements.txt"
& $clean -m pip install -q -r (Join-Path $project "requirements.txt")

Write-Host "3. Checking for conflicts between packages"
& $clean -m pip check

Write-Host "4. Running check_setup.py with the clean environment"
Push-Location $project
& $clean check_setup.py

Write-Host "5. Running the tools self-test with the clean environment"
& $clean tools.py
Pop-Location

Write-Host "Done. The temporary environment is in $venv; delete it when finished."
