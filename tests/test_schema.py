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
