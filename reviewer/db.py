import sqlite3


def connect(db_path: str, check_same_thread: bool = True) -> sqlite3.Connection:
    """Open a SQLite connection with foreign keys on and name-based row access."""
    conn = sqlite3.connect(db_path, check_same_thread=check_same_thread)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
