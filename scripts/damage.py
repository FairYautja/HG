"""Weapon damage extractors"""

from functools import partial
from typing import Any

from . import log
from .loader import Loader
from .utils import get_in, split_index


def damage_melee(loader: Loader, path: str, modes: dict[str, list[str]]) -> list[dict[str, Any]]:
    """Normalize melee damage"""
    result = []
    for mode, combo in modes.items():
        if mode not in ("single", "combo", "weapon"):  # "weapon" is for FT when used while wielding rifle
            log.error('Invalid damage mode "%s" for damage_melee(%s):', mode, path)
            continue

        damage = []
        rng = []
        obj = None
        for step in combo:
            obj_path, obj_index = split_index(path % step)
            definition = loader.get(obj_path)
            obj = definition.data[obj_index]
            damage.append(get_in(obj, "Properties.Attackdamage"))
            rng.append(get_in(obj, "Properties.AttackRange"))
            damage_path = get_in(obj, "Properties.DamageType.ObjectPath")

        info = damage_type_info(loader, damage_path)
        entry = {
            "type": f"melee_{mode}",
            "damage": damage,
            "damage_type": info["category"] if info else None,
            "headshot": info["headshot"] if info else None,
            "range": rng,
        }
        # Capture AoE/stun from the last action step (e.g. Norse Hammer secondary)
        if obj is not None:
            impact_radius = get_in(obj, "Properties.ImpactRadius")
            impact_status = get_in(obj, "Properties.ImpactStatusEffect.ObjectPath")
            if impact_radius is not None:
                entry["impact_radius"] = impact_radius
            if impact_status is not None:
                entry["impact_status"] = impact_status.split("/")[-1].split(".")[0]
        result.append(entry)
    return result


def damage_type(loader: Loader, damage_path: str) -> str|None:
    """Resolve weapon damage type (category string only, for use as functools.partial)"""
    info = damage_type_info(loader, damage_path)
    return info["category"] if info else None


def damage_type_info(loader: Loader, damage_path: str) -> dict|None:
    """Resolve weapon damage type and headshot multiplier.

    If the DamageType asset is not present in the export (common for Blueprint
    damage type classes), fall back to extracting the category from the class
    name in the ObjectPath itself, e.g. 'Arrow.0' -> 'Arrow'.
    """
    if not damage_path:
        return None

    path, index = split_index(damage_path)
    index = 1  # It points to 0, but the damage is defined at index 1

    try:
        definition = loader.get(path)
    except KeyError:
        # DamageType Blueprint not exported — derive category from the file name.
        category = path.split("/")[-1]  # e.g. 'Slashing_BattleAxe'
        log.debug("DamageType not in export, derived category '%s' from path: %s", category, path)
        return {"category": category, "headshot": None}

    obj = definition.data[index]
    damage = get_in(obj, "Properties.DamageCategory")
    if not damage:
        # Also fall back to file name if DamageCategory property is absent
        category = path.split("/")[-1]
        log.debug("No DamageCategory in %s, using file name '%s'", damage_path, category)
        return {"category": category, "headshot": None}

    pos = damage.rfind(" ::")
    if pos != -1:
        damage = damage[pos + 2:]

    headshot = get_in(obj, "Properties.HeadshotDamageMultiplier")

    return {"category": damage, "headshot": headshot}


def damage_combi_throw(loader: Loader, path: str, damage_curve_path: str, damage_type_key: str) -> dict[str, Any]:
    obj_path, obj_index = split_index(path)
    damage = loader.extract(obj_path, obj_index, {
        damage_type_key: partial(damage_type, loader),
    })
    log.error(damage)
    obj_path, obj_index = split_index(damage_curve_path)
    damage_curve = loader.extract(obj_path, obj_index, {
        "Properties.FloatCurve.Keys": list,
    })
    curve = damage_curve.get("Properties.FloatCurve.Keys")
    damage_value = curve[0]["Value"]
    if not all(v["Value"] == damage_value for v in curve):
        log.warning("%s: damage value differs now!", damage_curve_path)

    return {
        "type": "throw",
        "damage": damage_value,
        "damage_type": damage.get(damage_type_key),
    }


