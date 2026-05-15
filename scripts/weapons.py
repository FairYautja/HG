"""Weapons extraction"""

from functools import partial
from typing import Any

from . import WEAPON_HUMAN, WEAPON_PREDATOR, log
from .damage import extract_attacks
from .definition import Definition
from .loader import Loader
from .utils import extract_list_of_dicts, get_in, split_index

# Following are base classes of weapon categories, not real weapons.
WEAPON_BASES = (
    "WD_GrenadeLauncher_Base",
    "WD_LMG_Base",  # This is RP-103 base of base...
    "WD_Pistol_Base",
    "WD_Predator_Gear_Base",
    "WD_Predator_Weapon_Base",
    "WD_Rifle_Base",
    "WD_Shotgun_Base",
    "WD_SMG_Base",
    "WD_SniperRifle_Base",
)

# Following weapons are defined without _Base in .pak files
WITHOUT_BASE = (
    "WD_Gear_AmmoBag",
    "WD_Gear_EMPMine",
    "WD_Gear_HealthPack",
    "WD_Gear_SelfHealSyrette",
    "WD_Gear_SelfRevive",
    "WD_Gear_UAVScanner",
    "WD_Grenade_Flash_FT",
    "WD_Grenade_Frag_FT",
    "WD_Grenade_Smoke",
    "WD_Grenade_ThermalDecoy",
    "WD_Knife_Dutch_01",
    "WD_Minigun",
    "WD_NoiseMaker",
    "WD_Predator_CombiStick_Trident",
    "WD_Predator_Drone",
    "WD_Predator_EnergyShield",
    "WD_Predator_PlasmaCaster_Zeta",   # Eye of Ra
    "WD_Predator_Sickle",
    "WD_Predator_Sword_Cid",  # Dual Swords
    "WD_Predator_WristDart_CityHunter",
)


def resolve_merge(definition: Definition) -> list[tuple[str, int, int]]:
    """Resolve inheritance for Weapon Definitions"""
    merge_obj = definition.path.removesuffix("_Base")
    merge_index = 0
    merge_priority = -1

    if definition.name == "WD_Predator_CombiStick_Base":
        merge_obj += "_Hunter"
        return [(merge_obj, merge_index, merge_priority)]

    if definition.name == "WD_Predator_HandheldTuscon_Base":
        merge_obj += "_A"
        return [(merge_obj, merge_index, merge_priority)]

    if definition.name == "WD_Predator_PlasmaCaster_Zeta":
        merge_obj = "Content/DLC_Release/FU_20/Weapon/HandHeldPlasmaCaster_Zeta/WD_Predator_HandheldPlasmaCaster_Zeta"
        return [(merge_obj, merge_index, merge_priority)]

    if definition.name in (
        "WD_Shotgun_DJL33_Base",
        "WD_Shotgun_XDB12_Base",
        "WD_SMG_PDW-Z_Base",
        "WD_SMG_Z-06_Base",
        "WD_SMG_ZR-55_Base",
    ):
        merge_obj += "_Secondary"
        return [(merge_obj, merge_index, merge_priority)]

    if definition.name in (
        "WD_OWLFAR_Base",
        "WD_Pistol_1011-12_Base",
        "WD_Pistol_Grimtech19_Base",
        "WD_Rifle_AR-W_Base",
        "WD_Rifle_G-ROW_Base",
        "WD_Rifle_GOSL-R_Base",
        "WD_Rifle_QR4_Base",
        "WD_SniperRifle_7EN_Base",
        "WD_SniperRifle_ABR-Z_Base",
        "WD_SniperRifle_SmallFoxWeapon_Base",
    ):
        merge_obj += "_Standard"
        return [(merge_obj, merge_index, merge_priority)]

    if definition.name in (
        "WD_LMG_RP-103_Base",
        "WD_PlasmaAR_Base",
        "WD_Grenade_ACIG_Base",
        "WD_Knife_Gear_Base",
        "WD_Predator_Sickle",
        "WD_Predator_WristDart_CityHunter",
    ):
        return []

    # Rest has WD_Weapon_Base -> WD_Weapon
    return [(merge_obj, merge_index, merge_priority)] if merge_obj else []


