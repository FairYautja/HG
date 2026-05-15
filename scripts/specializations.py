"""Character specializations"""

from typing import Any, Literal

from . import log
from .loader import Loader
from .utils import split_index


def debug_specialization(specialization: dict[str, float | str | bool]) -> None:
    """Display used attributes for given specialization"""
    faction = "Human" if specialization["Properties.Type"].startswith("ESFClassSpecialization::FT_") else "Predator"
    log.debug("%s - %s", faction, specialization["Name"])
    for key in (
        "Properties.bClearedOnMeleeAttack",
        "Properties.bMeleeOnly",
        "Properties.DamageModifier",
        "Properties.DownedRecoveryDurationModifier",
        "Properties.DownHealthModifier",
        "Properties.Duration_Total",
        "Properties.EffectLifetime",
        "Properties.EnergyRegenModifier",
        "Properties.FloatModifier",
        "Properties.MainFloatModifier",
        "Properties.MainIntModifier",
        "Properties.SecondaryFloatModifier",
        "Properties.SecondaryIntModifier",
        "Properties.SpeedModifier",
        "Properties.StackingMode",
        "Properties.StaminaRecoveryRateModifier",
    ):
        val = specialization.get(key)
        if val:
            log.debug(" * %s=%s", key, val)


def normalize_ooman_specialization(specialization: dict[str, float | str | bool]) -> None:  # noqa: C901
    """Set main and secondary value and add note"""
    match specialization["Name"]:
        case "Spec_Enraged":
            low_health = int(specialization.get("Properties.MainFloatModifier") * 100)
            specialization["_note"] = f"low health is below {low_health}%"
            specialization["_main_modifier"] = specialization["Properties.SpeedModifier"]
            specialization["_secondary_modifier"] = specialization["Properties.StaminaRecoveryRateModifier"]
        case "Spec_Amphibious":
            specialization["_main_modifier"] = specialization["Properties.SpeedModifier"]
        case "Spec_Spotter":
            specialization["_secondary_modifier"] = specialization["Properties.SpeedModifier"]
        case "Spec_FieldMedic":
            specialization["_main_modifier"] = specialization.get("Properties.SecondaryFloatModifier")
            specialization["_secondary_modifier"] = specialization.get("Properties.MainFloatModifier")
        case "Spec_Reckless":
            duration = int(specialization.get("Properties.EffectLifetime"))
            specialization["_note"] = f"lasts for {duration} seconds"
            specialization["_main_modifier"] = specialization.get("Properties.DamageModifier")
        case "Spec_Scavenger":
            specialization["_main_modifier"] = specialization.get("Properties.MainIntModifier")
            specialization["_secondary_modifier"] = specialization.get("Properties.MainFloatModifier")
        case "Spec_Rushdown":
            duration = int(specialization.get("Properties.EffectLifetime"))
            specialization["_note"] = f"lasts for {duration} seconds"
            specialization["_main_modifier"] = specialization.get("Properties.SpeedModifier")
        case "Spec_Fanatic":
            low_health = int(specialization.get("Properties.MainFloatModifier") * 100)
            specialization["_note"] = f"wounded means health below {low_health}%"
            specialization["_main_modifier"] = specialization["Properties.DamageModifier"]
            specialization["_secondary_modifier"] = specialization["Properties.SpeedModifier"]
        case "Spec_Leader":
            duration = int(specialization.get("Properties.EffectLifetime"))
            specialization["_note"] = f"lasts for {duration} seconds"
            specialization["_main_modifier"] = specialization.get("Properties.DamageModifier")
        case "Spec_Liberator":
            duration = int(specialization.get("Properties.EffectLifetime"))
            specialization["_note"] = f"lasts for {duration} seconds"
            specialization["_secondary_modifier"] = specialization.get("Properties.DamageModifier")


def normalize_yautja_specialization(specialization: dict[str, float | str | bool]) -> None:
    """Set main and secondary value and add note"""
    match specialization["Name"]:
        case "Spec_Wrathful":
            specialization["_main_modifier"] = specialization["Properties.DamageModifier"]
        case "Spec_Ghost":
            duration = int(specialization.get("Properties.EffectLifetime"))
            specialization["_note"] = f"lasts for {duration} seconds after decloack"
            specialization["_main_modifier"] = specialization["Properties.DamageModifier"]
        case "Spec_Savage":
            duration = int(specialization.get("Properties.Duration_Total"))
            specialization["_note"] = f"takes {duration} seconds to gain health after claim"
        case "Spec_Focused":
            duration = int(specialization.get("Properties.EffectLifetime"))
            specialization["_note"] = f"lasts for {duration} seconds"
            specialization["_main_modifier"] = specialization["Properties.SpeedModifier"]
            specialization["_secondary_modifier"] = specialization["Properties.EnergyRegenModifier"]
        case "Spec_Vicious":
            specialization["_main_modifier"] = specialization["Properties.DownHealthModifier"]
            specialization["_secondary_modifier"] = specialization["Properties.DownedRecoveryDurationModifier"]

