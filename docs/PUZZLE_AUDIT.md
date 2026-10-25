# Twinclue Puzzle Pack Blind Audit

- Run: 2026-10-25T17:08:06.386Z
- Model: qwen/qwen3.8-27b
- Result: 20/60 passed (33.3%)

Each clue half and each paired clue were sent in separate requests. The blind solver was not shown the stored answer. Results are judged with Twinclue’s exact referee rules.

## Puzzle results

### pack-01: Compass (FAIL)
- Half A alone: best answer **compass**; referee **accepted**; alternatives: map, GPS device.
- Half B alone: best answer **Compass**; referee **accepted**; alternatives: Compass rose, Legend.
- Both halves: best answer **compass**; referee **accepted**; alternatives: compass, walking stick.
- Failure: Half A alone produced accepted answer "compass".
- Failure: Half B alone produced accepted answer "Compass".

### pack-02: Hourglass (PASS)
- Half A alone: best answer **timer**; referee **rejected**; alternatives: hourglass, ladybug timer.
- Half B alone: best answer **peanut**; referee **rejected**; alternatives: peanut shell cross-section, barbell outline.
- Both halves: best answer **hourglass**; referee **accepted**; alternatives: dart, bowling pin.

### pack-03: Lighthouse (PASS)
- Half A alone: best answer **Space Needle**; referee **rejected**; alternatives: Statue of Liberty, Pike Place Market.
- Half B alone: best answer **light**; referee **rejected**; alternatives: lighthouse beam, shoreline outline.
- Both halves: best answer **lighthouse**; referee **accepted**; alternatives: beacon, beacon tower.

### pack-04: Rainbow (FAIL)
- Half A alone: best answer **Eclipse**; referee **rejected**; alternatives: Sunset, Northern Lights.
- Half B alone: best answer **Rainbow**; referee **accepted**; alternatives: Fog bow, Lightning.
- Both halves: best answer **rainbow**; referee **accepted**; alternatives: rainbow, prism effect.
- Failure: Half B alone produced accepted answer "Rainbow".

### pack-05: Piano (PASS)
- Half A alone: best answer **violin**; referee **rejected**; alternatives: guitar, piano.
- Half B alone: best answer **Guitar**; referee **rejected**; alternatives: Piano, Organ.
- Both halves: best answer **Piano**; referee **accepted**; alternatives: Organ, Accordion.

### pack-06: Telescope (FAIL)
- Half A alone: best answer **magnifying glass**; referee **rejected**; alternatives: microscope, endoscope.
- Half B alone: best answer **monocular**; referee **rejected**; alternatives: magnifying glass, simple microscope.
- Both halves: best answer **magnifying glass**; referee **rejected**; alternatives: microscope, telescope.
- Failure: Both halves produced "magnifying glass", which referee marked rejected for "Telescope".

### pack-07: Tetris (FAIL)
- Half A alone: best answer **Tetris**; referee **accepted**; alternatives: Paddle Ball, Worms.
- Half B alone: best answer **Tetris**; referee **accepted**; alternatives: Puyo Puyo, Columns.
- Both halves: best answer **Tetris**; referee **accepted**; alternatives: Tetris, Tetra Master.
- Failure: Half A alone produced accepted answer "Tetris".
- Failure: Half B alone produced accepted answer "Tetris".

### pack-08: Minecraft (FAIL)
- Half A alone: best answer **Minecraft**; referee **accepted**; alternatives: Minecraft (Creative Mode), Terraria.
- Half B alone: best answer **Minecraft**; referee **accepted**; alternatives: Roblox Studio, Little Alchemy 2.
- Both halves: best answer **Minecraft**; referee **accepted**; alternatives: Terraria, Roblox.
- Failure: Half A alone produced accepted answer "Minecraft".
- Failure: Half B alone produced accepted answer "Minecraft".

### pack-09: Pac-Man (FAIL)
- Half A alone: best answer **King Dedede**; referee **rejected**; alternatives: Mario, Kratos.
- Half B alone: best answer **Maze Craze**; referee **rejected**; alternatives: Pac-Man, Lode Runner.
- Both halves: best answer **Sonny Slugs**; referee **rejected**; alternatives: Sonny Slugs II, Bomberman JSR.
- Failure: Both halves produced "Sonny Slugs", which referee marked rejected for "Pac-Man".