def extract_weapons(loader: Loader) -> dict[str, dict[str, Any]]:
    """Get perks for predator, fireteam, and last man standing"""
    weapons = []

    for path, definition in list(loader.items()):
        if not definition.name.startswith("WD_") or definition.name in WEAPON_BASES:
            continue

        # We use Base classes because many weapons has their clones for various
        # characters and their attachment points, animations, etc.
        # Except for some, see WITHOUT_BASE...
        if not definition.name.endswith("_Base") and definition.name not in WITHOUT_BASE:
            continue

        index = 1
        if len(definition.data) == 1:
            if definition.name not in WITHOUT_BASE:
                log.warning(f"Definition without multiple items!: {definition.path}")
            index = 0

        weapon = loader.extract(path, index, {
            "Name": str,
            "Properties.ShortName": str,
            "Properties.MenuIcon.AssetPathName": str,
            "Properties.LocName.LocalizedString": str,
            "Properties.LocName.CultureInvariantString": str,
            "Properties.Description.LocalizedString": str,
            "Properties.BackendWeaponID": str,
            "Properties.BaseWeaponStats": partial(extract_list_of_dicts, "Stat", "BaseValue"),
            "Properties.EquipPlayrate": float,
            "Properties.UnequipPlayrate": float,
            "Properties.AutoFireVariations": int,
            "Properties.SlotWeight": int,
            "Properties.CategoryTag.TagName": str,
            "Properties.SlotTag.TagName": str,
            "Properties.OriginTag.TagName": str,
            "Properties.PrimaryAction.ObjectPath": str,
            "Properties.SecondaryAction.ObjectPath": str,
            "Properties.ADSWeaponAction.ObjectPath": str,
            "Properties.ParryStaminaMultiplier": float,  # Predator - Alpha Sickle
        }, merge=resolve_merge(definition))

        if weapon.get("Properties.SlotTag.TagName") == "Weapon.Slot.Gear":
            weapon["Properties.CategoryTag.TagName"] = "Weapon.Category.Gear"

        # Icons for one weapon (probably first defined) in each category is not defined
        # in it's base, but it is in the base of weapon category.
        if "Properties.MenuIcon.AssetPathName" not in weapon:
            super_class = definition.data[0].get("Super")
            if super_class:
                icon_obj, _icon_index = split_index(super_class["ObjectPath"])
                icon_definition = loader.get(icon_obj)
                obj_index = 1
                icon_path = get_in(icon_definition.data[obj_index], "Properties.MenuIcon.AssetPathName")
            else:
                icon_path = get_in(definition.data[0], "Properties.MenuIcon.AssetPathName")
            weapon["Properties.MenuIcon.AssetPathName"] = icon_path


        if definition.name in (
            "WD_Grenade_ACIG_Base",
            "WD_Gear_SelfHealSyrette",
            "WD_Gear_EMPMine",
            "WD_Gear_UAVScanner",
            "WD_Grenade_Frag_FT",
        ):
            weapon["Properties.OriginTag.TagName"] = WEAPON_HUMAN
        elif definition.name in (
            "WD_Predator_EnergyShield",
            "WD_Predator_WristDart_CityHunter",
        ):
            weapon["Properties.OriginTag.TagName"] = WEAPON_PREDATOR
        elif definition.name in (
            "WD_GrenadeLauncher_PDL_Base",
            "WD_Minigun",
        ):
            weapon["Properties.CategoryTag.TagName"] = "Weapon.Category.SecondarySpecial"

        weapon["_attacks"] = extract_attacks(loader, definition.name)
        weapons.append(weapon)

    return weapons

def weapons_data(weapons: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Prepare weapons data for documentation"""
    yautja = []
    ooman = []

    for weapon in weapons:
        if weapon.get("Properties.CategoryTag.TagName") == "Weapon.Category.Gear" and weapon["Name"] not in (
            "WD_Predator_WristDart_CityHunter",
            "WD_Grenade_Frag_FT",
        ):
            continue

        weapon_id = weapon.get("Name")
        faction = weapon.get("Properties.OriginTag.TagName")
        row = {
            "id": weapon_id,
            "name": (
                weapon.get("Properties.LocName.LocalizedString") or \
                weapon.get("Properties.LocName.CultureInvariantString")
            ),
            "icon": weapon.get("Properties.MenuIcon.AssetPathName"),
            "description": weapon.get("Properties.Description.LocalizedString"),
            "category": weapon.get("Properties.CategoryTag.TagName"),
            "attacks": weapon.get("_attacks"),
            "source": weapon.get("_source"),
        }
        if faction == WEAPON_PREDATOR:
            yautja.append(row)
        elif faction == WEAPON_HUMAN:
            ooman.append(row)
        else:
            log.warning('Unknown faction "%s" for weapon %s', faction, weapon_id)
            log.debug(weapon["_source"])

    return {
        "predator": yautja,
        "fireteam": ooman,
    }


def gear_data(weapons: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Prepare gear data fro documentation"""
    yautja = []
    ooman = []

    for gear in weapons:
        if gear.get("Properties.CategoryTag.TagName") != "Weapon.Category.Gear":
            continue

        gear_id = gear.get("Name")
        faction = gear.get("Properties.OriginTag.TagName")
        row = {
            "id": gear_id,
            "name": (
                gear.get("Properties.LocName.LocalizedString") or \
                gear.get("Properties.LocName.CultureInvariantString")
            ),
            "icon": gear.get("Properties.MenuIcon.AssetPathName"),
            "description": gear.get("Properties.Description.LocalizedString"),
            "weight": gear.get("Properties.SlotWeight", 1),  # Default weight "1" is null in .pak
            "source": gear.get("_source"),
        }
        if faction == WEAPON_PREDATOR:
            yautja.append(row)
        elif faction == WEAPON_HUMAN:
            ooman.append(row)
        else:
            log.warning('Unknown faction "%s" for gear %s', faction, gear_id)
            log.debug(gear["_source"])

    return {
        "predator": yautja,
        "fireteam": ooman,
    }
