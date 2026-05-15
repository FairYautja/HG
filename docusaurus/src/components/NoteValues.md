:::note[General note about values represented in the table above]
Values are extracted directly from the game's data files (Unreal Engine .pak files), but they may be inaccurate for several reasons.

Some values are straightforward and displayed exactly as stored in the data (e.g., perk weight). However, other values require calculations and may be overridden by specific classes or weapon types, or modified by additional factors.

For example, weapon damage is determined by multiple variables, including:
  * The character using the weapon
  * The weapon itself
  * The projectile the weapon fires
  * The armor modifier of the character receiving the damage
We may not be aware of all the attributes required to form an exact formula for calculating these values. Additionally, Illfonic may override or modify certain values directly in the game code (via C++ methods), making such changes inaccessible from the game data files.

For more details on how we extract values, check the [Nerds](/nerds) section.
:::