### pack-10: Zelda (PASS)
- Half A alone: best answer **Final Fantasy**; referee **rejected**; alternatives: Dragon Quest, Ys.
- Half B alone: best answer **Detective**; referee **rejected**; alternatives: Spy, Bounty Hunter.
- Both halves: best answer **The Legend of Zelda**; referee **accepted**; alternatives: Final Fantasy, Dragon Quest.

### pack-11: Sonic the Hedgehog (FAIL)
- Half A alone: best answer **Sonic the Hedgehog**; referee **accepted**; alternatives: Sonic the Hedgehog, Crazy Taxi.
- Half B alone: best answer **Sonic the Hedgehog**; referee **accepted**; alternatives: Sonic the Hedgehog, Crash Bandicoot.
- Both halves: best answer **Sonic the Hedgehog**; referee **accepted**; alternatives: Crash Bandicoot, Sonic the Hedgehog.
- Failure: Half A alone produced accepted answer "Sonic the Hedgehog".
- Failure: Half B alone produced accepted answer "Sonic the Hedgehog".

### pack-12: Among Us (PASS)
- Half A alone: best answer **Words with Friends**; referee **rejected**; alternatives: Tag, Doodle Jump.
- Half B alone: best answer **The Resistance**; referee **rejected**; alternatives: Mafia, Undercover.
- Both halves: best answer **Among Us**; referee **accepted**; alternatives: Social Deduction, Mafia.

### pack-13: Super Mario Bros. (FAIL)
- Half A alone: best answer **Super Mario**; referee **accepted**; alternatives: Mario Kart, Zelda.
- Half B alone: best answer **Super Mario World**; referee **accepted**; alternatives: Super Mario Bros. 3, Super Mario 64.
- Both halves: best answer **Mario**; referee **accepted**; alternatives: Mario, Super Mario Bros..
- Failure: Half A alone produced accepted answer "Super Mario".
- Failure: Half B alone produced accepted answer "Super Mario World".

### pack-14: The Beatles (PASS)
- Half A alone: best answer **Queen**; referee **rejected**; alternatives: The Beatles, Elton John.
- Half B alone: best answer **Waterloo (band)**; referee **rejected**; alternatives: Retrovisor, Hall & Oates.
- Both halves: best answer **The Beatles**; referee **accepted**; alternatives: ABBA, Dolly Parton and Porter Wagoner.

### pack-15: Taylor Swift (PASS)
- Half A alone: best answer **Robin Thicke**; referee **rejected**; alternatives: Céline Dion, James Blunt.
- Half B alone: best answer **Lorde**; referee **rejected**; alternatives: Billie Eilish, Taylor Swift.
- Both halves: best answer **Taylor Swift**; referee **accepted**; alternatives: Taylor Swift, Adele.

### pack-16: Bohemian Rhapsody (FAIL)
- Half A alone: best answer **Brilliant Disguise**; referee **rejected**; alternatives: Stay with Me, The Passenger.
- Half B alone: best answer **Eclectic**; referee **rejected**; alternatives: Medley, Mashup.
- Both halves: best answer **Superstition**; referee **rejected**; alternatives: Stairway to Heaven, Nervous Breakdown.
- Failure: Both halves produced "Superstition", which referee marked rejected for "Bohemian Rhapsody".

### pack-17: Violin (FAIL)
- Half A alone: best answer **Half-violin**; referee **accepted**; alternatives: Muted guitar, Whispered flute.
- Half B alone: best answer **play a musical instrument**; referee **rejected**; alternatives: play a string instrument, bounce a ball.
- Both halves: best answer **violin**; referee **accepted**; alternatives: violin, viola.
- Failure: Half A alone produced accepted answer "Half-violin".

### pack-18: Reggae (FAIL)
- Half A alone: best answer **Soca**; referee **rejected**; alternatives: Calypso, Reggae.
- Half B alone: best answer **Chillout**; referee **rejected**; alternatives: Reggae, Skank.
- Both halves: best answer **calypso**; referee **rejected**; alternatives: reggae, ska.
- Failure: Both halves produced "calypso", which referee marked rejected for "Reggae".

### pack-19: Moonlight Sonata (FAIL)
- Half A alone: best answer **Clair de Lune**; referee **rejected**; alternatives: Moonlight Sonata, Für Elise.
- Half B alone: best answer **Chopin's Piano Concerto No. 1**; referee **rejected**; alternatives: Holst's The Planets, Grieg's Piano Concerto in A minor.
- Both halves: best answer **Piano Sonata No. 23 in F minor, Op. 57**; referee **rejected**; alternatives: Sonata in C Major K. 545, Piano Sonata No. 8 in C minor, Op. 13.
- Failure: Both halves produced "Piano Sonata No. 23 in F minor, Op. 57", which referee marked rejected for "Moonlight Sonata".