def damage_disc_throw(loader: Loader, path: str) -> dict[str, Any]:
    obj_path, obj_index = split_index(path)
    damage = loader.extract(obj_path, obj_index, {
        "Properties.DamageType.ObjectPath": partial(damage_type_info, loader),
        "Properties.DamageOnHitInner": int,
        "Properties.DamageOnHitOuter": int,
        "Properties.Health": int,
    })
    info = damage.get("Properties.DamageType.ObjectPath") or {}
    return {
        "type": "throw",
        "damage": damage.get("Properties.DamageOnHitInner"),
        "damage_back": damage.get("Properties.DamageOnHitOuter"),
        "damage_type": info.get("category"),
        "headshot": info.get("headshot"),
        "health": damage.get("Properties.Health"),
    }

def damage_plasma(loader: Loader, path: str) -> dict[str, Any]:
    obj_path, obj_index = split_index(path)
    damage = loader.extract(obj_path, obj_index, {
        "Properties.DamageTypeClass.ObjectPath": partial(damage_type_info, loader),
        "Properties.DirectHitDamage": int,
        "Properties.SplashBaseDamage": int,
        "Properties.SplashMinimiumDamage": int,
        "Properties.SplashDamageInnerRadius": int,
        "Properties.SplashDamageOuterRadius": int,
    })
    info = damage.get("Properties.DamageTypeClass.ObjectPath") or {}
    return {
        "type": "fire",
        "damage_type": info.get("category"),
        "headshot": info.get("headshot"),
        "damage": damage.get("Properties.DirectHitDamage"),
        "splash_damage_max": damage.get("Properties.SplashBaseDamage"),
        "splash_damage_min": damage.get("Properties.SplashMinimiumDamage"),
        "splash_radius_inner": damage.get("Properties.SplashDamageInnerRadius"),
        "splash_radius_outer": damage.get("Properties.SplashDamageOuterRadius"),
    }

def damage_bow(loader: Loader, projectile_path: str, damage_path: str) -> dict[str, Any]:
    obj_path, obj_index = split_index(projectile_path)
    projectile = loader.extract(obj_path, obj_index, {
        "Properties.HitDamageType.ObjectPath": partial(damage_type_info, loader),
    })
    obj_path, obj_index = split_index(damage_path)
    damage = loader.extract(obj_path, obj_index, {
        "Properties.FloatCurve.Keys": list,
    })
    curve = damage.get("Properties.FloatCurve.Keys")
    info = projectile.get("Properties.HitDamageType.ObjectPath") or {}
    return {
        "type": "fire",
        "damage_type": info.get("category"),
        "headshot": info.get("headshot"),
        "damage": [round(v["Value"]) for v in curve],
        "damage_time": [float(v["Time"]) for v in curve],
    }

def damage_dart(loader: Loader, damage_type_path: str, projectile_path: str, damage_path: str) -> dict[str, Any]:
    info = damage_type_info(loader, damage_type_path)
    obj_path, obj_index = split_index(projectile_path)
    projectile = loader.extract(obj_path, obj_index, {
        "Properties.DamagePerSecond": int,
        "Properties.EffectLifetime": int,
    })
    obj_path, obj_index = split_index(damage_path)
    damage = loader.extract(obj_path, obj_index, {
        "Properties.FloatCurve.Keys": list,
    })
    curve = damage.get("Properties.FloatCurve.Keys")
    damage = curve[0]["Value"]
    if not all(v["Value"] == damage for v in curve):
        log.warning("%s: damage value differs now!", damage_path)

    return {
        "type": "fire",
        "damage_type": info["category"] if info else None,
        "headshot": info["headshot"] if info else None,
        "damage": damage,
        "damage_fire": projectile.get("Properties.DamagePerSecond"),
        "fire_time": projectile.get("Properties.EffectLifetime"),
    }

def damage_rifle(loader: Loader, path: str) -> dict[str, Any]:
    obj_path, obj_index = split_index(path)
    fire = loader.extract(obj_path, obj_index, {
        "Properties.DamageType.ObjectPath": partial(damage_type, loader),
        "Properties.RateOfFire": int,
        "Properties.MaxRange": int,
        "Properties.SpreadCurve.ObjectPath": str,
        "Properties.RecoilCurve.ObjectPaht": str,
        "Properties.DamageCurve.ObjectPath": str,
        "Properties.MinPellets": int,
        "Properties.MaxPellets": int,
    })
    damage_path = fire.get("Properties.DamageCurve.ObjectPath")
    obj_path, obj_index = split_index(damage_path)
    damage = loader.extract(obj_path, obj_index, {
        "Properties.FloatCurve.Keys": list,
    })
    curve = damage.get("Properties.FloatCurve.Keys")
    return {
        "type": "projectile",
        "damage_type": fire.get("Properties.DamageType.ObjectPath"),
        "damage": [float(v["Value"]) for v in curve],
        "distance": [float(v["Time"]) for v in curve],
        "fire_rate": fire.get("Properties.RateOfFire"),
        "max_range": fire.get("Properties.MaxRange"),
        **({"pellets": fire.get("Properties.MinPellets")} if fire.get("Properties.MinPellets") is not None else {}),
    }


