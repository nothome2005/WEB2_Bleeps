from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

from PIL import Image
from transformers import BlipForConditionalGeneration, BlipProcessor
import torch


DEFAULT_MODEL = "Salesforce/blip-image-captioning-base"


def _pick_image_path(candidates: Iterable[str]) -> Path:
    cleaned: list[Path] = []
    for raw in candidates:
        token = raw.strip().strip("()")
        if not token:
            continue
        if token.startswith("http://_vscodecontentref_") or token.startswith("https://_vscodecontentref_"):
            continue
        cleaned.append(Path(token))

    for path in reversed(cleaned):
        if path.exists():
            return path

    if cleaned:
        return cleaned[-1]

    raise FileNotFoundError("Image path was not provided")


# Global cache for the model and processor
_model = None
_processor = None

def get_ai_model(model_name: str):
    global _model, _processor
    if _model is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[AI] Loading model {model_name} on {device}...")
        _processor = BlipProcessor.from_pretrained(model_name)
        _model = BlipForConditionalGeneration.from_pretrained(model_name).to(device)
        print("[AI] Model loaded successfully!")
    return _model, _processor

def generate_prompt(
    image_path: Path,
    model_name: str = DEFAULT_MODEL,
    max_new_tokens: int = 50,
    num_beams: int = 4,
) -> str:
    model, processor = get_ai_model(model_name)
    device = next(model.parameters()).device

    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt").to(device)

    with torch.no_grad():
        output_tokens = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            num_beams=num_beams,
            early_stopping=True,
        )

    caption = processor.decode(output_tokens[0], skip_special_tokens=True).strip()
    return caption


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a text prompt/caption from an image (baseline for Bleep idea)."
    )
    parser.add_argument(
        "image",
        nargs="+",
        help="Path to input image (extra args are tolerated; last valid path is used)",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help="Hugging Face model id (default: Salesforce/blip-image-captioning-base)",
    )
    parser.add_argument("--max-new-tokens", type=int, default=50)
    parser.add_argument("--num-beams", type=int, default=4)
    args = parser.parse_args()

    image_path = _pick_image_path(args.image)
    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    prompt = generate_prompt(
        image_path=image_path,
        model_name=args.model,
        max_new_tokens=args.max_new_tokens,
        num_beams=args.num_beams,
    )

    print("Generated prompt:")
    print(prompt)


if __name__ == "__main__":
    main()