### pack-20: Michael Jackson (FAIL)
- Half A alone: best answer **Janelle Monáe**; referee **rejected**; alternatives: Miley Cyrus, Beyoncé.
- Half B alone: best answer **Justin Timberlake**; referee **rejected**; alternatives: Michael Bublé, Bon Jovi.
- Both halves: best answer **Nick Cannon**; referee **rejected**; alternatives: Justin Timberlake, Bobby Brown.
- Failure: Both halves produced "Nick Cannon", which referee marked rejected for "Michael Jackson".

### pack-21: Jai Ho (FAIL)
- Half A alone: best answer **Munna Bhai MBBS**; referee **rejected**; alternatives: Chaiyya Chaiyya, Tujhe Dekha Toh.
- Half B alone: best answer **Win**; referee **rejected**; alternatives: Jay Virender, Jai Bhim.
- Both halves: best answer **Jai**; referee **unclear**; alternatives: Zindagi, Chai.
- Failure: Both halves produced "Jai", which referee marked unclear for "Jai Ho".

### pack-22: Jupiter (FAIL)
- Half A alone: best answer **Jupiter**; referee **accepted**; alternatives: Jupiter, Neptune.
- Half B alone: best answer **Jupiter**; referee **accepted**; alternatives: Jupiter, the third planet from the Sun.
- Both halves: best answer **Jupiter**; referee **accepted**; alternatives: Gas giant planet, Fourth planet from the Sun.
- Failure: Half A alone produced accepted answer "Jupiter".
- Failure: Half B alone produced accepted answer "Jupiter".

### pack-23: Photosynthesis (PASS)
- Half A alone: best answer **Phototropism**; referee **rejected**; alternatives: Stomatal closure, Root hair development.
- Half B alone: best answer **sunlight**; referee **rejected**; alternatives: solar radiation, photosynthesis.
- Both halves: best answer **Photosynthesis**; referee **accepted**; alternatives: Photosynthesis in algae, Chemolithotrophy by plants.

### pack-24: DNA (PASS)
- Half A alone: best answer **nucleus**; referee **rejected**; alternatives: cytoplasm, organelles.
- Half B alone: best answer **gene**; referee **unclear**; alternatives: DNA, genome.
- Both halves: best answer **DNA**; referee **accepted**; alternatives: genetic material, hereditary material.

### pack-25: Saturn (FAIL)
- Half A alone: best answer **Jupiter**; referee **rejected**; alternatives: >>A gas giant known for its Great Red Spot, The largest planet in the solar system.
- Half B alone: best answer **Neptune**; referee **rejected**; alternatives: Pluto, Haumea.
- Both halves: best answer **Oort Cloud**; referee **rejected**; alternatives: KBOs, Sedna.
- Failure: Both halves produced "Oort Cloud", which referee marked rejected for "Saturn".

### pack-26: Coffee (PASS)
- Half A alone: best answer **Espresso**; referee **rejected**; alternatives: Coffee, Tea.
- Half B alone: best answer **Espresso**; referee **rejected**; alternatives: Coffee, Teff flour.
- Both halves: best answer **coffee**; referee **accepted**; alternatives: chicory coffee, dandelion root coffee.

### pack-27: Edison (FAIL)
- Half A alone: best answer **Thomas Edison**; referee **accepted**; alternatives: Nikola Tesla, Benjamin Franklin.
- Half B alone: best answer **Ampere**; referee **rejected**; alternatives: Mare, Lord.
- Both halves: best answer **Ampere**; referee **rejected**; alternatives: Volt, Ohm.
- Failure: Half A alone produced accepted answer "Thomas Edison".
- Failure: Both halves produced "Ampere", which referee marked rejected for "Edison".

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

### pack-31: Olympic rings (FAIL)
- Half A alone: best answer **Olympic Rings**; referee **accepted**; alternatives: Ring, Crystal Ball.
- Half B alone: best answer **Olympic rings**; referee **accepted**; alternatives: Olympic flag, Reed-and-Kelley Award.
- Both halves: best answer **Olympic**; referee **rejected**; alternatives: Olympic ring, Olympic emblem.
- Failure: Half A alone produced accepted answer "Olympic Rings".
- Failure: Half B alone produced accepted answer "Olympic rings".
- Failure: Both halves produced "Olympic", which referee marked rejected for "Olympic rings".

