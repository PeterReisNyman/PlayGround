import argparse
from .ideas import generate_ideas


def main() -> None:
    p = argparse.ArgumentParser(description="Generate creative project ideas")
    p.add_argument("-n", "--num", type=int, default=5, help="Number of ideas")
    p.add_argument("--seed", type=int, default=None, help="Deterministic seed")
    args = p.parse_args()

    ideas = generate_ideas(n=args.num, seed=args.seed)
    for i, idea in enumerate(ideas, 1):
        tags = ", ".join(idea.tags)
        print(f"{i}. {idea.title}\n   {idea.summary}\n   tags: [{tags}]\n")


if __name__ == "__main__":
    main()

