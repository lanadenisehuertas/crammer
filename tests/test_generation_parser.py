from reviewer.generation.parser import parse_modules


def test_parses_valid_json():
    raw = '''{"modules":[{"title":"Cells",
      "sections":[{"heading":"Membrane","content":"controls entry","origin":"from-file"}],
      "cards":[{"type":"flashcard","question":"Q?","answer":"A."}]}]}'''
    modules = parse_modules(raw)
    assert len(modules) == 1
    assert modules[0].title == "Cells"
    assert modules[0].sections[0].origin == "from-file"
    assert modules[0].cards[0].card_type == "flashcard"


def test_strips_markdown_fences_and_prose():
    raw = 'Here is the JSON:\n```json\n{"modules":[{"title":"T","sections":[],"cards":[]}]}\n```'
    modules = parse_modules(raw)
    assert modules[0].title == "T"


def test_invalid_origin_defaults_to_from_file():
    raw = '{"modules":[{"title":"T","sections":[{"heading":"h","content":"c","origin":"bogus"}],"cards":[]}]}'
    assert parse_modules(raw)[0].sections[0].origin == "from-file"


def test_invalid_card_type_defaults_to_flashcard():
    raw = '{"modules":[{"title":"T","sections":[],"cards":[{"type":"weird","question":"q","answer":"a"}]}]}'
    assert parse_modules(raw)[0].cards[0].card_type == "flashcard"


def test_skips_cards_missing_question_or_answer():
    raw = '{"modules":[{"title":"T","sections":[],"cards":[{"type":"flashcard","question":"","answer":"a"}]}]}'
    assert parse_modules(raw)[0].cards == []


def test_unparseable_returns_empty_list():
    assert parse_modules("not json at all") == []


def test_non_string_origin_is_coerced_not_crashed():
    raw = '{"modules":[{"title":"T","sections":[{"heading":"h","content":"c","origin":["weird"]}],"cards":[]}]}'
    modules = parse_modules(raw)
    assert modules[0].sections[0].origin == "from-file"


def test_non_string_card_type_is_coerced_not_crashed():
    raw = '{"modules":[{"title":"T","sections":[],"cards":[{"type":5,"question":"q","answer":"a"}]}]}'
    modules = parse_modules(raw)
    assert modules[0].cards[0].card_type == "flashcard"


def test_null_sections_is_treated_as_empty():
    raw = '{"modules":[{"title":"T","sections":null,"cards":[]}]}'
    modules = parse_modules(raw)
    assert modules[0].sections == []


def test_null_cards_is_treated_as_empty():
    raw = '{"modules":[{"title":"T","sections":[],"cards":null}]}'
    modules = parse_modules(raw)
    assert modules[0].cards == []


def test_trailing_prose_with_stray_brace_does_not_lose_json():
    raw = '{"modules":[{"title":"T","sections":[],"cards":[]}]}\n\nNote: `{}` is an example.'
    modules = parse_modules(raw)
    assert len(modules) == 1
    assert modules[0].title == "T"
