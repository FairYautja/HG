"""Definition from .pak file"""

from typing import Any


class Definition:
    """UnrealEngine Object definition"""

    def __init__(self, data: dict[str, Any], name: str, path: str):
        self.data = data  # class attributes
        self.name = name  # class name
        self.path = path  # path in .pak file

        self.types: dict[str, int] = {}
        self.names: dict[str, int] = {}
        self.classes: dict[str, int] = {}
        for index, item in enumerate(data):
            typ = item.get("Type")
            if typ is not None:
                if typ in self.types:
                    message = "This Type is not unique in definition"
                    self.types[typ] = KeyError(message)
                else:
                    self.types[typ] = index

            name = item.get("Name")
            if name is not None:
                if name in self.names:
                    message = "This Name is not unique in definition"
                    self.names[name] = KeyError(message)
                else:
                    self.names[name] = index

            clas = item.get("Class")
            if clas is not None:
                if clas in self.classes:
                    message = "This Class is not unique in definition"
                    self.classes[clas] = KeyError(message)
                else:
                    self.classes[clas] = index

    def __str__(self) -> str:
        """Return a string representation of the definition"""
        return f"<Definition {self.name} at 0x{id(self):02x}>"
