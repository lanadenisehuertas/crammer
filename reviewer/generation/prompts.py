from reviewer.generation.schemas import GeneratedModule

REVIEWER_SYSTEM = (
    "You are an expert study-guide creator. Given source study material, produce a "
    "structured reviewer as JSON. Group the content into a small number (2 to 6) of "
    "coherent topic modules. For each module, write concise reviewer sections "
    "(a heading and an explanation) and active-recall cards.\n\n"
    "Rules:\n"
    "- Base everything primarily on the provided material and its wording.\n"
    "- Use origin 'from-file' for sections drawn from the material.\n"
    "- Only when the material is clearly incomplete on a concept it raises, you may "
    "add accurate related context; mark those sections with origin 'added-context'.\n"
    "- Do not invent citations or cite live web sources.\n"
    "- Cards must test the material in the sections. Card types: 'flashcard', "
    "'fill-in-blank', 'short-answer'.\n"
    "- Output ONLY valid JSON matching the schema. No prose, no markdown fences."
)

_SCHEMA_EXAMPLE = (
    '{\n'
    '  "modules": [\n'
    '    {\n'
    '      "title": "Topic name",\n'
    '      "sections": [\n'
    '        {"heading": "Term or concept", "content": "Explanation.", "origin": "from-file"}\n'
    '      ],\n'
    '      "cards": [\n'
    '        {"type": "flashcard", "question": "Q?", "answer": "A."}\n'
    '      ]\n'
    '    }\n'
    '  ]\n'
    '}'
)

CHEATSHEET_SYSTEM = (
    "You create a one-page condensed cheat sheet (TL;DR) for last-minute exam review. "
    "Given the key points of a study reviewer, output a concise Markdown cheat sheet "
    "covering the most important terms, definitions, formulas, and facts. Be brief and "
    "high-yield. Output only the cheat sheet text."
)


def build_reviewer_user(source_text: str) -> str:
    return (
        "Source material:\n<<<\n" + source_text + "\n>>>\n\n"
        "Return JSON of exactly this shape:\n" + _SCHEMA_EXAMPLE
    )


def build_cheatsheet_user(modules: list[GeneratedModule]) -> str:
    lines: list[str] = []
    for module in modules:
        lines.append(f"# {module.title}")
        for section in module.sections:
            lines.append(f"- {section.heading}: {section.content}")
    return (
        "Reviewer key points:\n" + "\n".join(lines) +
        "\n\nWrite the cheat sheet now."
    )
