"""Scans recursively exported project and look for definitions we are looking for"""

import json
import sys
from pathlib import Path

from . import log
from .characters import characters_data, extract_characters
from .custom import LoggingConfig, add_devel_log_level, setup_logging
from .loader import Loader
from .perks import extract_perks, perks_data
from .specializations import extract_specializations, specializations_data
from .weapons import extract_weapons, gear_data, weapons_data


def copy_icons(definitions: Loader, docusarus_path: Path, data: dict) -> None:
    """Copy extracted icons into docusaurus"""
    for icon_type in ("characters", "weapons", "gear", "perks"):
        for faction, items in data[icon_type].items():
            for item in items:
                name = item["name"]
                if not name:
                    continue
                icon = item.get("icon")
                if not icon:
                    item["icon"] = None
                    continue

                icon_name = f"{name.lower().replace(" ", "_").replace("'", "")}.png"
                destination = docusarus_path / "static" / "icons" / icon_type / faction / icon_name
                try:
                    definitions.copy_icon(icon, destination)
                    item["icon"] = f"/icons/{icon_type}/{faction}/{icon_name}"
                except KeyError as error:
                    item["icon"] = None
                    log.warning(error)


def main(project_path: Path, docusarus_path: Path) -> None:
    """Make data.json from extracted definitions"""
    definitions = Loader(project_path)
    definitions.preload((
        "CD_",  # Character Definitions
        "WD_",  # Weapon Definitions
        "PK_",  # Perks
        "Spec_",  # Specializations
    ))

    perks = extract_perks(definitions)
    characters = extract_characters(definitions)
    weapons = extract_weapons(definitions)
    specializations = extract_specializations(definitions)

    character_tag2id = {
        character.get("Properties.ClassTag.TagName"): character.get("Name")
        for character in characters
    }
    data = {
        "perks": perks_data(perks),
        "characters": characters_data(characters),
        "weapons": weapons_data(weapons),
        "gear": gear_data(weapons),
        "specializations": specializations_data(specializations, character_tag2id),
    }

    copy_icons(definitions, docusarus_path, data)

    filename = docusarus_path / "static" / "data.json"
    with filename.open("w") as file:
        json.dump(data, file, indent=2)

    log.debug("Used following paths in export:")
    for path in sorted(definitions.used_paths()):
        log.debug(f" - {path}")

    log.info("Extractoin done.")


if __name__ == "__main__":
    add_devel_log_level()
    LoggingConfig.level = "DEVEL"
    setup_logging(LoggingConfig)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
