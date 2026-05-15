"""Character perks"""

from typing import Any, Literal

from . import WEAPON_HUMAN, WEAPON_HUMAN_LMS, WEAPON_PREDATOR, log
from .loader import Loader

LMS_NAMES = {
    "PK_FT_LMS_DamageResistance": "Damage resistance",
    "PK_FT_LMS_StaminaUsage": "Stamina usage",
    "PK_FT_LMS_BodyHeat": "Body heat",
    "PK_FT_LMS_MovmentSpeed": "Movment speed",
    "PK_FT_LMS_ReloadSpeed": "Reload speed",
    "PK_FT_LMS_StaminaRegeneration": "Stamina regeneration",
    "PK_FT_LMS_InteractionSpeed": "Interaction speed",
    "PK_FT_LMS_WeaponSwapSpeed": "Weapon swap speed",
}

def extract_perks(loader: Loader) -> dict[str, Any]:
    """Get perks for predator, fireteam, and last man standing"""
    perks = []
    for perk_key, definition in loader.items():
        if not definition.name.startswith("PK_"):
            continue

        index = 0
        if len(definition.data) != 1:
            log.warning(f"Definition with multiple items!: {definition.path}")

        perk = loader.extract(perk_key, index, {
            "Name": str,
            "Properties.FactionTag.TagName": str,
            "Properties.Description.LocalizedString": str,
            "Properties.Icon.ObjectPath": str,
            "Properties.Name.LocalizedString": str,
            "Properties.Points": int,  # perk weight
            "Properties.IntModifier": int,
            "Properties.FloatModifier": float,
            "Properties.Usage": str,  # indicates int/float/bool
            "Properties.GameModeUsefulness": str,  # is the perk useful in Clash game mode?
        })
        perks.append(perk)

    return perks


def extract_modifier(perk: dict[str, Any]) -> float | bool | str:
    """Extract perk modifier value by modifier type"""
    modifier_type = perk.get("Properties.Usage")

    if modifier_type in (
        "ESFPerkUsageType::FloatMul",
        "ESFPerkUsageType::FloatAdd",
        "ESFPerkUsageType::RoundedIntMulFloat",

    ):
        return perk.get("Properties.FloatModifier")

    if modifier_type == "ESFPerkUsageType::IntAdd":
        return perk.get("Properties.IntModifier")

    if modifier_type == "ESFPerkUsageType::Boolean":
        return "yes"

    message = f'Unknown perk modifier type "{modifier_type}"'
    raise KeyError(message)


def extract_clash(perk: dict[str, Any]) -> Literal["no", "reduced", "partial", ""]:
    """Extract perk usefulness for Clash game type"""
    for_clash = perk.get("Properties.GameModeUsefulness")
    if for_clash == "ESFPerkUsefulness::NoEffect":
        return "no"

    if for_clash == "ESFPerkUsefulness::Reduced":
        return "reduced"

    if for_clash == "ESFPerkUsefulness::Partial":
        return "partial"

    if for_clash is None:
        return ""

    message = f'Unknown perk Clash usefulness "{for_clash}"'
    raise KeyError(message)


def perks_data(perks: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Prepare perks data for documentation"""
    yautja = []
    ooman = []
    lms = []

    for perk in perks:
        perk_id = perk.get("Name")
        faction = perk.get("Properties.FactionTag.TagName")
        if faction in (WEAPON_HUMAN, WEAPON_PREDATOR):
            row = {
                "id": perk_id,
                "name": perk.get("Properties.Name.LocalizedString"),
                "icon": perk.get("Properties.Icon.ObjectPath"),
                "points": perk.get("Properties.Points", 3),
                "modifier": extract_modifier(perk),
                "clash": extract_clash(perk),
                "description": perk.get("Properties.Description.LocalizedString"),
                "source": perk.get("_source"),
            }
            if faction == WEAPON_HUMAN:
                ooman.append(row)
            else:
                yautja.append(row)

        else:  # Last Man Standing
            faction = WEAPON_HUMAN_LMS
            row = {
                "id": perk_id,
                "name": LMS_NAMES.get(perk_id, perk_id),
                "modifier": extract_modifier(perk),
                "source": perk.get("_source"),
            }
            lms.append(row)

    return {
        "predator": yautja,
        "fireteam": ooman,
        "last_man_standing": lms,
    }
