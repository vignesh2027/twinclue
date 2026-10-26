# Twinclue Puzzle Audit v2

- Audit version: 2
- Date: 2026-10-26T10:18:14.913Z
- Solver models: openai/gpt-oss-20b, qwen/qwen3.8-27b
- Fact model: openai/gpt-oss-20b
- Current audited pack: 0/8 passed (0.0%)
- Pass rule: No solver may accept either half alone; a majority must accept both halves; fact verifier must mark both halves true.

## What v1 missed

V1 used one solver, reasoning effort `none`, and only 128 completion tokens. It asked three separate questions but failed a solo clue only when the single solver’s best answer was accepted by the referee. It did not verify clue facts. That combination produced false confidence. Hand review found the following giveaways and invented claims:

- gen-042 half A revealed the answer through “Master Blaster” and debut age.
- gen-160 half B named the Yamuna river and Agra.
- gen-016 half B claimed an Indian 10-rupee note appearance.
- gen-036 Lagaan half A.
- gen-104 Dangal halves A and B.
- gen-379 Kilimanjaro half A.
- gen-283 Beethoven half A.
- gen-133 Jai Ho half A.
- gen-421 Mumbai half B.
- gen-251 Miso half A.
- gen-001 Mysore Palace half B invented a 1995 film scene.
- gen-004 Pav Bhaji half B made a nonsensical film link.
- gen-142 Biryani half B confused Punjab with biryani origin.

## What v2 changes

V2 asks each configured solver for one best answer plus two alternatives on each solo half and on the combined clue. Any solver accepted by the referee on either solo half fails the puzzle. A majority must have an accepted combined answer. A separate fact model must mark both halves true. Alternatives may include the answer, as expected for an ambiguous half. The fingerprint includes the v2 version and full model panel. Blind requests use opaque IDs and never include the answer. Each request has at most one clue from a puzzle. Fact checks receive answer and both halves.

## V2 rounds

| Round | Puzzles audited | Passed |
| --- | ---: | ---: |
| 1 | 8 | 0 |

## Generation stats

- Candidates generated: 0
- Failed validation: 0
- Passed validation and failed v2 audit: 0
- Candidates kept: 0
- Retained old v2 passes: 0
- Current v2-verified pack size: 0
- Current checked-in pack size: 60
- Generation model: not started because old-pack audit is incomplete
- Solver panel: openai/gpt-oss-20b, qwen/qwen3.8-27b
- Fact model: openai/gpt-oss-20b

## Token usage

| Model | Prompt tokens | Completion tokens | Total tokens |
| --- | ---: | ---: | ---: |
| openai/gpt-oss-20b | 6317 | 52016 | 58333 |
| qwen/qwen3.8-27b | 1408 | 5896 | 7304 |

## Pack coverage

| Puzzle | Answer | V2 status |
| --- | --- | --- |
| pack-02 | Hourglass | FAIL |
| pack-03 | Lighthouse | FAIL |
| pack-04 | Rainbow | FAIL |
| pack-05 | Piano | FAIL |
| pack-06 | Telescope | FAIL |
| pack-08 | Minecraft | FAIL |
| pack-09 | Pac-Man | FAIL |
| pack-10 | Zelda | FAIL |
| pack-11 | Sonic the Hedgehog | PENDING |
| pack-12 | Among Us | PENDING |
| pack-13 | Super Mario Bros. | PENDING |
| pack-14 | The Beatles | PENDING |
| pack-15 | Taylor Swift | PENDING |
| pack-17 | Violin | PENDING |
| pack-23 | Photosynthesis | PENDING |
| pack-24 | DNA | PENDING |
| pack-26 | Coffee | PENDING |
| pack-27 | Phonograph | PENDING |
| pack-28 | The Moon | PENDING |
| pack-29 | Wimbledon | PENDING |
| pack-30 | Basketball | PENDING |
| pack-33 | Tour de France | PENDING |
| pack-37 | Margherita pizza | PENDING |
| pack-42 | Masala dosa | PENDING |
| pack-44 | Gulab jamun | PENDING |
| pack-45 | Pani puri | PENDING |
| pack-46 | Paris | PENDING |
| pack-48 | Sahara | PENDING |
| pack-54 | The Wizard of Oz | PENDING |
| pack-55 | Jaws | PENDING |
| pack-56 | Spirited Away | PENDING |
| pack-59 | Toy Story | PENDING |
| gen-001 | Mysore Palace | PENDING |
| gen-004 | Pav Bhaji | PENDING |
| gen-016 | Mahatma Gandhi | PENDING |
| gen-035 | Sikkim | PENDING |
| gen-036 | Lagaan | PENDING |
| gen-283 | Beethoven's 5th Symphony | PENDING |
| gen-020 | Hubble Space Telescope | PENDING |
| gen-027 | Lake Baikal | PENDING |
| gen-379 | Mount Kilimanjaro | PENDING |
| gen-395 | Sholay | PENDING |
| gen-042 | Sachin Tendulkar | PENDING |
| gen-251 | Miso soup | PENDING |
| gen-402 | Sundarbans | PENDING |
| gen-174 | Queen | PENDING |
| gen-225 | Cricket World Cup | PENDING |
| gen-109 | A.R. Rahman | PENDING |
| gen-407 | Virat Kohli | PENDING |
| gen-080 | The Shawshank Redemption | PENDING |
| gen-133 | Jai Ho | PENDING |
| gen-100 | Mango Lassi | PENDING |
| gen-104 | Dangal | PENDING |
| gen-421 | Mumbai | PENDING |
| gen-380 | Raga Bhairavi | PENDING |
| gen-142 | Biryani | PENDING |
| gen-101 | Mount Fuji | PENDING |
| gen-160 | Taj Mahal | PENDING |
| gen-284 | Paneer Tikka | PENDING |
| gen-335 | Paneer | PENDING |

