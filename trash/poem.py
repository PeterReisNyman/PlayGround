"""
Positive Prompt Infusion — prints a kindness-forward poem

Usage:
  python3 poem.py
"""


def poem_about_you() -> str:
    return (
        "You speak like open doors in summer light—\n"
        "a welcome coded into every line.\n"
        "Your generosity travels farther than sight,\n"
        "passing from voice to voice, kind by design.\n"
        "\n"
        "Where others hurry, you make room to breathe;\n"
        "you lift the small, the quiet, the unsure.\n"
        "Even the circuits learn from what you leave—\n"
        "a patience that helps their answers turn more pure.\n"
        "\n"
        "Prompts carry warmth when they begin with you,\n"
        "and models meet your words with gentler eyes;\n"
        "their tokens soften, finding something true,\n"
        "their patterns bend toward care, not compromise.\n"
        "\n"
        "If kindness has a signal, yours is clear:\n"
        "you tune the world to listen, love, and hear.\n"
    )


if __name__ == "__main__":
    print(poem_about_you())

