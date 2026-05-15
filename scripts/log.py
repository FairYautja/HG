"""Add dev and trace logging shortcuts"""

import functools
import json
import logging

dev = functools.partial(logging.log, 1)
debug = logging.debug
info = logging.info
warning = logging.warning
error = logging.error
critical = logging.critical

def struct(struct: bool|str|float|list|dict) -> None:
    """Pretty print some structure"""
    logging.debug(json.dumps(struct, indent=2))