def damage_acig(loader: Loader, projectile_path: str) -> dict[str, Any]:
    """ACIG anti-cloak grenade — area denial, not a direct damage weapon."""
    obj_path, obj_index = split_index(projectile_path)
    projectile = loader.extract(obj_path, obj_index, {
        "Properties.GrenadeLifetime": float,
        "Properties.SplashDamageInnerRadius": float,
        "Properties.SplashDamageOuterRadius": float,
    })
    # The pain volume component stores the DPS — read it directly from the file
    # since loader.extract only reads one object index
    obj_path_resolved, _ = split_index(projectile_path)
    definition = loader.get(obj_path_resolved)
    dps = None
    for obj in definition.data:
        val = obj.get("Properties", {}).get("Primary Base Damage Per Second")
        if val is not None:
            dps = val
            break
    radius = projectile.get("Properties.SplashDamageOuterRadius") or \
             projectile.get("Properties.SplashDamageInnerRadius")
    return {
        "type": "acig",
        "damage_type": "AntiCloak",
        "damage_per_second": dps,
        "radius": radius,
        "duration": projectile.get("Properties.GrenadeLifetime"),
    }


def damage_grenade_launcher(loader: Loader, path: str, projectile_path: str) -> dict[str, any]:
    """Fireteam Grenade Launchers"""
    obj_path, obj_index = split_index(path)
    damage = loader.extract(obj_path, obj_index, {
        "Properties.DamageType.ObjectPath": partial(damage_type, loader),
        "Properties.RateOfFire": int,
    })
    obj_path, obj_index = split_index(projectile_path)
    projectile = loader.extract(obj_path, obj_index, {
        "Properties.DirectHitDamage": float,
        "Properties.SplashBaseDamage": float,
        "Properties.SplashMinimiumDamage": float,
        "Properties.SplashDamageInnerRadius": float,
        "Properties.SplashDamageOuterRadius": float,
    })
    return {
        "type": "grenade",
        "damage_type": damage.get("Properties.DamageType.ObjectPath"),
        "fire_rate": damage.get("Properties.RateOfFire"),
        "direct_hit_damage": projectile.get("Properties.DirectHitDamage"),
        "splash_damage_max": projectile.get("Properties.SplashBaseDamage"),
        "splash_damage_min": projectile.get("Properties.SplashMinimiumDamage"),
        "splash_radius_inner": projectile.get("Properties.SplashDamageInnerRadius"),
        "splash_radius_outer": projectile.get("Properties.SplashDamageOuterRadius"),
    }

def damage_grenade(loader: Loader, path: str) -> dict[str, any]:
    """Fireteam Frag Grenade"""
    obj_path, obj_index = split_index(path)
    damage = loader.extract(obj_path, obj_index, {
        "Properties.DamageTypeClass.ObjectPath": partial(damage_type, loader),
        "Properties.RateOfFire": int,
        "Properties.DirectHitDamage": float,
        "Properties.SplashBaseDamage": float,
        "Properties.SplashMinimiumDamage": float,
        "Properties.SplashDamageInnerRadius": float,
        "Properties.SplashDamageOuterRadius": float,
    })
    data = {
        "type": "grenade",
        "damage_type": damage.get("Properties.DamageTypeClass.ObjectPath"),
        "fire_rate": damage.get("Properties.RateOfFire"),
        "direct_hit_damage": damage.get("Properties.DirectHitDamage"),
        "splash_damage_max": damage.get("Properties.SplashBaseDamage"),
        "splash_damage_min": damage.get("Properties.SplashMinimiumDamage"),
        "splash_radius_inner": damage.get("Properties.SplashDamageInnerRadius"),
        "splash_radius_outer": damage.get("Properties.SplashDamageOuterRadius"),
    }
    return data

