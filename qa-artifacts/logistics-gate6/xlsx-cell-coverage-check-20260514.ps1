$ErrorActionPreference = 'Stop'

$WorkbookPath = (Get-ChildItem -LiteralPath 'C:\Users\10524\Desktop\codex_realasset\Project\03_Logi_Leasing_Dashboard' -Filter '*260414*.xlsx' | Select-Object -First 1).FullName
if (-not $WorkbookPath) { throw 'Workbook not found: *260414*.xlsx' }
$OutDir = Join-Path (Get-Location) 'qa-artifacts\logistics-gate6\xlsx-cell-coverage-check-20260514'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$SupabaseCoverage = @(
  @{ expected_label = 'DB_일반'; cell_count = 6216; non_empty_count = 4909; formula_count = 763; max_row = 74; max_col = 84 }
  @{ expected_label = 'DB_히스토리 누적'; cell_count = 3382; non_empty_count = 2885; formula_count = 172; max_row = 178; max_col = 19 }
  @{ expected_label = 'Log'; cell_count = 518; non_empty_count = 321; formula_count = 0; max_row = 37; max_col = 14 }
  @{ expected_label = 'Meta_데이터 항목 설명'; cell_count = 3476; non_empty_count = 385; formula_count = 6; max_row = 79; max_col = 44 }
  @{ expected_label = '자산_담당자 연결'; cell_count = 160; non_empty_count = 127; formula_count = 0; max_row = 20; max_col = 8 }
)

function Convert-ColumnLetterToNumber([string]$letters) {
  $value = 0
  foreach ($char in $letters.ToUpperInvariant().ToCharArray()) {
    $value = ($value * 26) + ([int][char]$char - [int][char]'A' + 1)
  }
  return $value
}

function Get-CellParts([string]$a1) {
  if ($a1 -match '^([A-Z]+)([0-9]+)$') {
    return @{ col = Convert-ColumnLetterToNumber $Matches[1]; row = [int]$Matches[2] }
  }
  return $null
}

function Get-UsedRangeFromDimension([xml]$sheetXml) {
  $ref = $sheetXml.worksheet.dimension.ref
  if (-not $ref) { return $null }
  $parts = $ref -split ':'
  $start = Get-CellParts $parts[0]
  $end = if ($parts.Count -gt 1) { Get-CellParts $parts[1] } else { $start }
  if (-not $start -or -not $end) { return $null }
  return @{
    min_row = [Math]::Min($start.row, $end.row)
    max_row = [Math]::Max($start.row, $end.row)
    min_col = [Math]::Min($start.col, $end.col)
    max_col = [Math]::Max($start.col, $end.col)
  }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($WorkbookPath)
try {
  $workbookEntry = $zip.GetEntry('xl/workbook.xml')
  $relsEntry = $zip.GetEntry('xl/_rels/workbook.xml.rels')
  [xml]$workbookXml = [System.IO.StreamReader]::new($workbookEntry.Open()).ReadToEnd()
  [xml]$relsXml = [System.IO.StreamReader]::new($relsEntry.Open()).ReadToEnd()

  $relsById = @{}
  foreach ($rel in $relsXml.Relationships.Relationship) {
    $target = [string]$rel.Target
    if (-not $target.StartsWith('xl/')) { $target = "xl/$target" }
    $relsById[[string]$rel.Id] = $target
  }

  $results = @()
  $allSheetStats = @()
  foreach ($sheet in $workbookXml.workbook.sheets.sheet) {
    $sheetName = [string]$sheet.name
    $relId = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $entryPath = $relsById[$relId]
    $sheetEntry = $zip.GetEntry($entryPath)
    $sheetXmlText = [System.IO.StreamReader]::new($sheetEntry.Open()).ReadToEnd()
    [xml]$sheetXml = $sheetXmlText
    $range = Get-UsedRangeFromDimension $sheetXml
    $cells = @($sheetXml.worksheet.sheetData.row.c)
    $nonEmpty = 0
    $formula = 0
    foreach ($cell in $cells) {
      $hasFormula = $null -ne $cell.f
      $hasValue = $null -ne $cell.v -and [string]$cell.v -ne ''
      $hasInline = $null -ne $cell.is
      if ($hasFormula) { $formula += 1 }
      if ($hasFormula -or $hasValue -or $hasInline) { $nonEmpty += 1 }
    }
    $formulaXmlCount = ([regex]::Matches($sheetXmlText, '<x:f|<f')).Count
    if ($formulaXmlCount -gt $formula) { $formula = $formulaXmlCount }
    $cellCount = $range.max_row * $range.max_col
    $expected = $SupabaseCoverage | Where-Object {
      $_.max_row -eq $range.max_row -and $_.max_col -eq $range.max_col -and $_.non_empty_count -eq $nonEmpty -and $_.formula_count -eq $formula
    } | Select-Object -First 1
    $allSheetStats += [pscustomobject]@{
      sheet_name = $sheetName
      xlsx_cell_count = $cellCount
      xlsx_non_empty_count = $nonEmpty
      xlsx_formula_count = $formula
      max_row = $range.max_row
      max_col = $range.max_col
      matched_expected = if ($expected) { $expected.expected_label } else { '' }
    }
    if (-not $expected) { continue }
    $results += [pscustomobject]@{
      sheet_name = $sheetName
      expected_sheet_name = $expected.expected_label
      xlsx_cell_count = $cellCount
      supabase_cell_count = $expected.cell_count
      xlsx_non_empty_count = $nonEmpty
      supabase_non_empty_count = $expected.non_empty_count
      xlsx_formula_count = $formula
      supabase_formula_count = $expected.formula_count
      max_row = $range.max_row
      max_col = $range.max_col
      status = if ($cellCount -eq $expected.cell_count -and $nonEmpty -eq $expected.non_empty_count -and $formula -eq $expected.formula_count) { 'pass' } else { 'fail' }
    }
  }
} finally {
  $zip.Dispose()
}

$result = [pscustomobject]@{
  generated_at = (Get-Date).ToString('o')
  workbook = $WorkbookPath
  mutation_performed = $false
  sheet_count_checked = $results.Count
  all_pass = -not ($results | Where-Object { $_.status -ne 'pass' })
  rows = $results
  all_sheet_stats = $allSheetStats
}

$result | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $OutDir 'result.json') -Encoding UTF8
$lines = @(
  '# XLSX Cell Coverage Check - 2026-05-14'
  ''
  "- workbook: $WorkbookPath"
  "- mutation_performed: false"
  "- sheet_count_checked: $($results.Count)"
  "- all_pass: $($result.all_pass)"
  ''
  '| sheet | xlsx cells | Supabase cells | xlsx non-empty | Supabase non-empty | xlsx formulas | Supabase formulas | status |'
  '|---|---:|---:|---:|---:|---:|---:|---|'
)
foreach ($row in $results) {
  $lines += "| $($row.sheet_name) | $($row.xlsx_cell_count) | $($row.supabase_cell_count) | $($row.xlsx_non_empty_count) | $($row.supabase_non_empty_count) | $($row.xlsx_formula_count) | $($row.supabase_formula_count) | $($row.status) |"
}
$lines | Set-Content -Path (Join-Path $OutDir 'summary.md') -Encoding UTF8
$result | ConvertTo-Json -Depth 6
