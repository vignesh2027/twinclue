# Twinclue Puzzle Pack Blind Audit

- Date: 2026-10-26T09:10:58.645Z
- Audit model: qwen/qwen3.8-27b
- Current result: 60/60 passed (100.0%)

Each round uses the same three-request blind prompt, referee, model and low-concurrency audit settings. Only changed or generated puzzles are queried; earlier passed puzzles are kept by fingerprint.

## Audit rounds

| Round | Puzzles audited | Passed |
| --- | ---: | ---: |
| 1 | 60 | 20 |
| 2 | 40 | 4 |
| 3 | 29 | 4 |
| 4 | 10 | 2 |
| 5 | 5 | 0 |
| 6 | 8 | 2 |
| 7 | 184 | 28 |

## Generated candidate batch

- Candidates generated: 421
- Failed validation: 237
- Passed validation and failed blind audit: 156
- Blind-audit passes generated: 28
- Generated puzzles kept: 28
- India-friendly puzzles in final pack: 21

Candidates were generated with openai/gpt-oss-120b, structurally checked by validatePuzzle, then judged by the unchanged blind auditor using qwen/qwen3.8-27b. The final pack retains 32 earlier passes and adds 28 generated passes.

## Puzzle results

### pack-02: Hourglass (PASS)
- Half A alone: best answer **timer**; referee **rejected**; alternatives: hourglass, ladybug timer.
- Half B alone: best answer **peanut**; referee **rejected**; alternatives: peanut shell cross-section, barbell outline.
- Both halves: best answer **hourglass**; referee **accepted**; alternatives: dart, bowling pin.

### pack-03: Lighthouse (PASS)
- Half A alone: best answer **Space Needle**; referee **rejected**; alternatives: Statue of Liberty, Pike Place Market.
- Half B alone: best answer **light**; referee **rejected**; alternatives: lighthouse beam, shoreline outline.
- Both halves: best answer **lighthouse**; referee **accepted**; alternatives: beacon, beacon tower.

### pack-04: Rainbow (PASS)
- Half A alone: best answer **aurora**; referee **rejected**; alternatives: eclipse, light show.
- Half B alone: best answer **Sun dog**; referee **rejected**; alternatives: Rainbow, Halo.
- Both halves: best answer **rainbow**; referee **accepted**; alternatives: sun dog, halo.

### pack-05: Piano (PASS)
- Half A alone: best answer **violin**; referee **rejected**; alternatives: guitar, piano.
- Half B alone: best answer **Guitar**; referee **rejected**; alternatives: Piano, Organ.
- Both halves: best answer **Piano**; referee **accepted**; alternatives: Organ, Accordion.

### pack-06: Telescope (PASS)
- Half A alone: best answer **Microscope**; referee **rejected**; alternatives: Binoculars, Telescope.
- Half B alone: best answer **Headlights**; referee **rejected**; alternatives: Searchlights, Radar antennas.
- Both halves: best answer **telescope**; referee **accepted**; alternatives: telescope, spyglass.

### pack-08: Minecraft (PASS)
- Half A alone: best answer **Monopoly**; referee **rejected**; alternatives: Chess, Checkers.
- Half B alone: best answer **Roblox**; referee **rejected**; alternatives: Minecraft, Terraria.
- Both halves: best answer **Minecraft**; referee **accepted**; alternatives: Terraria, No Man's Sky.

### pack-09: Pac-Man (PASS)
- Half A alone: best answer **Frostbyte**; referee **rejected**; alternatives: Pac-Man, Frostbyte.
- Half B alone: best answer **Tetris**; referee **rejected**; alternatives: Crazy Taxi, New Super Mario Bros..
- Both halves: best answer **Pac-Man**; referee **accepted**; alternatives: Wario Land, Pac-Land.

### pack-10: Zelda (PASS)
- Half A alone: best answer **Final Fantasy**; referee **rejected**; alternatives: Dragon Quest, Ys.
- Half B alone: best answer **Detective**; referee **rejected**; alternatives: Spy, Bounty Hunter.
- Both halves: best answer **The Legend of Zelda**; referee **accepted**; alternatives: Final Fantasy, Dragon Quest.

