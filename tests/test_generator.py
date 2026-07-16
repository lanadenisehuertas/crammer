from reviewer.generation.generator import generate_more_cards, generate_reviewer


class FakeClient:
    """Records calls; returns queued replies in order."""
    def __init__(self, replies):
        self._replies = list(replies)
        self.calls = []

    def generate_text(self, system, user, max_tokens=16000):
        self.calls.append((system, user))
        return self._replies.pop(0)


_MODULE_JSON = ('{"modules":[{"title":"Cells","sections":['
                '{"heading":"Membrane","content":"controls entry","origin":"from-file"}],'
                '"cards":[{"type":"flashcard","question":"Q?","answer":"A."}]}]}')


def test_generate_reviewer_single_chunk():
    client = FakeClient([_MODULE_JSON, "CHEAT SHEET TEXT"])
    result = generate_reviewer(client, "short source text")
    assert len(result.modules) == 1
    assert result.modules[0].title == "Cells"
    assert result.cheat_sheet == "CHEAT SHEET TEXT"
    # one reviewer call + one cheat-sheet call
    assert len(client.calls) == 2


def test_generate_reviewer_merges_multiple_chunks():
    other = _MODULE_JSON.replace("Cells", "Energy")
    client = FakeClient([_MODULE_JSON, other, "CHEAT"])
    # max_chars small enough to force two chunks
    result = generate_reviewer(client, "A" * 30 + "\n\n" + "B" * 30, max_chars=40)
    titles = [m.title for m in result.modules]
    assert titles == ["Cells", "Energy"]
    assert len(client.calls) == 3  # two reviewer calls + one cheat sheet


_MORE_CARDS_JSON = '{"cards":[{"type":"flashcard","question":"New Q?","answer":"New A."}]}'


def test_generate_more_cards_returns_parsed_cards():
    client = FakeClient([_MORE_CARDS_JSON])
    cards = generate_more_cards(client, "Membrane: controls entry", ["Q?"])
    assert len(cards) == 1
    assert cards[0].question == "New Q?"
    assert cards[0].answer == "New A."
    # exclusions and section text are both threaded through to the prompt
    system, user = client.calls[0]
    assert "duplicat" in system.lower()
    assert "Membrane" in user
    assert "Q?" in user


def test_generate_more_cards_garbage_reply_returns_empty_list():
    client = FakeClient(["not json at all"])
    cards = generate_more_cards(client, "some section", [])
    assert cards == []
