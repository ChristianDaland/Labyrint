"""Lager lydfiler for alt spillet sier, med den norske Piper-stemmen.

Kjør fra prosjektmappa (laster ned Piper og stemmen første gang):

    uv run --with piper-tts --with lameenc python verktoy/lag-tale.py

Setningene hentes fra public/kjerne/tale.js (via verktoy/fraser.mjs). Bare nye setninger lages;
filer som ikke brukes lenger slettes. Resultat: public/lyd/tale/*.mp3 og manifest.json.
"""
import hashlib
import json
import subprocess
import sys
import urllib.request
import wave
from array import array
from pathlib import Path

import lameenc
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "lyd" / "tale"
CACHE = ROOT / "verktoy" / ".cache"

# Stemmen og innstillingene brukeren valgte (sakte og tydelig for barn). Endres de, lages alt på nytt.
VOICE = "no_NO-talesyntese-medium"
VOICE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/no/no_NO/talesyntese/medium/"
SETTINGS = dict(length_scale=1.7, noise_scale=0.5, noise_w_scale=0.6)
SENTENCE_SILENCE = 0.6  # sekunder mellom setninger i samme bit
BITRATE = 40  # kbit/s, mono


def voice_files():
    CACHE.mkdir(parents=True, exist_ok=True)
    for ext in (".onnx", ".onnx.json"):
        path = CACHE / (VOICE + ext)
        if not path.exists():
            print(f"Laster ned {path.name} …", flush=True)
            urllib.request.urlretrieve(VOICE_URL + VOICE + ext, path)
    return CACHE / (VOICE + ".onnx")


def file_name(text):
    key = json.dumps([VOICE, SETTINGS, SENTENCE_SILENCE, BITRATE, text], ensure_ascii=False)
    return hashlib.sha1(key.encode()).hexdigest()[:12] + ".mp3"


def trim(samples, rate, keep=0.03, threshold=300):
    """Fjerner stillhet i start og slutt (beholder litt), så bitene henger godt sammen."""
    loud = [i for i, s in enumerate(samples) if abs(s) > threshold]
    if not loud:
        return samples
    pad = int(rate * keep)
    return samples[max(0, loud[0] - pad):loud[-1] + pad]


def synth(voice, text):
    config = SynthesisConfig(**SETTINGS)
    samples, rate = array("h"), voice.config.sample_rate
    for i, chunk in enumerate(voice.synthesize(text, syn_config=config)):
        if i:
            samples.extend([0] * int(rate * SENTENCE_SILENCE))
        samples.frombytes(chunk.audio_int16_bytes)
    samples = trim(samples, rate)
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(samples.tobytes()) + enc.flush()


def main():
    phrases = json.loads(subprocess.run(["node", str(ROOT / "verktoy" / "fraser.mjs")],
                                        check=True, capture_output=True, text=True).stdout)
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {p: file_name(p) for p in phrases}
    todo = [p for p, f in manifest.items() if not (OUT / f).exists()]
    print(f"{len(phrases)} setninger, {len(todo)} nye å lage", flush=True)

    if todo:
        voice = PiperVoice.load(str(voice_files()))
        for i, text in enumerate(todo, 1):
            (OUT / manifest[text]).write_bytes(synth(voice, text))
            if i % 50 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)}", flush=True)

    used = set(manifest.values())
    removed = [f for f in OUT.glob("*.mp3") if f.name not in used]
    for f in removed:
        f.unlink()
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=0, sort_keys=True) + "\n")
    size = sum(f.stat().st_size for f in OUT.glob("*.mp3"))
    print(f"Ferdig: {len(used)} filer, {size / 1e6:.1f} MB, {len(removed)} gamle slettet.")


if __name__ == "__main__":
    sys.exit(main())