### pack-11: Sonic the Hedgehog (PASS)
- Half A alone: best answer **Comix Zone**; referee **unclear**; alternatives: Sonic the Hedgehog, Vectorman.
- Half B alone: best answer **Ferdinand**; referee **rejected**; alternatives: Pete the Cat, Dora the Explorer.
- Both halves: best answer **Sonic the Hedgehog**; referee **accepted**; alternatives: Crash Bandicoot, Taz.

### pack-12: Among Us (PASS)
- Half A alone: best answer **Words with Friends**; referee **rejected**; alternatives: Tag, Doodle Jump.
- Half B alone: best answer **The Resistance**; referee **rejected**; alternatives: Mafia, Undercover.
- Both halves: best answer **Among Us**; referee **accepted**; alternatives: Social Deduction, Mafia.

### pack-13: Super Mario Bros. (PASS)
- Half A alone: best answer **Sonic the Hedgehog**; referee **rejected**; alternatives: Crash Bandicoot, Spyro.
- Half B alone: best answer **Brawl Stars**; referee **rejected**; alternatives: Color Wars, World of Warships: Legends.
- Both halves: best answer **Super Mario**; referee **accepted**; alternatives: Super Mario Bros, Pokémon.

### pack-14: The Beatles (PASS)
- Half A alone: best answer **Queen**; referee **rejected**; alternatives: The Beatles, Elton John.
- Half B alone: best answer **Waterloo (band)**; referee **rejected**; alternatives: Retrovisor, Hall & Oates.
- Both halves: best answer **The Beatles**; referee **accepted**; alternatives: ABBA, Dolly Parton and Porter Wagoner.

### pack-15: Taylor Swift (PASS)
- Half A alone: best answer **Robin Thicke**; referee **rejected**; alternatives: Céline Dion, James Blunt.
- Half B alone: best answer **Lorde**; referee **rejected**; alternatives: Billie Eilish, Taylor Swift.
- Both halves: best answer **Taylor Swift**; referee **accepted**; alternatives: Taylor Swift, Adele.

### pack-17: Violin (PASS)
- Half A alone: best answer **harp**; referee **rejected**; alternatives: flute, oboe.
- Half B alone: best answer **create a noise**; referee **rejected**; alternatives: play music, create a sound.
- Both halves: best answer **violin**; referee **accepted**; alternatives: violin, fiddle.

### pack-23: Photosynthesis (PASS)
- Half A alone: best answer **Phototropism**; referee **rejected**; alternatives: Stomatal closure, Root hair development.
- Half B alone: best answer **sunlight**; referee **rejected**; alternatives: solar radiation, photosynthesis.
- Both halves: best answer **Photosynthesis**; referee **accepted**; alternatives: Photosynthesis in algae, Chemolithotrophy by plants.

### pack-24: DNA (PASS)
- Half A alone: best answer **nucleus**; referee **rejected**; alternatives: cytoplasm, organelles.
- Half B alone: best answer **gene**; referee **unclear**; alternatives: DNA, genome.
- Both halves: best answer **DNA**; referee **accepted**; alternatives: genetic material, hereditary material.

### pack-26: Coffee (PASS)
- Half A alone: best answer **Espresso**; referee **rejected**; alternatives: Coffee, Tea.
- Half B alone: best answer **Espresso**; referee **rejected**; alternatives: Coffee, Teff flour.
- Both halves: best answer **coffee**; referee **accepted**; alternatives: chicory coffee, dandelion root coffee.

### pack-27: Phonograph (PASS)
- Half A alone: best answer **Gramophone**; referee **rejected**; alternatives: Gramophone, Record Player.
- Half B alone: best answer **gramophone**; referee **rejected**; alternatives: vinyl record, phonograph.
- Both halves: best answer **phonograph**; referee **accepted**; alternatives: record player, turntable.

### pack-28: The Moon (PASS)
- Half A alone: best answer **star**; referee **rejected**; alternatives: moon, shooting star.
- Half B alone: best answer **Mars**; referee **unclear**; alternatives: Moon, Venus.
- Both halves: best answer **Moon**; referee **accepted**; alternatives: Saturn, Venus.

### pack-29: Wimbledon (PASS)
- Half A alone: best answer **US Open**; referee **rejected**; alternatives: Australian Open, Wimbledon.
- Half B alone: best answer **Lawn tennis**; referee **rejected**; alternatives: Tennis, Lawn bowls.
- Both halves: best answer **The Wimbledon Championships**; referee **accepted**; alternatives: The Australian Open, The US Open.

