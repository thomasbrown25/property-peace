[CmdletBinding()]
param(
    [Parameter()][string]$CommitMessage = "Deploy dev $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

. (Join-Path $PSScriptRoot 'scripts\deploy\Deploy.Common.ps1')

$initialized = $false
try {
    Initialize-Deployment -ExpectedBranch 'dev' | Out-Null
    $initialized = $true

    Write-Stage 'Commit local dev changes'
    $status = (Invoke-Native git @('status', '--porcelain') -CaptureOutput).Output
    if ($status) {
        Invoke-Native git @('add', '--all') | Out-Null
        # Local verification output and workstation-only agent guidance must
        # never become part of a deployment commit.
        Invoke-Native git @('reset', '--', '.build-check', 'AGENTS.md') | Out-Null
        $staged = (Invoke-Native git @('diff', '--cached', '--name-only') -CaptureOutput).Output
        if ($staged) {
            Invoke-Native git @('commit', '-m', $CommitMessage) | Out-Null
        }
        else {
            Write-Host 'No committable changes found (only excluded local build output exists).'
        }
    }
    else {
        Write-Host 'No uncommitted changes found.'
    }

    Write-Stage 'Refresh dev from origin'
    Invoke-Native git @('pull', '--rebase', 'origin', 'dev') | Out-Null

    Write-Stage 'Push dev'
    Invoke-Native git @('push', 'origin', 'dev') | Out-Null
    $headSha = Get-HeadSha
    Write-Host "dev is pushed at $headSha"

    Write-Stage 'Run unit tests and release builds'
    Invoke-ReleaseValidation -Branch 'dev' -HeadSha $headSha

    Write-Stage 'Deploy dev'
    Invoke-DeploymentWorkflows -Environment 'dev' -HeadSha $headSha

    Write-Host "`nDEV DEPLOYMENT SUCCEEDED" -ForegroundColor Green
    Write-Host "Commit: $headSha"
}
catch {
    Write-Host "`nDEV DEPLOYMENT FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
finally {
    if ($initialized) {
        Complete-Deployment
    }
}
