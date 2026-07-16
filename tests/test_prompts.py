from reviewer.generation import prompts
from reviewer.generation.schemas import GeneratedModule, GeneratedSection


def test_reviewer_system_states_core_rules():
    s = prompts.REVIEWER_SYSTEM.lower()
    assert "from-file" in s
    assert "added-context" in s
    assert "json" in s


def test_build_reviewer_user_embeds_source_text():
    user = prompts.build_reviewer_user("PHOTOSYNTHESIS NOTES")
    assert "PHOTOSYNTHESIS NOTES" in user


def test_build_cheatsheet_user_includes_module_titles_and_headings():
    modules = [GeneratedModule(
        title="Cells",
        sections=[GeneratedSection("Membrane", "controls entry", "from-file")],
        cards=[])]
    user = prompts.build_cheatsheet_user(modules)
    assert "Cells" in user
    assert "Membrane" in user