### pack-30: Basketball (PASS)
- Half A alone: best answer **Volleyball**; referee **rejected**; alternatives: Chess, Poker.
- Half B alone: best answer **Bowling**; referee **rejected**; alternatives: Bocce, Croquet.
- Both halves: best answer **Basketball**; referee **accepted**; alternatives: Team handball, Netball.

### pack-33: Tour de France (PASS)
- Half A alone: best answer **the London Marathon**; referee **rejected**; alternatives: the Tour de France, the World Cup.
- Half B alone: best answer **yellow jersey**; referee **rejected**; alternatives: green jersey, polka dot jersey.
- Both halves: best answer **Tour de France**; referee **accepted**; alternatives: Vuelta a España, Giro d'Italia.

### pack-37: Margherita pizza (PASS)
- Half A alone: best answer **Spaghetti alle vongole**; referee **rejected**; alternatives: Sfogliatella, Rajo al sugo.
- Half B alone: best answer **Margherita**; referee **rejected**; alternatives: Pizza Margherita, Neapolitan pizza.
- Both halves: best answer **Pizza Margherita**; referee **accepted**; alternatives: San Marzano tomato and buffalo mozzarella pizza, classic marble rind pizza.

### pack-42: Masala dosa (PASS)
- Half A alone: best answer **idli**; referee **rejected**; alternatives: idli-sambar set, uttapam.
- Half B alone: best answer **Idli with Sambar**; referee **rejected**; alternatives: Medu Vada with Sambar, Paniyaram with Chutney.
- Both halves: best answer **Masala dosa**; referee **accepted**; alternatives: Mysore masala dosa, Idiyappam.

### pack-44: Gulab jamun (PASS)
- Half A alone: best answer **Lassi**; referee **rejected**; alternatives: Gulab Jamun, Kheer.
- Half B alone: best answer **Doughnuts**; referee **rejected**; alternatives: Pudding Stuffed Doughnuts, Doughnuts Soaked in Spiced Cider.
- Both halves: best answer **gulab jamun**; referee **accepted**; alternatives: gulab jamun, jalebi.

### pack-45: Pani puri (PASS)
- Half A alone: best answer **Pakora**; referee **rejected**; alternatives: Puri Bhaji, Bombil Fritters.
- Half B alone: best answer **Lemon water**; referee **rejected**; alternatives: Lemon-infused broth, Ginger hot water.
- Both halves: best answer ** Pani Puri**; referee **accepted**; alternatives: Paani Puri, Golgappa.

### pack-46: Paris (PASS)
- Half A alone: best answer **Prague**; referee **rejected**; alternatives: Lisbon, Stockholm.
- Half B alone: best answer **The Seine**; referee **rejected**; alternatives: The Oise, The Aube.
- Both halves: best answer **Paris**; referee **accepted**; alternatives: Paris, Amsterdam.

### pack-48: Sahara (PASS)
- Half A alone: best answer **steppe**; referee **rejected**; alternatives: desert, savanna.
- Half B alone: best answer **Arctic Ocean**; referee **rejected**; alternatives: Norwegian Sea, Bay of Hudson.
- Both halves: best answer **Sahara Desert**; referee **accepted**; alternatives: Sahara Desert, Gobi Desert.

### pack-54: The Wizard of Oz (PASS)
- Half A alone: best answer **Wicked**; referee **rejected**; alternatives: The Wiz, Mary Poppins.
- Half B alone: best answer **The Wonderful Wizard of Oz**; referee **rejected**; alternatives: The Wiz, Emerald City.
- Both halves: best answer **The Wizard of Oz**; referee **accepted**; alternatives: Music of the Tundra, Waltz in the Green.

### pack-55: Jaws (PASS)
- Half A alone: best answer **Close Encounters of the Third Kind**; referee **rejected**; alternatives: Jaws, Empire of the Sun.
- Half B alone: best answer **Hothouse**; referee **rejected**; alternatives: Flesh and Bone, Great White.
- Both halves: best answer **Jaws**; referee **accepted**; alternatives: Jaws 2, Jaws III.

