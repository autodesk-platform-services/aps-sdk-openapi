# Build a standalone Windows EXE using PyInstaller
param(
  [string]$Name = 'aps-run-all',
  [string]$Entry = 'scripts/run-all.py',
  [string]$OutDir = 'dist/windows'
)

Write-Host "Building EXE: $Name from $Entry"

# Ensure Python is available
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Error "python not found in PATH. Install Python 3.x and try again."; exit 1
}

python -m pip install --upgrade pip
python -m pip install pyinstaller --quiet

# Clean previous dist
if (Test-Path -Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Run PyInstaller
$pyiArgs = "--onefile --name $Name $Entry"
Write-Host "Running: pyinstaller $pyiArgs"
pyinstaller --onefile --name $Name $Entry

# Move produced exe to OutDir
$built = Join-Path -Path 'dist' -ChildPath "$Name.exe"
if (Test-Path -Path $built) {
  Move-Item -Force -Path $built -Destination (Join-Path $OutDir "$Name.exe")
  Write-Host "EXE available at $OutDir\$Name.exe"
  exit 0
} else {
  Write-Error "Failed to find built exe at $built"
  exit 2
}