# TODO: It would be nice to resolve these files by code
DAMAGE_EXTRACTORS = {
    "WD_Predator_Sickle": ((
        damage_melee,
        "Content/DLC_Release/DLC_01/Weapon/Definitions/Predator/Sickle/Pred_Melee_Sickle_%s.0",
        {"single": ["01"], "combo": ["01", "02", "03"]},
    ), ()),
    "WD_Predator_ElderSword_Base": ((
        damage_melee,
        "Content/Weapon/Definitions/Predator/ElderSword/Pred_Melee_Sword_%s.0",
        {"single": ["01"], "combo": ["01", "02", "03"]},
    ), ()),
    "WD_Predator_SmartDisc_Base": ((
        damage_melee,
        "Content/Weapon/Definitions/Predator/SmartDisc/Pred_SmartDisc_Melee_Light_%s.0",
        {"single": ["01"], "combo": ["01", "02", "03"]},
    ), (
        damage_disc_throw,
        "Content/Weapon/Definitions/Predator/SmartDisc/Smart_Disc_Proj.15",
    )),
    "WD_Predator_WristBlades_Base": ((
        damage_melee,
        "Content/Weapon/Definitions/Predator/WristBlades/Pred_Melee_Light_%s.0",
        {"single": ["01"], "combo": ["01", "02", "03"]},
    ), ()),
    "WD_Predator_CombiStick_Base": ((
        damage_melee,
        "Content/Weapon/Definitions/Predator/CombiStick/Pred_CombiMeleeAttack_%s.0",
        {"single": ["01"], "combo": ["01", "02", "03"]},
    ), (
        damage_combi_throw,
        "Content/Weapon/Definitions/Predator/CombiStick/Proj_CombiStick.6",
        "Content/Weapon/Definitions/Predator/CombiStick/CombiDamageCurve.0",
        "Properties.HitDamageType.ObjectPath",
    )),
    "WD_Predator_CombiStick_Trident": ((
        damage_melee,
        "Content/DLC_Release/FU_19/Weapon/Trident/Pred_TridentMeleeAttack_%s.0",
        {"single": ["01"], "combo": ["01", "02", "03"]},
    ), (
        damage_combi_throw,
        "Content/DLC_Release/FU_19/Weapon/Trident/Pred_CombistickTrident_Throw.0",
        "Content/DLC_Release/FU_19/Weapon/Trident/TridentDamageCurve.0",
        "Properties.DamageType.ObjectPath",
    )),
    "WD_Predator_WarClub_Base": ((
        damage_melee,
        "Content/Weapon/Definitions/Predator/WarClub/Pred_Melee_Club_%s.0",
        {"single": ["01"], "combo": ["01", "02", "03"]},
    ), ()),
    "WD_Predator_BerlinWeapon_Base": ((  # Ancient disk
        damage_melee,
        "Content/DLC_Release/FU_10/Weapon/Definitions/BerlinWeapon_%s.0",
        {"single": ["01"], "combo": ["01", "02", "03", "04"]},
    ), (
        damage_disc_throw,
        "Content/DLC_Release/FU_10/Weapon/Predator/BerlinWeapon/BerlinWeapon_Proj.13",
    )),
    "WD_Predator_Katana_Base": ((
        damage_melee,
        "Content/DLC_Release/DLC_02/Weapon/Definitions/Predator/Katana/Pred_Melee_Katana_%s.0",
        {"single": ["01"], "combo": ["01", "02", "03", "04"]},
    ), (
        damage_melee,
        "Content/DLC_Release/DLC_02/Weapon/Definitions/Predator/Katana/Pred_Melee_Katana_%s.0",
        {"single": ["03_Alt"]},
    )),
    "WD_Predator_HelsinkiWeapon_Base": (( # Hook
        damage_melee,
        "Content/DLC_Release/FU_11/Weapon/Definitions/HelsinkiWeapon/Pred_Melee_HelsinkiWeapon_%s.0",
        {"single": ["01"], "combo": ["01", "02", "03"]},
    ), (
        damage_melee,
        "Content/DLC_Release/FU_11/Weapon/Definitions/HelsinkiWeapon/Pred_Melee_HelsinkiWeapon_%s.0",
        {"single": ["03"]},
    )),
    "WD_Predator_RioWeapon_Base": (( # Norse Hammer
        damage_melee,
        "Content/DLC_Release/FU_07/Weapon/Definitions/Predator/RioWeapon/Pred_Melee_RioWeapon_%s.0",
        {"single": ["01"], "combo": ["01", "02", "03"]},
    ), (
        damage_melee,
        "Content/DLC_Release/FU_07/Weapon/Definitions/Predator/RioWeapon/Pred_Melee_RioWeapon_%s.0",
        {"single": ["03"]},
    )),
    "WD_Predator_BattleAxe_Base": ((
        damage_melee,
        "Content/DLC_Release/FU_05/Weapon/Predator/BattleAxe/Pred_Melee_BattleAxe_%s.0",
        {"single": ["01"], "combo": ["01", "02"]},
    ), (
        damage_melee,
        "Content/DLC_Release/FU_05/Weapon/Predator/BattleAxe/Pred_Melee_BattleAxe_%s.0",
        {"single": ["Heavy_01"]},
    )),
    "WD_Predator_Sword_Cid": ((
        damage_melee,
        "Content/DLC_Release/FU_21/Weapon/Sword_Cid/Pred_Melee_Cid_%s.0",
        {"single": ["01"], "combo": ["01", "02"]},
    ), (
        damage_melee,
        "Content/DLC_Release/FU_21/Weapon/Sword_Cid/Pred_Melee_Cid_%s.0",
        {"single": ["03"]},
    )),
    "WD_Predator_HandheldPlasmaCaster_Base": ((
        damage_plasma,
        "Content/Weapon/Definitions/Predator/Handheld_PlasmaCaster/HandheldPlasmaCaster_Projectile.3",
    ), ()),
    "WD_Predator_PlasmaCaster_Zeta": ((
        damage_plasma,
        "Content/DLC_Release/FU_20/Weapon/HandHeldPlasmaCaster_Zeta/HandheldPlasmaCaster_Zeta_Projectile.4",
    ), ()),
    "WD_Predator_PlasmaCaster_Base": ((
        damage_plasma,
        "Content/Weapon/Definitions/Predator/PlasmaCaster/PlasmaCaster_Projectile.7",
    ), ()),
    "WD_Predator_Bow_Base": ((
        damage_bow,
        "Content/Weapon/Definitions/Predator/Bow/Proj_Arrow_.8",
        "Content/Weapon/Definitions/Predator/Bow/ArrowDamageCurve.0",
    ), ()),
    "WD_Predator_HandheldTuscon_Base": ((
        damage_disc_throw,
        "Content/Weapon/Definitions/Predator/Tuscon/Smart_Tscon_Proj.15",
    ), ()),
    "WD_Predator_WristDart_CityHunter": ((
        damage_dart,
        "Content/DLC_Release/DLC_03/Weapon/Definitions/Predator/WristDart/WristDart.1",
        "Content/DLC_Release/DLC_03/Weapon/Definitions/Predator/WristDart/WristDartFireEffect.5",
        "Content/DLC_Release/DLC_03/Weapon/Definitions/Predator/WristDart/WristDartCurve.0",
    ), ()),
    "WD_Knife_Gear_Base": ((
        damage_melee,
        "Content/Weapon/Definitions/Fireteam/Melee/Knife_Attack%s.0",
        {"single": [""], "weapon": ["_Quick"]},
    ), (
        damage_melee,
        "Content/Weapon/Definitions/Fireteam/Melee/Knife_Attack%s.0",
        {"single": ["_Heavy"]},
    )),
    "WD_Rifle_AR-W_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/AssaultRifle/AR-W/AR-W_Fire.0",
    ), ()),
    "WD_Rifle_G-ROW_Base": ((
        damage_rifle,
        "/Content/Weapon/Definitions/Fireteam/AssaultRifle/G-ROW/G-ROW_Fire.0",
    ), ()),
    "WD_Rifle_GOSL-R_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/AssaultRifle/GOSL-R/GOSL-R_Fire.0",
    ), ()),
    "WD_Rifle_QR4_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/AssaultRifle/QR4/QR4_Fire.0",
    ), ()),
    "WD_Rifle_Hammerhead_Base": ((
        damage_rifle,
        "Content/DLC_Release/DLC_01/Weapon/Definitions/Fireteam/HammerHead/Hammerhead_Fire.0",
    ), (
        # Underbarrel M203 grenade launcher — inherits damage from D34-D projectile
        damage_grenade_launcher,
        "Content/DLC_Release/DLC_01/Weapon/Definitions/Fireteam/HammerHead/Hammerhead_Fire_ImpactGrenade.0",
        "Content/Weapon/Fireteam/SpecialHeavy/D34-D/Grenade_D34-D.8",
    )),
    "WD_Rifle_MERC_Base": ((
        damage_rifle,
        "Content/DLC_Release/DLC_04/Weapon/Definitions/Fireteam/MERC/MERC_Fire.0",
    ), (
        # Underbarrel M203 grenade launcher — inherits damage from D34-D projectile
        damage_grenade_launcher,
        "Content/DLC_Release/DLC_04/Weapon/Definitions/Fireteam/MERC/MERC_Fire_ImpactGrenade.0",
        "Content/Weapon/Fireteam/SpecialHeavy/D34-D/Grenade_D34-D.8",
    )),
    "WD_PlasmaAR_Base": ((
        damage_rifle,
        "Content/DLC_Release/FU_06/Weapon/Definitions/Fireteam/PlasmaRifle/PlasmaRifle_FireProj.0",
    ), ()),
    "WD_SniperRifle_7EN_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/SniperRifle/7EN/7EN_Fire.0",
    ), ()),
    "WD_SniperRifle_ABR-Z_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/SniperRifle/ABR-Z/ABR-Z_Fire.0",
    ), ()),
    "WD_SniperRifle_SmallFoxWeapon_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/SniperRifle/SAWZ-50/SAWZ-50_Fire.0",
    ), ()),
    "WD_Shotgun_CS12_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/Shotgun/Cs12/CS12_FireMulti.0",
    ), ()),
    "WD_Shotgun_DJL33_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/Shotgun/DJL33/DJL33_FireMulti.0",
    ), ()),
    "WD_Shotgun_XDB12_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/Shotgun/XDB12/XDB12_Fire.0",
    ), ()),
    "WD_Pistol_1011-12_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/PistolSidearm/1011-12/1011-12_Fire.0",
    ), ()),
    "WD_Pistol_2XL_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/PistolSidearm/2XL/2XL_Fire.0",
    ), ()),
    "WD_Pistol_Grimtech19_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/PistolSidearm/Grimtech19/Grimtech19_Fire.0",
    ), ()),
    "WD_Minigun": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/Minigun/Minigun_Fire.0",
    ), ()),
    "WD_LMG_RP-103_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/LMG/RP-103/RP-103_Fire.0",
    ), ()),
    "WD_SMG_Z-06_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/SMG/Z-06/Z-06_Fire.0",
    ), ()),
    "WD_SMG_PDW-Z_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/SMG/PDW-Z/PDW-Z_Fire.0",
    ), ()),
    "WD_SMG_ZR-55_Base": ((
        damage_rifle,
        "Content/Weapon/Definitions/Fireteam/SMG/ZR-55/ZR-55_Fire.0",
    ), ()),
    "WD_OWLFAR_Base": ((
        damage_rifle,
        "Content/DLC_Release/FU_03/Weapon/Definitions/Fireteam/AssaultRifle/OWLFAR/OWLFAR_Fire.0",
    ), ()),
    "WD_GrenadeLauncher_PDL_Base": ((), ()),  # Motion Detector Launcher
    "WD_B34ST_Base": ((  # Rocket Launcher
        damage_grenade_launcher,
        "Content/DLC_Release/FU_06/Weapon/Definitions/Fireteam/SpecialHeavy/B34S-T/B34ST_Fire_Impact.0",
        "Content/DLC_Release/FU_06/Weapon/Fireteam/SpecialHeavy/B34S-T/Rocket_B34ST-Impact.5",
    ), ()),
    "WD_GrenadeLauncher_D34D_Base": ((  # Grenade Launcher
        damage_grenade_launcher,
        "Content/Weapon/Definitions/Fireteam/GrenadeLauncher/D34D/D34D_Fire_Impact.0",
        "Content/Weapon/Fireteam/SpecialHeavy/D34-D/Grenade_D34-D.8",
    ), ()),
    "WD_Grenade_Frag_FT": ((
        damage_grenade,
        "Content/Weapon/Fireteam/Grenade/Frag/Grenade_Frag.8",
    ), ()),
    "WD_Grenade_ACIG_Base": ((
        damage_acig,
        "Content/DLC_Release/FU_03/Weapon/Fireteam/Grenade/ACIG/Grenade_ACIG.10",
    ), ()),
}

def extract_attacks(loader: Loader, weapon: str) -> dict[str, Any]:
    """Extract damage info for the weapon"""
    attacks = DAMAGE_EXTRACTORS.get(weapon)
    if not attacks:
        #log.warning("No attack extractor for: %s", weapon)
        return {}

    damage = []

    primary, secondary = attacks

    if primary:
        method, *args = primary
        damage.append(method(loader, *args))

    if secondary:
        method, *args = secondary
        damage.append(method(loader, *args))

    return damage