### pack-56: Spirited Away (PASS)
- Half A alone: best answer **Nausicaa of the Valley of the Wind**; referee **rejected**; alternatives: Spirited Away, Grave of the Fireflies.
- Half B alone: best answer **1/2 B: A young girl must find work in a strange town where spirits gather**; referee **rejected**; alternatives: 1/2 B: A young girl must find work in a strange town where spirits gather, Half of B: A young girl must find work in a strange town where spirits gather.
- Both halves: best answer **Spirited Away**; referee **accepted**; alternatives: Spirited Away, The Cave.

### pack-59: Toy Story (PASS)
- Half A alone: best answer **Cars**; referee **rejected**; alternatives: Toy Story, Finding Nemo.
- Half B alone: best answer **wind-up toy**; referee **rejected**; alternatives: teddy bear, doll.
- Both halves: best answer **Toy Story**; referee **accepted**; alternatives: Toy Story 3, Toy Story 2.

### gen-001: Mysore Palace (PASS)
- Half A alone: best answer **Ambazhika Palace**; referee **rejected**; alternatives: Padmanabhapuram Palace, Thiruvananthapuram Palace.
- Half B alone: best answer **Qutub Minar**; referee **rejected**; alternatives: India Gate, Victory Arch.
- Both halves: best answer **Mysore Palace**; referee **accepted**; alternatives: Agra Fort, Mehtab Bagh.

### gen-004: Pav Bhaji (PASS)
- Half A alone: best answer **Mashed Potatoes**; referee **rejected**; alternatives: Coleslaw, Collard Greens.
- Half B alone: best answer **Popcorn**; referee **rejected**; alternatives: Pepsi, Nacho Chees.
- Both halves: best answer **Pav Bhaji**; referee **accepted**; alternatives: Kachori, Pakora.

### gen-016: Mahatma Gandhi (PASS)
- Half A alone: best answer **Nelson Mandela**; referee **rejected**; alternatives: Martin Luther King Jr., Mahatma Gandhi.
- Half B alone: best answer **Jawaharlal Nehru**; referee **rejected**; alternatives: M.S. Ramachandran, Indira Gandhi.
- Both halves: best answer **Mahatma Gandhi**; referee **accepted**; alternatives: Mahatma Gandhi, Kasturba Gandhi.

### gen-035: Sikkim (PASS)
- Half A alone: best answer **Arunachal Pradesh**; referee **rejected**; alternatives: Sikkim, Nagaland.
- Half B alone: best answer **Arunachal Pradesh**; referee **rejected**; alternatives: Nagaland, Mizoram.
- Both halves: best answer **Sikkim**; referee **accepted**; alternatives: Assam, Tripura.

### gen-036: Lagaan (PASS)
- Half A alone: best answer **Isaac Newton**; referee **rejected**; alternatives: A 2001 Bollywood epic where villagers challenge colonial rulers to a football match, An Indian film from 2001 about a cricket match against the British.
- Half B alone: best answer **Drive My Car**; referee **rejected**; alternatives: Parasite, Past Lives.
- Both halves: best answer **Lagaan**; referee **accepted**; alternatives: Lagaan, Black Sheep White Lamb.

### gen-283: Beethoven's 5th Symphony (PASS)
- Half A alone: best answer **Four Notes**; referee **rejected**; alternatives: Beethoven's Fifth Symphony, Marshall Plan.
- Half B alone: best answer **Symphony No. 9 in D minor, Op. 125 ('Choral')**; referee **rejected**; alternatives: Overtures to 'Die Zauberflöte', Variations on 'Là ci darem' from Le nozze di Figaro.
- Both halves: best answer **Beethoven's 5th Symphony**; referee **accepted**; alternatives: Beethoven's 5th Symphony, Beethoven's 6th Symphony.

### gen-020: Hubble Space Telescope (PASS)
- Half A alone: best answer **Spitzer Space Telescope**; referee **rejected**; alternatives: Hubble Space Telescope, Kepler Space Telescope.
- Half B alone: best answer **Hubble**; referee **rejected**; alternatives: JWST, Kepler.
- Both halves: best answer **Hubble Space Telescope**; referee **accepted**; alternatives: Kepler Space Telescope, Chandra X-ray Observatory.

### gen-027: Lake Baikal (PASS)
- Half A alone: best answer **Lake Tanganyika**; referee **rejected**; alternatives: Great Bear Lake, Lake Baikal.
- Half B alone: best answer **Yenisei**; referee **rejected**; alternatives: Lena, Ob.
- Both halves: best answer **Lake Baikal**; referee **accepted**; alternatives: Lake Baikal, Lake Ladoga.

