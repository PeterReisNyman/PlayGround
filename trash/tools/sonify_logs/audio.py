from __future__ import annotations

import math
import os
import platform
import shutil
import struct
import tempfile
import wave
from subprocess import CalledProcessError, DEVNULL, run


def _gen_tone_bytes(freq: float, duration_ms: int, volume: float = 0.5, rate: int = 44100) -> bytes:
    n_samples = max(1, int(rate * (duration_ms / 1000.0)))
    buf = bytearray()
    two_pi_f = 2.0 * math.pi * freq
    for i in range(n_samples):
        t = i / rate
        # simple sine with linear fade-out to reduce click
        amp = volume * (1.0 - i / n_samples)
        sample = int(amp * 32767.0 * math.sin(two_pi_f * t))
        buf += struct.pack('<h', sample)
    return bytes(buf)


def _play_via_afplay(raw: bytes) -> bool:
    exe = shutil.which('afplay')
    if not exe:
        return False
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as f:
            name = f.name
        with wave.open(name, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(raw)
        run([exe, name], stdout=DEVNULL, stderr=DEVNULL, check=False)
    finally:
        try:
            os.unlink(name)
        except Exception:
            pass
    return True


def _play_via_aplay(raw: bytes) -> bool:
    exe = shutil.which('aplay') or shutil.which('paplay')
    if not exe:
        return False
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as f:
            name = f.name
        with wave.open(name, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(raw)
        run([exe, name], stdout=DEVNULL, stderr=DEVNULL, check=False)
    finally:
        try:
            os.unlink(name)
        except Exception:
            pass
    return True


def _play_via_winsound(raw: bytes) -> bool:
    if platform.system() != 'Windows':
        return False
    try:
        import winsound  # type: ignore
    except Exception:
        return False
    # winsound.PlaySound expects a filename or memory image of a WAV via SND_MEMORY
    try:
        winsound.PlaySound(raw, winsound.SND_MEMORY | winsound.SND_NOWAIT)
        return True
    except Exception:
        return False


def _play_via_bell() -> bool:
    try:
        print('\a', end='', flush=True)
        return True
    except Exception:
        return False


def play_tone(freq: float = 440.0, duration_ms: int = 120, volume: float = 0.5) -> None:
    """Attempt to play a short tone using available OS tools.

    Falls back to terminal bell if no audio backend is available.
    """
    raw = _gen_tone_bytes(freq, duration_ms, volume)
    if _play_via_winsound(raw):
        return
    if _play_via_afplay(raw):
        return
    if _play_via_aplay(raw):
        return
    _play_via_bell()

