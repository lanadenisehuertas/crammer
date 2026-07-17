class AIProviderError(Exception):
    """Raised when a non-Anthropic AI provider (e.g. Gemini) returns an error.

    Kept in its own module (rather than alongside a specific client) so that
    reviewer.web.api can catch it without importing any particular provider's
    client module.
    """
