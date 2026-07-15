import pytest
from reviewer.db import connect
from reviewer.schema import init_db


@pytest.fixture
def conn():
    c = connect(":memory:")
    init_db(c)
    yield c
    c.close()
