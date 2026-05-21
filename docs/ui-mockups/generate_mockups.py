#!/usr/bin/env python3
"""
Generate DeepRead UI Mockup Images using Gemini API
"""

import os
import sys

try:
    from google import genai
except ImportError:
    print("Installing google-genai...")
    os.system("pip install google-genai")
    from google import genai

# Prompts for different mockup variations
PROMPTS = {
    "dark": (
        "A professional web application UI mockup for 'DeepRead' - an AI-powered book reading platform, "
        "ChatGPT-style interface design. Dark theme with clean sidebar showing book library, main chat area "
        "with AI assistant discussing book content, modern minimal design, 2026 design aesthetic, "
        "screenshot of web application interface, ultra detailed, 4K quality"
    ),
    "light": (
        "A professional web application UI mockup for 'DeepRead' - an AI-powered book reading platform, "
        "ChatGPT-style interface design. Light theme with clean sidebar showing book library, main chat area "
        "with AI assistant discussing book content, modern minimal design, 2026 design aesthetic, "
        "screenshot of web application interface, ultra detailed, 4K quality"
    ),
    "split": (
        "A professional web application UI mockup for 'DeepRead' - an AI-powered book reading platform, "
        "ChatGPT-style interface design. Dark theme with split view showing book content panel on the left "
        "and AI chat assistant on the right, sidebar with book library, modern minimal design, "
        "2026 design aesthetic, screenshot of web application interface, ultra detailed, 4K quality"
    )
}

OUTPUT_DIR = r"c:\Users\MAY TINH KTECH\Documents\test\deepread\docs\ui-mockups"
OUTPUT_FILES = {
    "dark": "deepread-main-chat.jpg",
    "light": "deepread-light-theme.jpg",
    "split": "deepread-split-view.jpg"
}

def generate_image(client, prompt: str, output_path: str) -> bool:
    """Generate and save a single image."""
    print(f"\nGenerating: {os.path.basename(output_path)}")
    print(f"Prompt: {prompt[:100]}...")
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash-preview-image-generation",
            contents=prompt,
            config={"response_modalities": ["image", "text"]}
        )
        
        # Find the image part
        for part in response.candidates[0].content.parts:
            if hasattr(part, 'image') and part.image is not None:
                # Save as JPEG
                image_bytes = part.image
                with open(output_path, 'wb') as f:
                    f.write(image_bytes)
                print(f"[OK] Saved to: {output_path}")
                return True
        
        print(f"[FAIL] No image in response")
        return False
        
    except Exception as e:
        print(f"[FAIL] Error: {e}")
        return False

def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    # Try to get from .env file (check multiple locations)
    env_locations = [
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        r"c:\Users\MAY TINH KTECH\Documents\test\deepread\.env"
    ]
    
    for env_path in env_locations:
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY=") and "=" in line[14:]:
                        api_key = line.split("=", 1)[1].strip()
                        if api_key and api_key != "your_actual_gemini_api_key_here":
                            break
    
    if not api_key or api_key == "your_actual_gemini_api_key_here":
        print("Error: GEMINI_API_KEY not found!")
        print("Please set your API key:")
        print("  Windows: set GEMINI_API_KEY=your_key")
        print("  Or create .env file with GEMINI_API_KEY=your_key")
        sys.exit(1)
    
    # Initialize client
    client = genai.Client(api_key=api_key)
    
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("=" * 60)
    print("DeepRead UI Mockup Generator")
    print("=" * 60)
    
    results = {}
    for variant, filename in OUTPUT_FILES.items():
        output_path = os.path.join(OUTPUT_DIR, filename)
        results[variant] = generate_image(client, PROMPTS[variant], output_path)
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for variant, success in results.items():
        status = "[OK]" if success else "[FAIL]"
        print(f"  {variant}: {status}")

if __name__ == "__main__":
    main()
