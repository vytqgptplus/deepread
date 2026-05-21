import os
from google import genai
from google.genai import types

# Gemini API key
api_key = os.environ.get("GEMINI_API_KEY", "")
if not api_key:
    print("ERROR: GEMINI_API_KEY not set")
    exit(1)

client = genai.Client(api_key=api_key)

# Enhanced prompt for DeepRead Follow Reading mode
prompt = """Split-screen web application UI mockup showing 'Follow Reading' mode for DeepRead AI book platform. Left panel: ChatGPT-style dark chat interface with AI response citing book passages. Right panel: Book PDF/EPUB reader showing book page with highlighted text matching the citation. Split screen layout, modern 2026 design aesthetic, professional interface design, ultra detailed, 4K quality"""

print("Generating image...")

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[prompt],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="4K"
        ),
    ),
)

# Save the image
output_path = r"c:\Users\MAY TINH KTECH\Documents\test\deepread\docs\ui-mockups\deepread-follow-reading.jpg"

for part in response.parts:
    if part.text:
        print(f"Text response: {part.text}")
    elif part.inline_data:
        image = part.as_image()
        image.save(output_path)
        print(f"Image saved to: {output_path}")

print("Done!")
