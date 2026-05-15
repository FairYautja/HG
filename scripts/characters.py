"""Extract Fireteam, Predator, NPC and fauna characters"""

from functools import partial
from typing import Any

from . import WEAPON_HUMAN, WEAPON_PREDATOR, log
from .loader import Loader
from .utils import extract_curve, extract_list_of_dicts

NPC_NAMES = {  # .pak name to human name
    "CD_DrugLord": "Drug Lord",
    "CD_FuelDealer": "Fuel Dealer",
    "CD_Guerilla_Captain": "Guerilla Captain",
    "CD_Guerilla_Elite": "Guerilla Elite",
    "CD_Guerilla_Grunt": "Guerilla Grunt",
    "CD_Guerilla_Heavy": "Guerilla Heavy",
    "CD_Guerilla_Sniper": "Guerilla Sniper",
    "CD_LW_PMC_Heavy": "LW PMC Heavy",
    "CD_PMC_Captain": "PMC Captain",
    "CD_PMC_Elite": "PMC Elite",
    "CD_PMC_Heavy": "PMC Heavy",
    "CD_PMC_Sniper": "PMC Sniper",
    "CD_PMC_Tutorial": "PMC Tutorial",
    "CD_Wildlife_Bird": "Bird",
    "CD_Wildlife_Boar": "Boar",
    "CD_Wildlife_Pig": "Pig",
}


def get_armor_key(d: dict) -> str:
    """Shorten armor key

    "SelfArmor": [
      {
        "Key": "BlueprintGeneratedClass'/Game/Weapon/DamageTypes/FT_Explosive.FT_Explosive_C'",
        "Value": 0.15
      }, ...
    ]
    """
    key = d.get("Key")
    pos = key.rfind(".")
    if pos != -1:
        key = key[pos + 1:]
    pos = key.rfind("_C")
    if pos != -1:
        key = key[:pos]
    return key


def parse_damage_zone_modifiers(damage_zone_modifiers: list[dict]) -> dict[str, str]:
    """Flatern information about character body part incoming damage modifiers

    # ----- Version 2.5.0 -----
    "DamageZoneModifiers": [
      {
        "ESFDamageZone::Head": {
          "DamageZone": "ESFDamageZone::Head",
          "DamageModifier": 2.0,
          "bAllowDowned": false
        }
      }, ...
    ],

    ----- Version 3.0.0 -----
    "DamageZoneModifiers": [
      {
        "Key": "EILLDamageZone::Head",
        "Value": {
          "DamageZone": "EILLDamageZone::Head",
          "DamageModifier": 2.0,
          "bAllowDowned": false
        }
      }
    ],
    """
    modifiers = {}
    for modifier in damage_zone_modifiers:

        # this block converts v3.0.0 to v2.5.0 format
        if "Key" in modifier and "Value" in modifier:
            key = modifier["Key"]
            val = modifier["Value"]
            val["DamageZone"] = key
            modifier = {key: val}  # noqa: PLW2901 - it is intended to modify format so we can use same parser

        for target in modifier.values():
            k = target.get("DamageZone")
            pos = k.find("::")
            if pos != -1:
                k = k[pos + 2:]
            v = target.get("DamageModifier")
            if k and v:
                modifiers[k] = v
    return modifiers


def extract_characters(loader: Loader) -> dict[str, Any]:
    """Extract Fireteam, Predator, NPC and fauna characters"""
    characters = []
    have = set()  # to filter out Male/Female variants
    for deninition_path, definition in list(loader.items()):
        if not definition.name.startswith("CD_"):
            continue

        if definition.name.endswith("_Base"):
            continue

        index = 0
        if len(definition.data) != 1:
            log.warning("Character definition with multiple items!: %s", definition.path)

        character = loader.extract(deninition_path, index, {
            "Name": str,
            "Properties.Armor": partial(extract_list_of_dicts, get_armor_key, "Value"),
            "Properties.ClassIcon.ObjectPath": str,
            "Properties.ClassName.LocalizedString": str,
            "Properties.ClassTag.TagName": str,
            "Properties.DamageZoneModifiers": parse_damage_zone_modifiers,
            "Properties.DownedHealth": float,
            "Properties.DownedHealthBleed": float,
            "Properties.EnergyRegenPerSecond": float,
            "Properties.EnergyUseReductionPerStack": float,
            "Properties.ExhaustionDuration": float,
            "Properties.FactionTag.TagName": str,
            "Properties.Health": float,
            "Properties.MaxEnergy": float,
            "Properties.MaxGearWeight": int,
            "Properties.MaxPerkPoints": int,
            "Properties.MeleeAttackStaminaRegenMultiplier": float,
            "Properties.MeleeDamageMultiplier": float,
            "Properties.PredkourSpeedModifier": float,
            "Properties.SelfArmor": partial(extract_list_of_dicts, get_armor_key, "Value"),
            "Properties.SpeedModifier": float,
            "Properties.Stamina": float,
            "Properties.StaminaRecoveryRate": float,
            "Properties.HealthArmor.EditorCurveData": extract_curve,
            "Properties.MaxBeamSwitchDistance": float,
        }, inheritance_key="Template.ObjectPath")

        for suffix in (
            "_Female",
            "_Male",
            "_Hat",
            "_Helmet",
            "_HeavyHelmet",
            "_NoHelmet",
        ):
            if character["Name"].endswith(suffix):
                character["Name"] = character["Name"].removesuffix(suffix)
        if character["Name"] in have:
            continue

        characters.append(character)
        have.add(character["Name"])
    return characters