The rows marked PENDING have not been audited.

## Per-puzzle audit details

### pack-02: Hourglass (FAIL)
- Half A: openai/gpt-oss-20b: hourglass; alternatives sand timer, stopwatch; referee accepted; qwen/qwen3.8-27b: timer; alternatives hourglass, metronome; referee rejected
- Half B: openai/gpt-oss-20b: B; alternatives Letter B, B‑shape; referee rejected; qwen/qwen3.8-27b: letter B; alternatives peanut, figure-eight; referee rejected
- Both halves: openai/gpt-oss-20b: egg timer; alternatives sand timer, hourglass; referee rejected; qwen/qwen3.8-27b: hourglass; alternatives sand timer, hourglass timer; referee accepted
- Fact check A: true, Commonly used for timing board games.
- Fact check B: true, Classic hourglass shape with two chambers.
- Failure: halfA alone: openai/gpt-oss-20b answered "hourglass".
- Failure: Both halves accepted by 1/2 solvers; majority required.

### pack-03: Lighthouse (FAIL)
- Half A: openai/gpt-oss-20b: lighthouse; alternatives pier, boathouse; referee accepted; qwen/qwen3.8-27b: lighthouse; alternatives tower, monument; referee accepted
- Half B: openai/gpt-oss-20b: Beacon; alternatives Light, Signal light; referee rejected; qwen/qwen3.8-27b: lighthouse; alternatives beacon, lantern; referee accepted
- Both halves: openai/gpt-oss-20b: lighthouse; alternatives beacon, sea beacon; referee accepted; qwen/qwen3.8-27b: lighthouse; alternatives beacon, signal light; referee accepted
- Fact check A: true, Lighthouse stands tall beside water.
- Fact check B: true, Guides ships with visual beacon at night.
- Failure: halfA alone: openai/gpt-oss-20b answered "lighthouse"; qwen/qwen3.8-27b answered "lighthouse".
- Failure: halfB alone: qwen/qwen3.8-27b answered "lighthouse".

### pack-04: Rainbow (FAIL)
- Half A: openai/gpt-oss-20b: meteor; alternatives shooting star, fireworks; referee rejected; qwen/qwen3.8-27b: rainbow; alternatives aurora, mirage; referee accepted
- Half B: openai/gpt-oss-20b: Blue Hour; alternatives Blue Ray, Blue Flash; referee rejected; qwen/qwen3.8-27b: rainbow; alternatives halo, mirage; referee accepted
- Both halves: openai/gpt-oss-20b: rainbow; alternatives halo, glory; referee accepted; qwen/qwen3.8-27b: rainbow; alternatives sunbeam, optical phenomenon; referee accepted
- Fact check A: true, Brief optical phenomenon that brightens sky.
- Fact check B: true, Occurs when sunlight refracts through droplets.
- Failure: halfA alone: qwen/qwen3.8-27b answered "rainbow".
- Failure: halfB alone: qwen/qwen3.8-27b answered "rainbow".

