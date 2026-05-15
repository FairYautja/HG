"""Utility helpers"""

from collections import ChainMap
from collections.abc import Callable, Mapping
from typing import Any, Literal, TypedDict

from . import log


def get_in(obj: dict[str, Any], path: str) -> dict[str, Any] | None:
    """Safely get value from nested dicts"""
    path = path.split(".") if path.find(".") else [path]
    for key in path:
        obj = obj.get(key)
        if obj is None:
            return None

    return obj


def merge_dicts(dicts: list[dict[Any, Any]]) -> dict[Any, Any]:
    """Recursively join dicts overriding keys from later dicts in list"""
    def merge(a: dict[Any, Any], b: dict[Any, Any]) -> dict[Any, Any]:
        """Recursively merges dictionary b into dictionary a."""
        for key, value in b.items():
            if isinstance(value, Mapping) and isinstance(a.get(key), Mapping):
                a[key] = merge(a[key], value)
            else:
                a[key] = value  # Overwrite with latest value
        return a

    result = {}
    for d in dicts:
        result = merge(result, d)
    return result


def extract_keys(obj: dict[str, Any], keys: dict[str, Callable]) -> dict[str, Any]:
    """Extract data from object and retype them"""
    data = {}
    for key, cast in keys.items():
        val = get_in(obj, key)
        if val is None or val == "None":  # Sometimes null value is stored as "None" in .pak files
            continue

        data[key] = cast(val)
    return data


def split_index(object_name: str) -> tuple[str, int]:
    """Split oject name and index of object

    "SomeObject".0 -> "SomeObject", 0
    """
    items = object_name.rsplit(".")
    items_len = len(items)
    if items_len == 1:
        return object_name, 0

    if items_len > 2:  # noqa: PLR2004
        message = f'Unsupported object_name "{object_name}"'
        raise ValueError(message)

    return items[0], int(items[1])


def extract_list_of_dicts(
    key: str | Callable,
    val: str | Callable,
    list_of_dicts: list[dict[str, str]],
) -> dict[str, str]:
    """Extract list of nested dicts

    [
        {
            key: "use this as key1",
            val: "use this as value1",
            other_key: "not used",
        },
        {
            key: "use this as key2",
            val: "use this as value2",
            other_key: "not used",
        },
        ...
    ]
    """
    items = {}
    for d in list_of_dicts:
        k = key(d) if callable(key) else d.get(key)
        if k is None:
            continue
        v = val(d) if callable(val) else d.get(val)
        items[k] = v
    return items


def flattern_list_of_dicts(list_of_dict: list[dict[str, str]]) -> dict[str, str]:
    """Extract all keys and values from list of nested dicts

    [
        {key1: value1},
        {key2: value2},
        ...
    ]
    """
    return dict(ChainMap(*list_of_dict))


class CurvePoint(TypedDict):
    """Point of Béziere curve"""

    interpolation: Literal["Auto", "User", "Break", "Linear", "Constant"]
    in_tg: float
    in_tg_weight: float
    out_tg: float
    out_tg_weight: float
    x: float
    y: float


def extract_curve(definition: list[dict[str, Any]]) -> CurvePoint:
    """Parse curve data"""
    handles = definition.get("KeyHandlesToIndices")
    if handles:
        log.warn("Non-empty KeyHandlesToIndices: %s", handles)
        definition = handles

    points = definition.get("Keys", [])

    return [{
        "interpolation": point["InterpMode"],
        "in_tg": point["ArriveTangent"],
        "in_tg_we": point["ArriveTangentWeight"],
        "out_tg": point["LeaveTangent"],
        "out_tg_w": point["LeaveTangentWeight"],
        "x": point["Time"],
        "y": point["Value"],
    } for point in points]