### pack-32: Serena Williams (FAIL)
- Half A alone: best answer **Nadal**; referee **rejected**; alternatives: Shapovalov, Krishnan.
- Half B alone: best answer **Serena Williams**; referee **accepted**; alternatives: Victoria Azarenka, Kim Clijsters.
- Both halves: best answer **Serena Williams**; referee **accepted**; alternatives: Kim Clijsters, Angelique Kerber.
- Failure: Half B alone produced accepted answer "Serena Williams".

### pack-33: Tour de France (PASS)
- Half A alone: best answer **the London Marathon**; referee **rejected**; alternatives: the Tour de France, the World Cup.
- Half B alone: best answer **yellow jersey**; referee **rejected**; alternatives: green jersey, polka dot jersey.
- Both halves: best answer **Tour de France**; referee **accepted**; alternatives: Vuelta a España, Giro d'Italia.

### pack-34: Cricket (FAIL)
- Half A alone: best answer **Cricket**; referee **accepted**; alternatives: Baseball, Cricket.
- Half B alone: best answer **cricket**; referee **accepted**; alternatives: cricket, bowling alley.
- Both halves: best answer **cricket**; referee **accepted**; alternatives: baseball, cricket.
- Failure: Half A alone produced accepted answer "Cricket".
- Failure: Half B alone produced accepted answer "cricket".

### pack-35: Sachin Tendulkar (FAIL)
- Half A alone: best answer **Sunil Gavaskar**; referee **rejected**; alternatives: Sunil Gavaskar, Rahul Dravid.
- Half B alone: best answer **Kapil Dev**; referee **rejected**; alternatives: Mohammad Azharuddin, Sourav Ganguly.
- Both halves: best answer **Sunil Gavaskar**; referee **rejected**; alternatives: V.V. Sardar, Cheteshwar Pujara.
- Failure: Both halves produced "Sunil Gavaskar", which referee marked rejected for "Sachin Tendulkar".

### pack-36: Sushi (FAIL)
- Half A alone: best answer **Gyoza**; referee **rejected**; alternatives: Onigiri, Sashimi.
- Half B alone: best answer **Sushi**; referee **accepted**; alternatives: Nigiri sushi, Maki sushi.
- Both halves: best answer **sushi**; referee **accepted**; alternatives: sushi roll, nigiri.
- Failure: Half B alone produced accepted answer "Sushi".

### pack-37: Margherita pizza (PASS)
- Half A alone: best answer **Spaghetti alle vongole**; referee **rejected**; alternatives: Sfogliatella, Rajo al sugo.
- Half B alone: best answer **Margherita**; referee **rejected**; alternatives: Pizza Margherita, Neapolitan pizza.
- Both halves: best answer **Pizza Margherita**; referee **accepted**; alternatives: San Marzano tomato and buffalo mozzarella pizza, classic marble rind pizza.

### pack-38: Guacamole (FAIL)
- Half A alone: best answer **Sour cream**; referee **rejected**; alternatives: Guacamole, Refried beans.
- Half B alone: best answer **guacamole**; referee **accepted**; alternatives: mashed avocados, guacamole base.
- Both halves: best answer **guacamole**; referee **accepted**; alternatives: salsa verde, guacamole recipe.
- Failure: Half B alone produced accepted answer "guacamole".

### pack-39: Croissant (FAIL)
- Half A alone: best answer **danish**; referee **rejected**; alternatives: croissant, danish.
- Half B alone: best answer **Puff pastry**; referee **rejected**; alternatives: Croissant, Pi.
- Both halves: best answer **danish**; referee **rejected**; alternatives: croissant, strudel.
- Failure: Both halves produced "danish", which referee marked rejected for "Croissant".

### pack-40: Chocolate (FAIL)
- Half A alone: best answer **chocolate**; referee **accepted**; alternatives: cocoa chocolate, dark chocolate.
- Half B alone: best answer **Sugar**; referee **rejected**; alternatives: Light, Coffee.
- Both halves: best answer **Chocolate**; referee **accepted**; alternatives: Choc, Dulce de chocolate.
- Failure: Half A alone produced accepted answer "chocolate".

### pack-41: Hummus (FAIL)
- Half A alone: best answer **Baba ganoush**; referee **rejected**; alternatives: Hummus, Tzatziki.
- Half B alone: best answer **hummus**; referee **accepted**; alternatives: Hummus, Middle Eastern dip.
- Both halves: best answer **hummus**; referee **accepted**; alternatives: chickpea dip, chickpea paste.
- Failure: Half B alone produced accepted answer "hummus".