def extract_specializations(loader: Loader) -> list[dict[str, Any]]:
    """Get specializations for predator and fireteam"""
    specializations = []
    for specialization_key, definition in list(loader.items()):
        if isinstance(definition, Exception) or not definition.name.startswith("Spec_"):
            continue

        index = 0
        if len(definition.data) != 1:
            log.warning(f"Definition with multiple items!: {definition.path}")

        specialization = loader.extract(specialization_key, index, {
            "Name": str,
            "Properties.Type": str,  # guess predator/firetem from class type name
            "Properties.DisplayName.SourceString": str,
            "Properties.DisplayDetails.SourceString": str,
            "Properties.UsableClassTags": list,
            "Properties.MainFloatModifier": float,
            "Properties.SecondaryFloatModifier": float,
            "Properties.MainIntModifier": int,
            "Properties.SecondaryIntModifier": int,
            "Properties.FloatModifier": float,
            "Properties.GameModeUsefulness": str,  # is the specialization useful in Clash game mode? v2.5.0
            "Properties.GameModeUsefulness[2]": str,  # useful in Clash game mode? v3.0.0
            "Properties.GameModeUsefulness[3]": str,  # useful in some new Fireteam game mode? v3.0.0
            "Properties.StatusEffectToApply": dict,
        })

        effect = specialization.get("Properties.StatusEffectToApply")
        if effect:
            effect_path, effect_index = split_index(effect["ObjectPath"])
            effect_definition = loader.get(effect_path)
            type_name = effect_definition.data[effect_index]["Name"]
            effect_index = effect_definition.types.get(type_name)
            if isinstance(effect_index, KeyError) or effect_index is None:
                log.warning("Unable to extract specialization effect from %s index: %s", effect_path, effect_index)
                continue

            specialization.update(loader.extract(effect_path, effect_index, {
                # Predator Wrathful/Ghost, Fireteam Fanatic/Leader/Liberator/Reckless
                "Properties.DamageModifier": float,
                # Predator Wrathful/Ghost
                "Properties.bMeleeOnly": bool,
                # Predator Wrathful/Focused/Ghost/Vicious, Fireteam Leader/Liberator/Reckless/Rushdown
                "Properties.StackingMode": str,
                # Predator Wrathful/Ghost
                "Properties.bClearedOnMeleeAttack": bool,
                # Predator Enraged/Focused, Fireteam Amphibious/Fanatic/Rushdown/Spotter
                "Properties.SpeedModifier": float,
                # Predator Enraged
                "Properties.StaminaRecoveryRateModifier": float,
                # Predator Focused
                "Properties.EnergyRegenModifier": float,
                # Predator Focused/Ghostm, Fireteam Leader/Liberator/Reckless/Rushdown
                "Properties.EffectLifetime": float,
                # Predator Savage
                "Properties.Duration_Total": float,
                # Predator Vicious
                "Properties.DownHealthModifier": float,
                # Predator Vicious
                "Properties.DownedRecoveryDurationModifier": float,
            }))

        specialization["_main_modifier"] = specialization.get("Properties.MainFloatModifier")
        specialization["_secondary_modifier"] = specialization.get("Properties.SecondaryFloatModifier")

        if specialization["Properties.Type"].startswith("ESFClassSpecialization::FT_"):  # Ooman
            normalize_ooman_specialization(specialization)
        else:
            normalize_yautja_specialization(specialization)

        specializations.append(specialization)

        #debug_specialization(specialization)

    return specializations


def extract_clash(specialization: dict[str, Any]) -> Literal["no", "partial", ""]:
    """Extract specialization usefulness for Clash game type"""
    for_clash = (
        # v2.5.0
        specialization.get("Properties.GameModeUsefulness") or \
        # v3.0.0
        specialization.get("Properties.GameModeUsefulness[2]")
    )
    if for_clash == "ESFSpecializationUsefulness::NoEffect":
        return "no"

    if for_clash == "ESFSpecializationUsefulness::Partial":
        return "partial"

    if for_clash is None:
        return ""

    message = f'Unknown specialization Clash usefulness "{for_clash}"'
    raise KeyError(message)


def specializations_data(specializations: dict[str, Any], character_tag2id: dict[str, str]) -> dict[str, dict[str, Any]]:
    """Prepare specializations data for documentation"""
    yautja = []
    ooman = []

    for specialization in specializations:
        specialization_id = specialization.get("Name")
        description = specialization.get("Properties.DisplayDetails.SourceString")
        note = specialization.get("_note")
        row = {
            "id": specialization_id,
            "name": specialization.get("Properties.DisplayName.SourceString"),
            "main_modifier": specialization.get("_main_modifier"),
            "secondary_modifier": specialization.get("_secondary_modifier"),
            "clash": extract_clash(specialization),
            "description": f"{description} Note: {note}" if note else description,
            "source": specialization.get("_source"),
            "classes": [
                character_tag2id[tag]
                for tag in specialization.get("Properties.UsableClassTags")
                if tag in character_tag2id
            ],
        }
        # We can't use Properties.Type because Predator Enraged specialization has type
        # ESFClassSpecialization::FT_LowHealthBoost
        if all(character.find("Fireteam") != -1 for character in row["classes"]):
            ooman.append(row)
        else:
            yautja.append(row)

    return {
        "predator": yautja,
        "fireteam": ooman,
    }
