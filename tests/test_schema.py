import sqlite3
from reviewer.db import connect


def test_connect_in_memory_returns_connection():
    conn = connect(":memory:")
    assert isinstance(conn, sqlite3.Connection)
    conn.close()


def test_connect_enables_foreign_keys():
    conn = connect(":memory:")
    cur = conn.execute("PRAGMA foreign_keys")
    assert cur.fetchone()[0] == 1
    conn.close()


def test_connect_rows_are_accessible_by_name():
    conn = connect(":memory:")
    conn.execute("CREATE TABLE t (a INTEGER, b TEXT)")
    conn.execute("INSERT INTO t (a, b) VALUES (1, 'x')")
    row = conn.execute("SELECT a, b FROM t").fetchone()
    assert row["a"] == 1
    assert row["b"] == "x"
    conn.close()


from reviewer.schema import init_db


def test_init_db_creates_all_tables():
    conn = connect(":memory:")
    init_db(conn)
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    names = {r["name"] for r in rows}
    assert {
        "documents",
        "modules",
        "module_sections",
        "cards",
        "reviews",
        "study_days",
    } <= names
    conn.close()


def test_init_db_is_idempotent():
    conn = connect(":memory:")
    init_db(conn)
    init_db(conn)  # must not raise
    conn.close()


def test_foreign_key_enforced_on_modules():
    import sqlite3
    conn = connect(":memory:")
    init_db(conn)
    try:
        # document_id 999 does not exist -> FK violation
        conn.execute(
            "INSERT INTO modules (document_id, title, position) VALUES (999, 'x', 0)"
        )
        raised = False
    except sqlite3.IntegrityError:
        raised = True
    assert raised
    conn.close()