### gen-379: Mount Kilimanjaro (PASS)
- Half A alone: best answer **Denali**; referee **rejected**; alternatives: Kangchenjunga, Lhotse.
- Half B alone: best answer **Lake Victoria**; referee **rejected**; alternatives: Mount Kilimanjaro, Lake Tanganyika.
- Both halves: best answer **Mount Kilimanjaro**; referee **accepted**; alternatives: Mount Kilimanjaro, Mount Meru.

### gen-395: Sholay (PASS)
- Half A alone: best answer **Carry On... Pollock**; referee **rejected**; alternatives: Itna Bhi To Nahi, Sholay (1975).
- Half B alone: best answer **Purab Aur Bharat**; referee **rejected**; alternatives: Aaj Ka Gudgudiya, Jaliyan Ka Jadam.
- Both halves: best answer **Sholay**; referee **accepted**; alternatives: Sholay, Bobby.

### gen-042: Sachin Tendulkar (PASS)
- Half A alone: best answer **Kapil Dev**; referee **rejected**; alternatives: Kapil Dev, Javagal Srinath.
- Half B alone: best answer **Brendon McCullum**; referee **rejected**; alternatives: Shahid Afridi, AB de Villiers.
- Both halves: best answer **Sachin Tendulkar**; referee **accepted**; alternatives: Sachin Tendulkar, Sachin Ramesh Tendulkar.

### gen-251: Miso soup (PASS)
- Half A alone: best answer **Miso**; referee **rejected**; alternatives: Miso soup, Marmite (dissolved in water/tea).
- Half B alone: best answer **An appetizer**; referee **rejected**; alternatives: An entryway to a restaurant experience, A test of the chef's skill.
- Both halves: best answer **Miso soup**; referee **accepted**; alternatives: Miso soup, Tanghulu.

### gen-402: Sundarbans (PASS)
- Half A alone: best answer **Mekong delta forest**; referee **rejected**; alternatives: Araucaria forest, Tropical cloud forest.
- Half B alone: best answer **Odisha**; referee **rejected**; alternatives: Rajasthan, Assam.
- Both halves: best answer **Sundarbans**; referee **accepted**; alternatives: Chao Phraya Delta, Mekong Delta.

### gen-174: Queen (PASS)
- Half A alone: best answer **Kate Bush**; referee **rejected**; alternatives: Genesis, Roxy Music.
- Half B alone: best answer **Crown**; referee **rejected**; alternatives: Crown, Sovereign.
- Both halves: best answer **Queen**; referee **accepted**; alternatives: Monarch, Sovereign.

### gen-225: Cricket World Cup (PASS)
- Half A alone: best answer **The Ashes**; referee **rejected**; alternatives: The Test Championship, The National Cricket Championship.
- Half B alone: best answer **FIFA World Cup**; referee **rejected**; alternatives: Rugby World Cup, Womens T20 Cricket World Cup.
- Both halves: best answer **Cricket World Cup**; referee **accepted**; alternatives: Hockey World Cup, Rugby World Cup.

### gen-109: A.R. Rahman (PASS)
- Half A alone: best answer **John Williams**; referee **rejected**; alternatives: John Williams, Alan Menken.
- Half B alone: best answer **Shankar Mahadevan**; referee **rejected**; alternatives: Rajan & Sangeet, Panjiri.
- Both halves: best answer **A. R. Rahman**; referee **accepted**; alternatives: Ravi Shankar, A. R. Rahman.

### gen-407: Virat Kohli (PASS)
- Half A alone: best answer **Sachin Tendulkar**; referee **rejected**; alternatives: Gautam Gambhir, Michael Clarke.
- Half B alone: best answer **Shakib Al Hasan**; referee **rejected**; alternatives: MS Dhoni, Sachin Tendulkar.
- Both halves: best answer **Virat Kohli**; referee **accepted**; alternatives: Sachin Tendulkar, MS Dhoni.

### gen-080: The Shawshank Redemption (PASS)
- Half A alone: best answer **A Hologram for the King**; referee **rejected**; alternatives: Cellular, Birdman.
- Half B alone: best answer **Unleashed**; referee **rejected**; alternatives: The Reckoning, Freedom.
- Both halves: best answer **The Shawshank Redemption**; referee **accepted**; alternatives: The Shawshank Redelivery, Escape from Alcatraz.