### pack-42: Masala dosa (PASS)
- Half A alone: best answer **idli**; referee **rejected**; alternatives: idli-sambar set, uttapam.
- Half B alone: best answer **Idli with Sambar**; referee **rejected**; alternatives: Medu Vada with Sambar, Paniyaram with Chutney.
- Both halves: best answer **Masala dosa**; referee **accepted**; alternatives: Mysore masala dosa, Idiyappam.

### pack-43: Biryani (FAIL)
- Half A alone: best answer **Biryani**; referee **accepted**; alternatives: Yellow rice, Curry rice.
- Half B alone: best answer **Pilaf**; referee **rejected**; alternatives: Biryani, Poelaos.
- Both halves: best answer **Biryani**; referee **accepted**; alternatives: Hyderabadi Biryani, Hyderabadi Dum Biryani.
- Failure: Half A alone produced accepted answer "Biryani".

### pack-44: Gulab jamun (FAIL)
- Half A alone: best answer **Barfi**; referee **rejected**; alternatives: Gulab Jamun, Kheer.
- Half B alone: best answer **Gulab Jamun**; referee **accepted**; alternatives: Gulab Jamun, Barfi.
- Both halves: best answer **Gulab Jamun**; referee **accepted**; alternatives: Gulab Jamun, Aada Kheer.
- Failure: Half B alone produced accepted answer "Gulab Jamun".

### pack-45: Pani puri (PASS)
- Half A alone: best answer **Pakora**; referee **rejected**; alternatives: Puri Bhaji, Bombil Fritters.
- Half B alone: best answer **Lemon water**; referee **rejected**; alternatives: Lemon-infused broth, Ginger hot water.
- Both halves: best answer ** Pani Puri**; referee **accepted**; alternatives: Paani Puri, Golgappa.

### pack-46: Paris (FAIL)
- Half A alone: best answer **Paris**; referee **accepted**; alternatives: Paris, Budapest.
- Half B alone: best answer **Normandy**; referee **rejected**; alternatives: Rouen, Le Havre.
- Both halves: best answer **Paris, France**; referee **accepted**; alternatives: Paris, France, Marseille, France.
- Failure: Half A alone produced accepted answer "Paris".

### pack-47: Mount Everest (FAIL)
- Half A alone: best answer **Everest**; referee **accepted**; alternatives: Everest, Annapurna.
- Half B alone: best answer **Summit**; referee **rejected**; alternatives: Mount Everest, Elevated position.
- Both halves: best answer **Everest**; referee **accepted**; alternatives: Mount Everest, Chomolungma.
- Failure: Half A alone produced accepted answer "Everest".

### pack-48: Sahara (FAIL)
- Half A alone: best answer **desert**; referee **rejected**; alternatives: badlands, wasteland.
- Half B alone: best answer **Sahara**; referee **accepted**; alternatives: Sahara Desert, Sahel.
- Both halves: best answer **The Sahara**; referee **accepted**; alternatives: The Sahara, The Kalahari.
- Failure: Half B alone produced accepted answer "Sahara".

### pack-49: Amazon River (FAIL)
- Half A alone: best answer **Amazon**; referee **accepted**; alternatives: Amazon, Orinoco.
- Half B alone: best answer **Amazon River**; referee **accepted**; alternatives: Yukon River, Rio Negro.
- Both halves: best answer **Amazon River**; referee **accepted**; alternatives: Orinoco River, Paraná River.
- Failure: Half A alone produced accepted answer "Amazon".
- Failure: Half B alone produced accepted answer "Amazon River".

### pack-50: Iceland (FAIL)
- Half A alone: best answer **Iceland**; referee **accepted**; alternatives: Iceland, Greenland.
- Half B alone: best answer **Iceland**; referee **accepted**; alternatives: Island nation in the North Atlantic, Country with geothermal energy dominance.
- Both halves: best answer **Iceland**; referee **accepted**; alternatives: Greenland, Faroe Islands.
- Failure: Half A alone produced accepted answer "Iceland".
- Failure: Half B alone produced accepted answer "Iceland".

### pack-51: Great Barrier Reef (FAIL)
- Half A alone: best answer **Great Barrier Reef**; referee **accepted**; alternatives: Great Barrier Reef, Reef.
- Half B alone: best answer **Great Barrier Reef**; referee **accepted**; alternatives: Great Barrier Reef, Coral Sea.
- Both halves: best answer **Great Barrier Reef**; referee **accepted**; alternatives: Coral Sea, Great Barrier Reef in Queensland.
- Failure: Half A alone produced accepted answer "Great Barrier Reef".
- Failure: Half B alone produced accepted answer "Great Barrier Reef".