def characters_data(characters: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Prepare characters data for documentation"""
    yautja = []
    ooman = []
    npc = []

    if any(ch for ch in characters if ch.get("Properties.HealthArmor.EditorCurveData")):
        log.warning("Illfonic started to use HealthArmor on characters!")

    for character in characters:
        character_id = character.get("Name")
        character_name = character.get("Properties.ClassName.LocalizedString")
        faction = character.get("Properties.FactionTag.TagName")

        if faction == WEAPON_PREDATOR:
            armor = character.get("Properties.Armor")["Bullet_Shotgun"]
            effective_hp = character.get("Properties.Health") * armor
            yautja.append({
                "id": character_id,
                "name": character_name,
                "icon": character.get("Properties.ClassIcon.ObjectPath"),
                "health": character.get("Properties.Health"),
                "downed_health": character.get("Properties.DownedHealth"),
                "downed_bleed": character.get("Properties.DownedHealthBleed"),
                "stamina": character.get("Properties.Stamina"),
                "stamina_recovery": character.get("Properties.StaminaRecoveryRate"),
                "exhaustion_duration": character.get("Properties.ExhaustionDuration"),
                "speed_modifier": character.get("Properties.SpeedModifier", 1.0),
                "predkour_modifier": character.get("Properties.PredkourSpeedModifier", 1.0),
                "melee_modifier": character.get("Properties.MeleeDamageMultiplier", 1.0),
                "melee_stamina": character.get("Properties.MeleeAttackStaminaRegenMultiplier", 1.0),
                "energy": character.get("Properties.MaxEnergy"),
                "energy_recovery": character.get("Properties.EnergyRegenPerSecond"),
                "max_gear": character.get("Properties.MaxGearWeight", 9),
                "max_perk": character.get("Properties.MaxPerkPoints", 9),
                "damage_zones": character.get("Properties.DamageZoneModifiers"),
                "armor": character.get("Properties.Armor"),
                "beam_switch": character.get("Properties.MaxBeamSwitchDistance"),
                "source": character.get("_source"),
            })
        elif faction == WEAPON_HUMAN:
            ooman.append({
                "id": character_id,
                "name": character_name,
                "icon": character.get("Properties.ClassIcon.ObjectPath"),
                "health": character.get("Properties.Health"),
                "downed_health": character.get("Properties.DownedHealth"),
                "downed_bleed": character.get("Properties.DownedHealthBleed"),
                "stamina": character.get("Properties.Stamina"),
                "stamina_recovery": character.get("Properties.StaminaRecoveryRate"),
                "exhaustion_duration": character.get("Properties.ExhaustionDuration"),
                "speed_modifier": character.get("Properties.SpeedModifier", 1.0),
                "max_gear": character.get("Properties.MaxGearWeight", 9),
                "max_perk": character.get("Properties.MaxPerkPoints", 9),
                "melee_modifier": character.get("Properties.MeleeDamageMultiplier", 1.0),
                "melee_stamina": character.get("Properties.MeleeAttackStaminaRegenMultiplier", 1.0),
                "damage_zones": character.get("Properties.DamageZoneModifiers"),
                "armor": character.get("Properties.Armor"),
                "self_armor": character.get("Properties.SelfArmor"),
                "source": character.get("_source"),
            })
        else:
            npc.append({
                "id": character_id,
                "name": NPC_NAMES.get(character_id, character_id),
                "health": character.get("Properties.Health"),
                "stamina": character.get("Properties.Stamina"),
                "speed_modifier": character.get("Properties.SpeedModifier"),
                "damage_zones": character.get("Properties.DamageZoneModifiers"),
                "armor": character.get("Properties.Armor"),
                "self_armor": character.get("Properties.SelfArmor"),
                "source": character.get("_source"),
            })

    return {
        "predator": yautja,
        "fireteam": ooman,
        "npc": npc,
    }
