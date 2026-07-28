[CmdletBinding()]
param(
    [Parameter()][switch]$Force
)

. (Join-Path $PSScriptRoot 'scripts\deploy\Deploy.Common.ps1')

$initialized = $false
try {
    Initialize-Deployment -ExpectedBranch 'dev' | Out-Null
    $initialized = $true

    $dirty = (Invoke-Native git @('status', '--porcelain') -CaptureOutput).Output
    if ($dirty) {
        throw 'The worktree must be clean before a production deployment. Commit or stash the listed changes first.'
    }

    if (-not $Force) {
        $confirmation = Read-Host "This will merge dev into prod and deploy production. Type PROD to continue"
        if ($confirmation -cne 'PROD') {
            throw 'Production deployment cancelled.'
        }
    }

    Write-Stage 'Refresh dev from origin'
    Invoke-Native git @('fetch', 'origin', '--prune') | Out-Null
    Invoke-Native git @('pull', '--ff-only', 'origin', 'dev') | Out-Null
    $devSha = Get-HeadSha

    Write-Stage 'Validate dev before production merge'
    Invoke-ReleaseValidation -Branch 'dev' -HeadSha $devSha

    Write-Stage 'Refresh prod from origin'
    Invoke-Native git @('switch', 'prod') | Out-Null
    Invoke-Native git @('pull', '--ff-only', 'origin', 'prod') | Out-Null

    Write-Stage 'Merge dev into prod'
    Invoke-Native git @('merge', '--no-ff', 'dev', '-m', 'Merge dev into prod') | Out-Null
    $prodSha = Get-HeadSha

    Write-Stage 'Push prod'
    Invoke-Native git @('push', 'origin', 'prod') | Out-Null
    Write-Host "prod is pushed at $prodSha"

    Write-Stage 'Deploy production'
    Invoke-DeploymentWorkflows -Environment 'prod' -HeadSha $prodSha

    Write-Host "`nPRODUCTION DEPLOYMENT SUCCEEDED" -ForegroundColor Green
    Write-Host "Commit: $prodSha"
}
catch {
    Write-Host "`nPRODUCTION DEPLOYMENT FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
finally {
    if ($initialized) {
        try {
            $currentBranch = (Invoke-Native git @('branch', '--show-current') -CaptureOutput).Output
            if ($currentBranch -ne 'dev') {
                Invoke-Native git @('switch', 'dev') -AllowFailure | Out-Null
            }
        }
        finally {
            Complete-Deployment
        }
    }
}
