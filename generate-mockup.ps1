# Load .env file
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
        }
    }
}

$apiKey = $env:GEMINI_API_KEY
if ([string]::IsNullOrEmpty($apiKey) -or $apiKey -eq "your-gemini-api-key-here") {
    Write-Host "ERROR: GEMINI_API_KEY is not set in .env file"
    Write-Host "Please get your API key from https://aistudio.google.com/apikey"
    exit 1
}

$prompt = @"
Book library interface mockup for DeepRead AI reading platform, ChatGPT 2026 dark theme style. Grid layout showing book covers with titles, upload section with drag and drop zone for PDF EPUB files, modern minimal web design, professional interface, ultra detailed, 4K quality
"@

$requestBody = @{
    contents = @(
        @{
            parts = @(
                @{ text = $prompt }
            )
        }
    )
    model = "imagen-3.0-generate-002"
    requestOptions = @{
        temperature = 1
        sampleCount = 1
    }
} | ConvertTo-Json -Depth 10

$headers = @{
    "Content-Type" = "application/json"
}

$url = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=$apiKey"

Write-Host "Calling Gemini API for image generation..."

$response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $requestBody -ContentType "application/json"

if ($response.predictions -and $response.predictions[0].bytesBase64Encoded) {
    $base64Image = $response.predictions[0].bytesBase64Encoded
    $imageBytes = [Convert]::FromBase64String($base64Image)

    $outputPath = Join-Path $PSScriptRoot "docs\ui-mockups\deepread-book-library.jpg"
    [IO.File]::WriteAllBytes($outputPath, $imageBytes)

    Write-Host "SUCCESS: Image saved to $outputPath"
    Write-Host "File size: $([math]::Round($imageBytes.Length / 1KB, 2)) KB"
} else {
    Write-Host "Response: $($response | ConvertTo-Json -Depth 5)"
    Write-Host "ERROR: No image data in response"
}