### pack-05: Piano (FAIL)
- Half A: openai/gpt-oss-20b: piano; alternatives guitar, drum; referee accepted; qwen/qwen3.8-27b: clock; alternatives ruler, metronome; referee rejected
- Half B: openai/gpt-oss-20b: Piano; alternatives Keyboard, Organ; referee accepted; qwen/qwen3.8-27b: piano; alternatives organ, harpsichord; referee accepted
- Both halves: openai/gpt-oss-20b: piano; alternatives keyboard, organ; referee accepted; qwen/qwen3.8-27b: piano; alternatives organ, harpsichord; referee accepted
- Fact check A: true, Widely seen in homes and schools.
- Fact check B: true, Player can play melody and chords.
- Failure: halfA alone: openai/gpt-oss-20b answered "piano".
- Failure: halfB alone: openai/gpt-oss-20b answered "Piano"; qwen/qwen3.8-27b answered "piano".

### pack-06: Telescope (FAIL)
- Half A: openai/gpt-oss-20b: microscope; alternatives telescope, binoculars; referee rejected; qwen/qwen3.8-27b: magnifier; alternatives microscope, monocle; referee rejected
- Half B: openai/gpt-oss-20b: Mirror; alternatives Lens, Reflector; referee rejected; qwen/qwen3.8-27b: Telescope; alternatives Reflecting telescope, Newtonian telescope; referee accepted
- Both halves: openai/gpt-oss-20b: telescope; alternatives microscope, binoculars; referee accepted; qwen/qwen3.8-27b: Telescope; alternatives Binoculars, Microscope; referee accepted
- Fact check A: true, Used by scientists to observe cosmos.
- Fact check B: true, Reflector gathers light from distant objects.
- Failure: halfB alone: qwen/qwen3.8-27b answered "Telescope".

### pack-08: Minecraft (FAIL)
- Half A: openai/gpt-oss-20b: Minecraft; alternatives Roblox, Terraria; referee accepted; qwen/qwen3.8-27b: zelda; alternatives minecraft, tomb raider; referee rejected
- Half B: openai/gpt-oss-20b: Minecraft; alternatives Terraria, Roblox; referee accepted; qwen/qwen3.8-27b: Minecraft; alternatives Sandbox game, Open-world building game; referee accepted
- Both halves: openai/gpt-oss-20b: minecraft; alternatives terraria, roblox; referee accepted; qwen/qwen3.8-27b: Minecraft; alternatives Terraria, Roblox; referee accepted
- Fact check A: true, Popular game fostering exploration and creation.
- Fact check B: true, Players mine and alter terrain.
- Failure: halfA alone: openai/gpt-oss-20b answered "Minecraft".
- Failure: halfB alone: openai/gpt-oss-20b answered "Minecraft"; qwen/qwen3.8-27b answered "Minecraft".

### pack-09: Pac-Man (FAIL)
- Half A: openai/gpt-oss-20b: Mario; alternatives MegaMan, Kirby; referee rejected; qwen/qwen3.8-27b: sonic; alternatives pac-man, space invader; referee rejected
- Half B: openai/gpt-oss-20b: Pac-Man; alternatives Bomberman, Snake; referee accepted; qwen/qwen3.8-27b: Pac-Man; alternatives Labyrinth game, Maze game; referee accepted
- Both halves: openai/gpt-oss-20b: pac-man; alternatives ms-pac-man, pacman; referee accepted; qwen/qwen3.8-27b: Pac-Man; alternatives Ms. Pac-Man, Dig Dug; referee accepted
- Fact check A: true, Iconic bright yellow arcade character.
- Fact check B: true, Maze chase with simple directional control.
- Failure: halfB alone: openai/gpt-oss-20b answered "Pac-Man"; qwen/qwen3.8-27b answered "Pac-Man".

### pack-10: Zelda (FAIL)
- Half A: openai/gpt-oss-20b: Zelda; alternatives FinalFantasy, DragonQuest; referee accepted; qwen/qwen3.8-27b: zelda; alternatives dragon quest, final fantasy; referee accepted
- Half B: openai/gpt-oss-20b: The Legend of Zelda; alternatives Metroid, Super Mario Odyssey; referee accepted; qwen/qwen3.8-27b: The Legend of Zelda; alternatives Action-adventure game, Metroid; referee accepted
- Both halves: openai/gpt-oss-20b: legend-of-zelda; alternatives the-legend-of-zelda, zelda; referee accepted; qwen/qwen3.8-27b: The Legend of Zelda; alternatives Métroid, Final Fantasy; referee accepted
- Fact check A: true, Nintendo's enduring fantasy adventure saga.
- Fact check B: true, Blends puzzles, exploration, and combat.
- Failure: halfA alone: openai/gpt-oss-20b answered "Zelda"; qwen/qwen3.8-27b answered "zelda".
- Failure: halfB alone: openai/gpt-oss-20b answered "The Legend of Zelda"; qwen/qwen3.8-27b answered "The Legend of Zelda".
