#!/usr/bin/env python3
"""Generates lib/xaero/colors.json - the block + biome color tables used by the
in-browser Xaero region renderer (lib/xaero/render.ts).

For every vanilla block(state) it averages the block model's top-face texture
into one RGBA color and records the model's tint index; for every biome it
computes the grass/foliage/dry-foliage tints from the colormap textures (or the
biome's explicit overrides) plus the water color. This mirrors what the mod
itself does closely enough that the assembled web map reads like the in-game one.

The vanilla client jar is downloaded from Mojang's official piston-meta API and
cached in the system temp dir; nothing but the JSON output touches the repo.

Usage:  python scripts/generate-xaero-colors.py [--version 1.21.11]
        (no --version = latest release)
Needs:  Python 3.10+ and Pillow (pip install Pillow)
Rerun:  whenever the server's Minecraft version adds new blocks/biomes.
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
CACHE = Path(tempfile.gettempdir()) / "xaero-colors-cache"
OUT = Path(__file__).resolve().parent.parent / "lib" / "xaero" / "colors.json"


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url) as res:
        return res.read()


def get_client_jar(version: str | None) -> tuple[str, zipfile.ZipFile]:
    CACHE.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(fetch(MANIFEST_URL))
    if version is None:
        version = manifest["latest"]["release"]
    entry = next((v for v in manifest["versions"] if v["id"] == version), None)
    if entry is None:
        sys.exit(f"Unknown Minecraft version: {version}")
    jar_path = CACHE / f"client-{version}.jar"
    if not jar_path.exists():
        print(f"Downloading client jar for {version} (~30 MB)...")
        package = json.loads(fetch(entry["url"]))
        jar_path.write_bytes(fetch(package["downloads"]["client"]["url"]))
    return version, zipfile.ZipFile(jar_path)


# ---------------------------------------------------------------- jar helpers

JAR: zipfile.ZipFile
JSON_CACHE: dict[str, dict | None] = {}
TEX_CACHE: dict[str, Image.Image | None] = {}


def jar_json(path: str) -> dict | None:
    if path not in JSON_CACHE:
        try:
            JSON_CACHE[path] = json.loads(JAR.read(path))
        except KeyError:
            JSON_CACHE[path] = None
    return JSON_CACHE[path]


def strip_ns(name: str) -> str:
    return name.split(":", 1)[-1]


def load_model(name: str) -> dict | None:
    # "minecraft:block/cube_all" -> assets/minecraft/models/block/cube_all.json
    rel = strip_ns(name)
    if not rel.startswith("block/"):
        rel = "block/" + rel.split("/")[-1]
    return jar_json(f"assets/minecraft/models/{rel}.json")


def load_texture(ref: str) -> Image.Image | None:
    rel = strip_ns(ref)
    if "/" not in rel:
        rel = "block/" + rel
    path = f"assets/minecraft/textures/{rel}.png"
    if path not in TEX_CACHE:
        try:
            TEX_CACHE[path] = Image.open(io.BytesIO(JAR.read(path))).convert("RGBA")
        except KeyError:
            TEX_CACHE[path] = None
    return TEX_CACHE[path]


# ------------------------------------------------------------- model -> color


def resolve_inheritance(model: dict) -> dict:
    resolved = dict(model)
    parent_name = model.get("parent")
    if parent_name and not parent_name.startswith("builtin/"):
        parent = load_model(parent_name)
        if parent:
            parent = resolve_inheritance(parent)
            for key, value in parent.items():
                if key not in resolved:
                    resolved[key] = value
                elif key == "textures" and isinstance(value, dict):
                    merged = dict(value)
                    merged.update(resolved[key])
                    resolved[key] = merged
    return resolved


def resolve_texture_ref(ref, textures: dict) -> str | None:
    for _ in range(8):  # follow "#top" style indirections
        if not isinstance(ref, str):
            return None  # newer asset formats allow non-string refs; skip those
        ref = ref.lstrip("#")
        if ref in textures:
            ref = textures[ref]
        else:
            return ref
    return None


def find_first_tag(data, key):
    if isinstance(data, dict):
        if key in data:
            return data[key]
        for value in data.values():
            found = find_first_tag(value, key)
            if found is not None:
                return found
    elif isinstance(data, list):
        for item in data:
            found = find_first_tag(item, key)
            if found is not None:
                return found
    return None


def get_top_texture_key(textures: dict) -> str | None:
    for key in ("up", "top", "end", "all", "side", "particle", "cross"):
        if key in textures:
            return key
    return None


def crop_uv(texture: Image.Image, uv) -> Image.Image:
    if not uv or len(uv) != 4:
        return texture
    w, h = texture.size
    xs = sorted((int(uv[0] * w / 16), int(uv[2] * w / 16)))
    ys = sorted((int(uv[1] * h / 16), int(uv[3] * h / 16)))
    if xs[1] <= xs[0] or ys[1] <= ys[0]:
        return texture
    return texture.crop((xs[0], ys[0], xs[1], ys[1]))


def model_top_color(model_name: str) -> tuple[list[int], int] | None:
    """Average color of the model's top face + its tint index."""
    model = load_model(model_name)
    if model is None:
        return None
    model = resolve_inheritance(model)

    tint = find_first_tag(model, "tintindex")
    tint = -1 if tint is None else int(tint)

    textures = model.get("textures", {})
    image: Image.Image | None = None

    if "elements" in model:
        canvas = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        found = False
        for element in model["elements"]:
            face = element.get("faces", {}).get("up")
            if not face:
                continue
            ref = resolve_texture_ref(face.get("texture", ""), textures)
            if not ref:
                continue
            texture = load_texture(ref)
            if texture is None:
                continue
            cropped = crop_uv(texture, face.get("uv", [0, 0, 16, 16]))
            fr, to = element.get("from", [0, 0, 0]), element.get("to", [16, 16, 16])
            x1, z1, x2, z2 = int(fr[0]), int(fr[2]), int(to[0]), int(to[2])
            if x2 > x1 and z2 > z1:
                resized = cropped.resize((x2 - x1, z2 - z1))
                canvas.paste(resized, (x1, z1), resized)
                found = True
        if found:
            image = canvas

    if image is None:
        key = get_top_texture_key(textures)
        if key is None:
            return None
        ref = resolve_texture_ref(textures[key], textures)
        if ref is None:
            return None
        image = load_texture(ref)
        if image is None:
            return None

    r = g = b = a = n = 0
    for pr, pg, pb, pa in image.getdata():
        if pa > 0:
            r, g, b, a, n = r + pr, g + pg, b + pb, a + pa, n + 1
    if n == 0:
        return None
    return [r // n, g // n, b // n, a // n], tint


def variant_models(blockstate: dict) -> dict[str, str] | None:
    """Map of variant key ("" or "snowy=true") -> model name."""

    def model_of(value) -> str:
        return (value[0] if isinstance(value, list) else value)["model"]

    if "variants" in blockstate:
        variants = blockstate["variants"]
        if "" in variants:
            return {"": model_of(variants[""])}
        return {key: model_of(value) for key, value in variants.items()}
    if "multipart" in blockstate:
        parts = blockstate["multipart"]
        part = next((p for p in parts if "when" not in p), parts[0] if parts else None)
        if part:
            return {"": model_of(part["apply"])}
    return None


def generate_blocks() -> dict:
    out: dict[str, object] = {}
    names = sorted(
        info.filename.split("/")[-1].removesuffix(".json")
        for info in JAR.infolist()
        if info.filename.startswith("assets/minecraft/blockstates/")
        and info.filename.endswith(".json")
    )
    for name in names:
        blockstate = jar_json(f"assets/minecraft/blockstates/{name}.json")
        if not blockstate:
            continue
        models = variant_models(blockstate)
        if not models:
            continue
        entries: dict[str, list[int]] = {}
        for key, model_name in models.items():
            result = model_top_color(model_name)
            if result is None:
                continue
            color, tint = result
            entries[key] = color + [tint]
        if not entries:
            continue
        distinct = {tuple(v) for v in entries.values()}
        if len(distinct) == 1:
            out[name] = next(iter(entries.values()))
        else:
            out[name] = entries
    return out


# -------------------------------------------------------------------- biomes


def parse_color(value) -> list[int]:
    value = int(value[1:], 16) if isinstance(value, str) else int(value)
    return [(value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF]


def colormap_pixel(image: Image.Image | None, temperature: float, downfall: float) -> list[int]:
    if image is None:
        return [127, 178, 56]
    t = min(max(temperature, 0.0), 1.0)
    h = (1.0 - min(max(downfall, 0.0), 1.0) * t) * 255
    x = min(int((1.0 - t) * 255), image.width - 1)
    y = min(int(h), image.height - 1)
    p = image.getpixel((x, y))
    return [p[0], p[1], p[2]]


def generate_biomes() -> dict:
    grass_map = load_texture("colormap/grass")
    foliage_map = load_texture("colormap/foliage")
    dry_map = load_texture("colormap/dry_foliage") or foliage_map

    out: dict[str, list[list[int]]] = {}
    prefix = "data/minecraft/worldgen/biome/"
    for info in sorted(JAR.infolist(), key=lambda i: i.filename):
        if not info.filename.startswith(prefix) or not info.filename.endswith(".json"):
            continue
        name = info.filename[len(prefix):].removesuffix(".json")
        biome = jar_json(info.filename)
        if not biome:
            continue
        effects = biome.get("effects", {})
        temperature = float(biome.get("temperature", 0.5))
        downfall = float(biome.get("downfall", 0.5))

        grass = (
            parse_color(effects["grass_color"])
            if "grass_color" in effects
            else colormap_pixel(grass_map, temperature, downfall)
        )
        foliage = (
            parse_color(effects["foliage_color"])
            if "foliage_color" in effects
            else colormap_pixel(foliage_map, temperature, downfall)
        )
        dry = (
            parse_color(effects["dry_foliage_color"])
            if "dry_foliage_color" in effects
            else colormap_pixel(dry_map, temperature, downfall)
        )
        water = parse_color(effects.get("water_color", 4159204))
        # order: grass, foliage, dryFoliage, water (matches render.ts)
        out[name] = [grass, foliage, dry, water]
    return out


def main() -> None:
    global JAR
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default=None, help="Minecraft version (default: latest release)")
    args = parser.parse_args()

    version, JAR = get_client_jar(args.version)
    print(f"Generating color tables from Minecraft {version}...")

    blocks = generate_blocks()
    biomes = generate_biomes()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(
            {"minecraft": version, "blocks": blocks, "biomes": biomes},
            f,
            separators=(",", ":"),
        )
        f.write("\n")

    size_kb = OUT.stat().st_size // 1024
    print(f"Wrote {OUT} ({len(blocks)} blocks, {len(biomes)} biomes, {size_kb} KB)")


if __name__ == "__main__":
    main()
