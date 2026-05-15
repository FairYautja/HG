"""Exported data lazy loader"""
import json
import os
import shutil
from collections.abc import Callable
from pathlib import Path
from typing import Any

from . import log
from .definition import Definition
from .utils import extract_keys, get_in, merge_dicts, split_index


class Loader:
    """Exported data lazy loader"""

    def __init__(self, root: str):
        # Normalise without resolving symlinks first, so a symlink named
        # SpaceFish pointing elsewhere still passes the folder-name check.
        logical = Path(os.path.normpath(root))

        if logical.name != "SpaceFish":
            message = "Path must contain SpaceFish folder"
            raise ValueError(message)

        # Resolve symlinks for actual filesystem access.
        self.__root = logical.resolve()
        log.info("Loader using root: %s", self.__root)

        self.__data: dict[str, dict] = {}  # {SpaceFish/ObjectA.0: ObjectA[0], ...}

        # Dirty way to make Loader behave like a dict
        self.__iter__ = self.__data.__iter__
        self.keys = self.__data.keys
        self.values = self.__data.values
        self.items = self.__data.items

    def preload(self, file_perfixes: list[str]) -> None:
        """Preload specified file prefixes"""
        for root, _dirs, files in self.__root.walk():
            for file in files:
                if not any(file.startswith(prefix) for prefix in file_perfixes):
                    continue

                if not file.endswith(".json"):
                    continue

                key = root.relative_to(self.__root) / file[:-5]
                self.get(key.as_posix())

    def get(self, path: str) -> Definition:
        """Get key from cache or load it from file"""
        # Sometimes there is a referrence to SpaceFish/Game instead of SpaceFish/Content
        if path.startswith("/Game/"):
            path = "Content" + path.removeprefix("/Game")

        # They have case mismatch in the .pak file, so we have to fix it because
        # Linux filenames are case sensitive.
        if path.startswith("Content/Weapon/Definitions/Fireteam/Shotgun/CS12/"):
            path = path.replace("/CS12/", "/Cs12/")

        definition = self.__data.get(path)
        if isinstance(definition, KeyError):
            # Ff we tried to load this path before and it failed, the stored value is KeyError exception.
            raise definition

        if definition is not None:
           return definition  # return cached value

        parts = path.split("/")
        dirs = parts[:-1]
        class_name = parts[-1]
        source = Path(self.__root, *dirs, f"{class_name}.json")
        try:
            with source.open() as fp:
                objects = json.load(fp)
        except OSError as error:
            definition = KeyError(f"No such object: {path}")
            self.__data[path] = definition
            raise definition from error

        self.__data[path] = definition = Definition(objects, class_name, path)
        return definition

    def extract(
        self,
        path: str,
        index: int,
        extract: dict[str, Callable],
        inheritance_key: str | None = None,
        merge: list[tuple[str, int, int]] | None = None,
    ) -> dict[str, Any]:
        """Resolve object inheritence and extract sepcified keys"""
        data = []
        for priority in range(127):  # to avoid infinite loop
            definition = self.get(path)
            obj = definition.data[index]
            extracted = extract_keys(obj, extract)
            extracted["_priority"] = priority
            extracted["_source"] = f"{path}.{index}"
            data.append(extracted)
            if inheritance_key is None:
                break

            parent = get_in(obj, inheritance_key)
            if not parent:
                break

            path, index = split_index(parent)
        else:
            log.error("Infinite loop for %s", path)

        if merge is None:
            merge = []
        for path, index, priority in merge:
            try:
                definition = self.get(path)
            except KeyError as error:
                log.warning("Loader can't merge: %s", error)
                continue

            obj = definition.data[index]
            extracted = extract_keys(obj, extract)
            extracted["_priority"] = priority
            extracted["_source"] = f"{path}.{index}"
            data.append(extracted)

        return merge_dicts(sorted(data, key=lambda obj: obj["_priority"], reverse=True))

    def copy_icon(self, object_path: str, destination: str) -> None:
        """Copy icon specified by object path name to destination folder

        Icon object name ends with Img_Some_Name.0 or Img_Some_Name.Img_Some_Name
        """
        dot_pos = object_path.rfind(".")
        if dot_pos != -1:
            object_path = f"{object_path[:dot_pos]}.png"

        if object_path.startswith("/Game/"):
            object_path = "Content" + object_path[5:]

        icon_source = self.__root / object_path
        if not icon_source.is_file():
            message = f"Icon not found at: {icon_source}"
            raise KeyError(message)

        icon_folder = Path(destination).parent
        if not icon_folder.is_dir():
            icon_folder.mkdir(parents=True)

        shutil.copy(icon_source, destination)

    def used_paths(self, level: int = 3) -> set[str]:
        """Summarize paths of used objects"""
        used = set()
        for path in self.__data:
            base = "/".join(path.split("/")[:level])
            used.add(base)
        return used