### pack-52: Taj Mahal (FAIL)
- Half A alone: best answer **Taj Mahal**; referee **accepted**; alternatives: Panch Mahal, Itmad-ud-Daulah's Tomb.
- Half B alone: best answer **Taj Mahal**; referee **accepted**; alternatives: Taj Mahal, Taj Mahal complex.
- Both halves: best answer **Taj Mahal**; referee **accepted**; alternatives: Shah Jahan's tomb, Noor Mahal.
- Failure: Half A alone produced accepted answer "Taj Mahal".
- Failure: Half B alone produced accepted answer "Taj Mahal".

### pack-53: Mumbai (FAIL)
- Half A alone: best answer **Mumbai**; referee **accepted**; alternatives: Chennai, Kolkata.
- Half B alone: best answer **Bharat**; referee **rejected**; alternatives: Mumbai, Bharat.
- Both halves: best answer **Mumbai**; referee **accepted**; alternatives: Mumbai suburbs, Bombay Harbour.
- Failure: Half A alone produced accepted answer "Mumbai".

### pack-54: The Wizard of Oz (PASS)
- Half A alone: best answer **Wicked**; referee **rejected**; alternatives: The Wiz, Mary Poppins.
- Half B alone: best answer **The Wonderful Wizard of Oz**; referee **rejected**; alternatives: The Wiz, Emerald City.
- Both halves: best answer **The Wizard of Oz**; referee **accepted**; alternatives: Music of the Tundra, Waltz in the Green.

### pack-55: Jaws (PASS)
- Half A alone: best answer **Close Encounters of the Third Kind**; referee **rejected**; alternatives: Jaws, Empire of the Sun.
- Half B alone: best answer **Hothouse**; referee **rejected**; alternatives: Flesh and Bone, Great White.
- Both halves: best answer **Jaws**; referee **accepted**; alternatives: Jaws 2, Jaws III.

### pack-56: Spirited Away (FAIL)
- Half A alone: best answer **My Neighbor Totoro**; referee **rejected**; alternatives: Spirited Away, Howl's Moving Castle.
- Half B alone: best answer **spirited away**; referee **accepted**; alternatives: the mabinogi, spirited away.
- Both halves: best answer **Spirited Away**; referee **accepted**; alternatives: Spirited Away, The Secret World of Arrietty.
- Failure: Half B alone produced accepted answer "spirited away".

### pack-57: The Matrix (FAIL)
- Half A alone: best answer **John Wick**; referee **rejected**; alternatives: The Matrix, Cloud Atlas.
- Half B alone: best answer **The Matrix**; referee **accepted**; alternatives: The Matrix, Inception.
- Both halves: best answer **The Matrix**; referee **accepted**; alternatives: The Matrix (series), Morpheus's offer.
- Failure: Half B alone produced accepted answer "The Matrix".

### pack-58: Titanic (FAIL)
- Half A alone: best answer **Titanic**; referee **accepted**; alternatives: The Aviator, Catch Me If You Can.
- Half B alone: best answer **Titanic**; referee **accepted**; alternatives: Titanic, Ghost Ship.
- Both halves: best answer **Titanic**; referee **accepted**; alternatives: Shipwrecked, Sunk in Love.
- Failure: Half A alone produced accepted answer "Titanic".
- Failure: Half B alone produced accepted answer "Titanic".

### pack-59: Toy Story (PASS)
- Half A alone: best answer **Cars**; referee **rejected**; alternatives: Toy Story, Finding Nemo.
- Half B alone: best answer **wind-up toy**; referee **rejected**; alternatives: teddy bear, doll.
- Both halves: best answer **Toy Story**; referee **accepted**; alternatives: Toy Story 3, Toy Story 2.

### pack-60: Sholay (FAIL)
- Half A alone: best answer **Sholay**; referee **accepted**; alternatives: Sholay, Baahubali.
- Half B alone: best answer **Sholay**; referee **accepted**; alternatives: The Evil Empire, Kacker Singh.
- Both halves: best answer **Sholay**; referee **accepted**; alternatives: Sholay Extended Cut, Sholay Cinematic Experience.
- Failure: Half A alone produced accepted answer "Sholay".
- Failure: Half B alone produced accepted answer "Sholay".
