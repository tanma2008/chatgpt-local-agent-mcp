# AI Commander - Windows Report Popup Script
# Floating status card reporter for AI Commander / Hermes tasks on Windows.

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("RUNNING", "PROGRESS", "COMPLETED", "ERROR")]
    [string]$Status,

    [Parameter(Mandatory=$true, Position=1)]
    [string]$Title,

    [Parameter(Position=2)]
    [string]$Message = "",

    [int]$Percent = -1,

    [int]$TimeoutSeconds = 5,

    [switch]$Async
)

$ErrorActionPreference = "Stop"

if ($Async) {
    # Re-launch in detached background powershell process
    $psPath = (Get-Command powershell.exe).Source
    $scriptPath = $MyInvocation.MyCommand.Path
    
    $argList = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$scriptPath`"",
        "-Status", "`"$Status`"",
        "-Title", "`"$Title`"",
        "-Message", "`"$Message`"",
        "-Percent", $Percent,
        "-TimeoutSeconds", $TimeoutSeconds
    )
    
    Start-Process -FilePath $psPath -ArgumentList $argList -WindowStyle Hidden
    Write-Host "[WindowsReporter] Launched async status card popup for status '$Status'"
    exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Color themes & badge settings
switch ($Status) {
    "RUNNING" {
        $bgColor = [System.Drawing.Color]::FromArgb(24, 32, 47)
        $accentColor = [System.Drawing.Color]::FromArgb(0, 150, 255)
        $badgeText = "RUNNING"
    }
    "PROGRESS" {
        $bgColor = [System.Drawing.Color]::FromArgb(35, 30, 20)
        $accentColor = [System.Drawing.Color]::FromArgb(255, 170, 0)
        $badgeText = "PROGRESS"
    }
    "COMPLETED" {
        $bgColor = [System.Drawing.Color]::FromArgb(20, 38, 25)
        $accentColor = [System.Drawing.Color]::FromArgb(40, 200, 100)
        $badgeText = "COMPLETED"
    }
    "ERROR" {
        $bgColor = [System.Drawing.Color]::FromArgb(40, 20, 24)
        $accentColor = [System.Drawing.Color]::FromArgb(255, 60, 70)
        $badgeText = "ERROR"
    }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "AI Commander Status"
$form.Size = New-Object System.Drawing.Size(440, 150)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$form.BackColor = $bgColor
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$form.TopMost = $true
$form.ShowInTaskbar = $false

# Position at Bottom-Right of Primary Screen
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$form.Location = New-Object System.Drawing.Point(($screen.Right - 450), ($screen.Bottom - 160))

# Accent bar on left
$accentPanel = New-Object System.Windows.Forms.Panel
$accentPanel.Size = New-Object System.Drawing.Size(6, 150)
$accentPanel.Location = New-Object System.Drawing.Point(0, 0)
$accentPanel.BackColor = $accentColor
$form.Controls.Add($accentPanel)

# Status Badge Label
$badgeLabel = New-Object System.Windows.Forms.Label
$badgeLabel.Text = "  $badgeText  "
$badgeLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$badgeLabel.ForeColor = [System.Drawing.Color]::White
$badgeLabel.BackColor = $accentColor
$badgeLabel.AutoSize = $true
$badgeLabel.Location = New-Object System.Drawing.Point(20, 14)
$form.Controls.Add($badgeLabel)

# Title Label
$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = $Title
$titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = [System.Drawing.Color]::White
$titleLabel.Location = New-Object System.Drawing.Point(120, 12)
$titleLabel.Size = New-Object System.Drawing.Size(295, 26)
$form.Controls.Add($titleLabel)

# Detail Message Label
$msgLabel = New-Object System.Windows.Forms.Label
$msgLabel.Text = $Message
$msgLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
$msgLabel.ForeColor = [System.Drawing.Color]::FromArgb(210, 215, 225)
$msgLabel.Location = New-Object System.Drawing.Point(20, 46)
$msgLabel.Size = New-Object System.Drawing.Size(395, 42)
$form.Controls.Add($msgLabel)

# Progress bar if PROGRESS or Percent >= 0
if ($Status -eq "PROGRESS" -or $Percent -ge 0) {
    $pBar = New-Object System.Windows.Forms.ProgressBar
    $pBar.Location = New-Object System.Drawing.Point(20, 96)
    $pBar.Size = New-Object System.Drawing.Size(395, 12)
    $pBar.Style = [System.Windows.Forms.ProgressBarStyle]::Blocks
    $val = [Math]::Max(0, [Math]::Min(100, $Percent))
    $pBar.Value = $val
    $form.Controls.Add($pBar)
    
    # Progress text
    $pctLabel = New-Object System.Windows.Forms.Label
    $pctLabel.Text = "$val%"
    $pctLabel.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
    $pctLabel.ForeColor = [System.Drawing.Color]::FromArgb(180, 185, 195)
    $pctLabel.Location = New-Object System.Drawing.Point(20, 114)
    $pctLabel.Size = New-Object System.Drawing.Size(60, 20)
    $form.Controls.Add($pctLabel)
} else {
    # Footer timestamp
    $timeLabel = New-Object System.Windows.Forms.Label
    $timeLabel.Text = (Get-Date -Format "HH:mm:ss")
    $timeLabel.Font = New-Object System.Drawing.Font("Segoe UI", 8)
    $timeLabel.ForeColor = [System.Drawing.Color]::FromArgb(140, 145, 155)
    $timeLabel.Location = New-Object System.Drawing.Point(20, 118)
    $timeLabel.Size = New-Object System.Drawing.Size(200, 20)
    $form.Controls.Add($timeLabel)
}

# Auto-close Timer
if ($TimeoutSeconds -gt 0) {
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = ($TimeoutSeconds * 1000)
    $timer.Add_Tick({
        $form.Close()
    })
    $timer.Start()
}

# Click to close on any UI component
$closeAction = { $form.Close() }
$form.Add_Click($closeAction)
$badgeLabel.Add_Click($closeAction)
$titleLabel.Add_Click($closeAction)
$msgLabel.Add_Click($closeAction)

[void]$form.ShowDialog()
