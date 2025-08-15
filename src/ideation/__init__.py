"""
Ideation module: generate creative project ideas deterministically
given a random seed. Exposes a simple API and CLI entry point.
"""

from .ideas import Idea, generate_ideas

__all__ = ["Idea", "generate_ideas"]

