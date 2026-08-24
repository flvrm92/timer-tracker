<#
.SYNOPSIS
    Signs a copy of the built MSIX with a self-signed certificate so it can be
    sideloaded for testing.

.DESCRIPTION
    Microsoft Store submissions must be UNSIGNED - the Store re-signs packages
    with its own certificate after certification, which is why forge.config.js
    sets `sign: false`. Windows will not install an unsigned MSIX locally,
    though, so this script produces a separate signed copy for testing and
    leaves the Store artifact untouched.

    The certificate subject must match the Publisher in the manifest exactly,
    so it is read from packaging/identity.json rather than being hardcoded.

    Requires the Windows SDK (for signtool.exe) and an elevated shell for the
    -Install step, which writes to LocalMachine\TrustedPeople.

.PARAMETER Install
    Also install the certificate into Cert:\LocalMachine\TrustedPeople and the
    signed package via Add-AppxPackage. Requires Administrator.

.EXAMPLE
    npm run make:msix
    pwsh -File scripts/sign-local.ps1 -Install
#>
[CmdletBinding()]
param(
    [string]$MsixPath,
    [switch]$Install
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

# Mirror forge.config.js: packaging/identity.local.json (gitignored, holds the
# real Partner Center values) overrides the tracked placeholders. The certificate
# subject has to match whichever Publisher ended up in the manifest.
$identity = Get-Content (Join-Path $repo 'packaging\identity.json') -Raw | ConvertFrom-Json
$localIdentity = Join-Path $repo 'packaging\identity.local.json'
if (Test-Path $localIdentity) {
    $overrides = Get-Content $localIdentity -Raw | ConvertFrom-Json
    foreach ($prop in $overrides.PSObject.Properties) {
        $identity | Add-Member -MemberType NoteProperty -Name $prop.Name -Value $prop.Value -Force
    }
    Write-Host 'Identity: packaging/identity.local.json overrides applied'
}
$subject = $identity.publisher
Write-Host "Publisher subject: $subject"

# Locate the built package if one was not named explicitly.
if (-not $MsixPath) {
    $found = Get-ChildItem (Join-Path $repo 'out\make\msix') -Recurse -Filter '*.msix' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike '*-signed.msix' } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $found) { throw "No .msix found under out\make\msix. Run 'npm run make:msix' first." }
    $MsixPath = $found.FullName
}
Write-Host "Package: $MsixPath"

# signtool ships with the Windows SDK; pick the newest installed copy.
$signtool = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
if (-not $signtool) { throw 'signtool.exe not found. Install the Windows SDK (winget install Microsoft.WindowsSDK.10.0.26100).' }

# Reuse an existing dev certificate for this subject so repeated runs do not
# pile up certificates, and so a previously trusted cert keeps working.
$cert = Get-ChildItem Cert:\CurrentUser\My |
    Where-Object { $_.Subject -eq $subject -and $_.NotAfter -gt (Get-Date) } |
    Sort-Object NotAfter -Descending | Select-Object -First 1

if (-not $cert) {
    Write-Host 'Creating a new self-signed certificate...'
    $cert = New-SelfSignedCertificate -Type Custom -Subject $subject `
        -KeyUsage DigitalSignature -FriendlyName 'Timer Tracker sideload (dev)' `
        -CertStoreLocation 'Cert:\CurrentUser\My' `
        -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
}
Write-Host "Certificate thumbprint: $($cert.Thumbprint)"

# Export the key to a temp file rather than into the repo tree, under a random
# password. A private key sitting in packaging/ is one `git add -f` (or one
# "zip up the project folder") away from disclosure, and a password published
# in this script protects nothing.
$pfx = Join-Path ([IO.Path]::GetTempPath()) "timer-tracker-devcert-$([guid]::NewGuid()).pfx"
$pfxBytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($pfxBytes)
$plainPassword = [Convert]::ToBase64String($pfxBytes)
$password = ConvertTo-SecureString -String $plainPassword -Force -AsPlainText

try {
    Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $password | Out-Null

    # Sign a copy so the Store artifact stays unsigned.
    $signed = [IO.Path]::ChangeExtension($MsixPath, $null).TrimEnd('.') + '-signed.msix'
    Copy-Item $MsixPath $signed -Force
    & $signtool.FullName sign /fd SHA256 /a /f $pfx /p $plainPassword $signed
    if ($LASTEXITCODE -ne 0) { throw "signtool failed with exit code $LASTEXITCODE" }

    Write-Host ''
    Write-Host "Signed package: $signed"

    if ($Install) {
        $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
            ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        if (-not $isAdmin) { throw '-Install needs an elevated shell (writes to LocalMachine\TrustedPeople).' }

        Import-PfxCertificate -FilePath $pfx -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople' -Password $password | Out-Null
        Add-AppxPackage -Path $signed
        Write-Host 'Installed. Look for "Timer Tracker" in the Start menu.'
    } else {
        Write-Host ''
        Write-Host 'To install, re-run this script from an elevated shell with -Install:'
        Write-Host '  pwsh -File scripts/sign-local.ps1 -Install'
        Write-Host ''
        Write-Host 'There is no manual import step to copy: the exported key is deleted when'
        Write-Host 'this script exits, and -Install re-exports it for the duration of the run.'
    }
}
finally {
    # The exported key must not outlive the run. The certificate itself stays in
    # Cert:\CurrentUser\My, so the next run reuses it without re-creating it.
    Remove-Item $pfx -Force -ErrorAction SilentlyContinue
}
