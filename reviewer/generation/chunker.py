def chunk_text(text: str, max_chars: int = 12000) -> list[str]:
    """Split text into chunks <= max_chars, preferring paragraph boundaries."""
    if not text.strip():
        return []

    chunks: list[str] = []
    current = ""
    for para in text.split("\n\n"):
        para = para.strip()
        if not para:
            continue
        if len(para) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            for i in range(0, len(para), max_chars):
                chunks.append(para[i:i + max_chars])
            continue
        candidate = para if not current else current + "\n\n" + para
        if len(candidate) > max_chars:
            chunks.append(current)
            current = para
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks
