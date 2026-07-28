Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Stage {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Assert-Command {
    param([Parameter(Mandatory)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found. Install it and ensure it is on PATH."
    }
}

function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter()][string[]]$Arguments = @(),
        [switch]$AllowFailure,
        [switch]$CaptureOutput
    )

    # Git and other native tools may write non-fatal warnings to stderr while
    # still returning exit code 0. With the script-wide Stop preference,
    # PowerShell can promote that stderr output to a terminating ErrorRecord
    # before we get a chance to inspect LASTEXITCODE.
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'

        if ($CaptureOutput) {
            $output = & $Command @Arguments 2>&1 | Out-String
            $exitCode = $LASTEXITCODE
            if ($exitCode -ne 0 -and -not $AllowFailure) {
                throw "Command failed ($exitCode): $Command $($Arguments -join ' ')`n$output"
            }
            return [pscustomobject]@{ ExitCode = $exitCode; Output = $output.Trim() }
        }

        & $Command @Arguments 2>&1 | ForEach-Object { Write-Host $_ }
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0 -and -not $AllowFailure) {
            throw "Command failed ($exitCode): $Command $($Arguments -join ' ')"
        }
        return $exitCode
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Initialize-Deployment {
    param([Parameter(Mandatory)][string]$ExpectedBranch)

    Assert-Command git
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        throw "GitHub CLI ('gh') is required to dispatch and track pipelines. Install it with 'winget install --id GitHub.cli', restart PowerShell, then run 'gh auth login'."
    }

    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    Push-Location $repoRoot

    try {
        Invoke-Native gh @('auth', 'status') | Out-Null
        $insideRepo = Invoke-Native git @('rev-parse', '--is-inside-work-tree') -CaptureOutput
        if ($insideRepo.Output -ne 'true') {
            throw "$repoRoot is not a Git worktree."
        }

        $branch = (Invoke-Native git @('branch', '--show-current') -CaptureOutput).Output
        if ($branch -ne $ExpectedBranch) {
            throw "Run this script from the '$ExpectedBranch' branch. Current branch: '$branch'."
        }

        return $repoRoot
    }
    catch {
        Pop-Location
        throw
    }
}

function Complete-Deployment {
    Pop-Location
}

function Get-HeadSha {
    return (Invoke-Native git @('rev-parse', 'HEAD') -CaptureOutput).Output
}

function Start-GitHubWorkflow {
    param(
        [Parameter(Mandatory)][string]$Workflow,
        [Parameter(Mandatory)][string]$Branch,
        [Parameter(Mandatory)][string]$HeadSha
    )

    Write-Host "Dispatching $Workflow on $Branch..."
    $dispatchedAt = (Get-Date).ToUniversalTime().AddSeconds(-10)
    Invoke-Native gh @('workflow', 'run', $Workflow, '--ref', $Branch) | Out-Null

    $deadline = (Get-Date).AddMinutes(2)
    do {
        Start-Sleep -Seconds 3
        $result = Invoke-Native gh @(
            'run', 'list',
            '--workflow', $Workflow,
            '--branch', $Branch,
            '--event', 'workflow_dispatch',
            '--limit', '20',
            '--json', 'databaseId,headSha,status,conclusion,createdAt,url'
        ) -CaptureOutput

        $runs = @($result.Output | ConvertFrom-Json)
        $run = $runs |
            Where-Object {
                $_.headSha -eq $HeadSha -and
                ([datetime]$_.createdAt).ToUniversalTime() -ge $dispatchedAt
            } |
            Sort-Object { [datetime]$_.createdAt } -Descending |
            Select-Object -First 1
    } while (-not $run -and (Get-Date) -lt $deadline)

    if (-not $run) {
        throw "GitHub accepted $Workflow, but its run did not appear within two minutes."
    }

    Write-Host "Run: $($run.url)"
    return [pscustomobject]@{
        Workflow = $Workflow
        RunId = [string]$run.databaseId
        Url = [string]$run.url
    }
}

function Wait-GitHubWorkflow {
    param([Parameter(Mandatory)]$Run)

    Write-Stage "Tracking $($Run.Workflow)"
    $watchExitCode = Invoke-Native gh @('run', 'watch', $Run.RunId, '--exit-status', '--interval', '10') -AllowFailure

    $detailsResult = Invoke-Native gh @(
        'run', 'view', $Run.RunId,
        '--json', 'conclusion,jobs,url,workflowName'
    ) -CaptureOutput
    $details = $detailsResult.Output | ConvertFrom-Json

    Write-Host "`n$($details.workflowName)"
    foreach ($job in @($details.jobs)) {
        $jobStatus = if ($job.conclusion) { $job.conclusion.ToUpperInvariant() } else { $job.status.ToUpperInvariant() }
        Write-Host "  [$jobStatus] $($job.name)"
        foreach ($step in @($job.steps)) {
            $stepStatus = if ($step.conclusion) { $step.conclusion.ToUpperInvariant() } else { $step.status.ToUpperInvariant() }
            Write-Host "    [$stepStatus] $($step.name)"
        }
    }
    Write-Host "  $($details.url)"

    if ($watchExitCode -ne 0 -or $details.conclusion -ne 'success') {
        throw "$($Run.Workflow) failed. See $($details.url)"
    }
}

function Invoke-ReleaseValidation {
    param(
        [Parameter(Mandatory)][string]$Branch,
        [Parameter(Mandatory)][string]$HeadSha
    )

    $run = Start-GitHubWorkflow `
        -Workflow 'property-peace-release-validation.yml' `
        -Branch $Branch `
        -HeadSha $HeadSha
    Wait-GitHubWorkflow -Run $run
}

function Invoke-DeploymentWorkflows {
    param(
        [Parameter(Mandatory)][ValidateSet('dev', 'prod')][string]$Environment,
        [Parameter(Mandatory)][string]$HeadSha
    )

    $suffix = if ($Environment -eq 'dev') { '-dev' } else { '' }
    $workflows = @(
        "property-peace-api-deploy$suffix.yml",
        "property-peace-app-deploy$suffix.yml",
        "property-peace-marketing-deploy$suffix.yml"
    )

    $runs = foreach ($workflow in $workflows) {
        Start-GitHubWorkflow -Workflow $workflow -Branch $Environment -HeadSha $HeadSha
    }

    foreach ($run in $runs) {
        Wait-GitHubWorkflow -Run $run
    }
}
