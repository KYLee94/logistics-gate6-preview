[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$PdfPath,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [int[]]$Pages,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$OutputDirectory,

  [ValidateRange(256, 4096)]
  [uint32]$Width = 2048,

  [ValidateRange(0, 4096)]
  [uint32]$Height = 0,

  [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')]
  [string]$Prefix = 'page'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-WinRtType {
  param([Parameter(Mandatory = $true)][string]$TypeName)
  return [Type]::GetType("$TypeName, ContentType=WindowsRuntime", $true)
}

function Get-AsyncTaskMethod {
  param([Parameter(Mandatory = $true)][bool]$Generic)
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -eq $Generic -and $_.GetParameters().Count -eq 1
  } | Select-Object -First 1
  if (-not $method) { throw 'Windows Runtime AsTask bridge is unavailable.' }
  return $method
}

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$storageFileType = Get-WinRtType 'Windows.Storage.StorageFile, Windows.Storage'
$pdfDocumentType = Get-WinRtType 'Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf'
$streamType = Get-WinRtType 'Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams'
$readerType = Get-WinRtType 'Windows.Storage.Streams.DataReader, Windows.Storage.Streams'
$renderOptionsType = Get-WinRtType 'Windows.Data.Pdf.PdfPageRenderOptions, Windows.Data.Pdf'
$asTaskGeneric = Get-AsyncTaskMethod $true
$asTaskAction = Get-AsyncTaskMethod $false

function Await-WinRt {
  param(
    [Parameter(Mandatory = $true)][object]$Operation,
    [Parameter(Mandatory = $true)][Type]$ResultType
  )
  $task = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}

function Await-WinRtAction {
  param([Parameter(Mandatory = $true)][object]$Operation)
  $task = $asTaskAction.Invoke($null, @($Operation))
  $task.Wait()
}

$resolvedPdfPath = [System.IO.Path]::GetFullPath($PdfPath)
$resolvedOutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null

$fileOperation = $storageFileType.GetMethod('GetFileFromPathAsync').Invoke($null, @($resolvedPdfPath))
$storageFile = Await-WinRt $fileOperation $storageFileType
$loadMethod = $pdfDocumentType.GetMethods() | Where-Object {
  $_.Name -eq 'LoadFromFileAsync' -and $_.GetParameters().Count -eq 1
} | Select-Object -First 1
if (-not $loadMethod) { throw 'PdfDocument.LoadFromFileAsync(file) is unavailable.' }
$document = Await-WinRt ($loadMethod.Invoke($null, @($storageFile))) $pdfDocumentType

$requestedPages = @($Pages | Sort-Object -Unique)
$invalidPages = @($requestedPages | Where-Object { $_ -lt 1 -or $_ -gt $document.PageCount })
if ($invalidPages.Count -gt 0) {
  throw "Requested page(s) are outside 1..$($document.PageCount): $($invalidPages -join ', ')."
}

$rendered = @()
foreach ($pageNumber in $requestedPages) {
  $page = $document.GetPage([uint32]($pageNumber - 1))
  $stream = [Activator]::CreateInstance($streamType)
  $options = [Activator]::CreateInstance($renderOptionsType)
  $options.DestinationWidth = $Width
  if ($Height -gt 0) { $options.DestinationHeight = $Height }

  Await-WinRtAction ($page.RenderToStreamAsync($stream, $options))
  $stream.Seek(0)
  $reader = [Activator]::CreateInstance($readerType, @($stream.GetInputStreamAt(0)))
  [void](Await-WinRt ($reader.LoadAsync([uint32]$stream.Size)) ([uint32]))
  $bytes = New-Object byte[] ([int]$stream.Size)
  $reader.ReadBytes($bytes)

  $outputPath = Join-Path $resolvedOutputDirectory ('{0}-{1:D3}.png' -f $Prefix, $pageNumber)
  [System.IO.File]::WriteAllBytes($outputPath, $bytes)
  $rendered += [pscustomobject]@{
    page_number = $pageNumber
    output_path = $outputPath
    byte_length = $bytes.Length
    source_width = [math]::Round($page.Size.Width, 2)
    source_height = [math]::Round($page.Size.Height, 2)
  }

  if ($reader -is [System.IDisposable]) { $reader.Dispose() }
  if ($stream -is [System.IDisposable]) { $stream.Dispose() }
  if ($page -is [System.IDisposable]) { $page.Dispose() }
}

[pscustomobject]@{
  ok = $true
  renderer = 'Windows.Data.Pdf'
  source_pdf = $resolvedPdfPath
  page_count = $document.PageCount
  rendered = $rendered
} | ConvertTo-Json -Depth 5
