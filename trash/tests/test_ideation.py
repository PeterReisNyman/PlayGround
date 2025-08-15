from ideation import generate_ideas


def test_generate_ideas_deterministic():
    a = generate_ideas(n=3, seed=123)
    b = generate_ideas(n=3, seed=123)
    assert a == b
    assert len(a) == 3
    assert all(hasattr(i, "title") and hasattr(i, "summary") for i in a)


def test_generate_ideas_varies_with_seed():
    a = generate_ideas(n=4, seed=1)
    b = generate_ideas(n=4, seed=2)
    assert a != b