### gen-133: Jai Ho (PASS)
- Half A alone: best answer **Foxy Lady**; referee **rejected**; alternatives: Hallelujah, A Thousand Years.
- Half B alone: best answer **Chaiyya Chaiyya**; referee **rejected**; alternatives: Jai Ho, Kuch Toy.
- Both halves: best answer **Jai Ho**; referee **accepted**; alternatives: Jai Ho, Kun Faya Kun.

### gen-100: Mango Lassi (PASS)
- Half A alone: best answer **piña colada**; referee **rejected**; alternatives: mango lassi, orange creamsicle.
- Half B alone: best answer **Masala Chai**; referee **rejected**; alternatives: Lassi, Chai.
- Both halves: best answer **Mango Lassi**; referee **accepted**; alternatives: Mango Lassi, Lassi.

### gen-104: Dangal (PASS)
- Half A alone: best answer **The Fighter**; referee **rejected**; alternatives: Kickboxing: Fighting for Survival, Warrior: A Story of Two Sisters.
- Half B alone: best answer **Mard Kohli**; referee **rejected**; alternatives: Pikachu and the Big Boss, Bharat Ek Khoobsoorat Desh.
- Both halves: best answer **Dangal**; referee **accepted**; alternatives: The Hundred-Foot Journey, Margarita with a Straw.

### gen-421: Mumbai (PASS)
- Half A alone: best answer **Bollywood**; referee **rejected**; alternatives: Mumbai, Colombo.
- Half B alone: best answer **London**; referee **rejected**; alternatives: Tokyo, New York.
- Both halves: best answer **Mumbai**; referee **accepted**; alternatives: Bombay, Mumbai.

### gen-380: Raga Bhairavi (PASS)
- Half A alone: best answer **Raga Yaman**; referee **rejected**; alternatives: Raga Bhairavi, Raga Malhar.
- Half B alone: best answer **Symphony**; referee **rejected**; alternatives: Symphonic Poem, Fantasy.
- Both halves: best answer **Raga Bhairav**; referee **accepted**; alternatives: Raga Yaman, Raga Kedar.

### gen-142: Biryani (PASS)
- Half A alone: best answer **pilaf**; referee **rejected**; alternatives: biryani, kabsa.
- Half B alone: best answer **Punjab**; referee **rejected**; alternatives: India, Himachal Pradesh.
- Both halves: best answer **Biryani**; referee **accepted**; alternatives: Chole Bhature, Butter Chicken.

### gen-101: Mount Fuji (PASS)
- Half A alone: best answer **mountain**; referee **rejected**; alternatives: pyramid, skull.
- Half B alone: best answer **Cherry Blossom**; referee **rejected**; alternatives: Rising Sun, Fuji.
- Both halves: best answer **Mount Fuji**; referee **accepted**; alternatives: The Great Bell ofTokyo, The Golden Pavilion.

### gen-160: Taj Mahal (PASS)
- Half A alone: best answer **Tomb of Edward IV**; referee **rejected**; alternatives: Henry VII's Chapel, Tomb of Edward IV.
- Half B alone: best answer **Mehtab Bagh**; referee **rejected**; alternatives: Raj Bagh, Sadar Bazar.
- Both halves: best answer **Taj Mahal**; referee **accepted**; alternatives: Tomb of I'timad-ud-Daulah, Tomb of Safdarjung.

### gen-284: Paneer Tikka (PASS)
- Half A alone: best answer **Grilled halloumi**; referee **rejected**; alternatives: Cheese chunks, Paneer.
- Half B alone: best answer **Pani Puri**; referee **rejected**; alternatives: Kebabs, Chaat.
- Both halves: best answer **Paneer Tikka**; referee **accepted**; alternatives: Paneer Tikka, Malai Kebab.

### gen-335: Paneer (PASS)
- Half A alone: best answer **Quark**; referee **rejected**; alternatives: Ricotta, Curdled Milk.
- Half B alone: best answer **Ghee**; referee **rejected**; alternatives: Margarine, Palm oil.
- Both halves: best answer **Paneer**; referee **accepted**; alternatives: Hung Curd, Lassi Whey.
