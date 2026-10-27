// Historical bootstrap for the first fact tables. The JSON files in facts/ are now curated by hand and are the
// source of truth, so this script only writes a table that does not exist yet and never overwrites curated data.
import {access,mkdir,writeFile} from 'node:fs/promises';
const header=(category,entities)=>({_meta:{category,sources:['Curated from publicly documented general-reference facts; see facts/README.md'],license:'CC0 1.0 for this curated compilation'},entities});
const rows=`Afghanistan|Asia|1|left
Albania|Europe|0|right
Algeria|Africa|0|right
Andorra|Europe|1|right
Angola|Africa|0|right
Argentina|South America|0|right
Armenia|Asia|1|right
Australia|Oceania|0|left
Austria|Europe|1|right
Azerbaijan|Asia|0|right
Bangladesh|Asia|0|left
Belarus|Europe|1|right
Belgium|Europe|0|right
Bhutan|Asia|1|left
Bolivia|South America|1|right
Botswana|Africa|1|left
Brazil|South America|0|right
Bulgaria|Europe|0|right
Cambodia|Asia|0|right
Cameroon|Africa|0|right
Canada|North America|0|right
Chile|South America|0|right
China|Asia|0|right
Colombia|South America|0|right
Costa Rica|North America|0|right
Croatia|Europe|0|right
Cuba|North America|0|right
Czechia|Europe|1|right
Denmark|Europe|0|right
Ecuador|South America|0|right
Egypt|Africa|0|right
Ethiopia|Africa|1|right
Fiji|Oceania|0|left
Finland|Europe|0|right
France|Europe|0|right
Georgia|Asia|0|right
Germany|Europe|0|right
Ghana|Africa|0|right
Greece|Europe|0|right
Hungary|Europe|1|right
Iceland|Europe|0|right
India|Asia|0|left
Indonesia|Asia|0|left
Iran|Asia|0|right
Iraq|Asia|0|right
Ireland|Europe|0|left
Israel|Asia|0|right
Italy|Europe|0|right
Jamaica|North America|0|left
Japan|Asia|0|left
Jordan|Asia|0|right
Kazakhstan|Asia|1|right
Kenya|Africa|0|left
Laos|Asia|1|right
Lebanon|Asia|0|right
Malaysia|Asia|0|left
Maldives|Asia|0|left
Mexico|North America|0|right
Mongolia|Asia|1|right
Morocco|Africa|0|right
Myanmar|Asia|0|right
Nepal|Asia|1|left
Netherlands|Europe|0|right
New Zealand|Oceania|0|left
Nigeria|Africa|0|right
North Korea|Asia|0|right
Norway|Europe|0|right
Pakistan|Asia|0|left
Panama|North America|0|right
Peru|South America|0|right
Philippines|Asia|0|right
Poland|Europe|0|right
Portugal|Europe|0|right
Romania|Europe|0|right
Russia|Europe|0|right
Saudi Arabia|Asia|0|right
Serbia|Europe|1|right
Singapore|Asia|0|left
South Africa|Africa|0|left
South Korea|Asia|0|right
Spain|Europe|0|right
Sri Lanka|Asia|0|left
Sweden|Europe|0|right
Switzerland|Europe|1|right
Thailand|Asia|0|left
Türkiye|Asia|0|right
Ukraine|Europe|0|right
United Arab Emirates|Asia|0|right
United Kingdom|Europe|0|left
United States|North America|0|right
Vietnam|Asia|0|right`.split('\n').map(x=>x.split('|'));
const landlockedAccurate=new Set('Afghanistan Andorra Armenia Austria Azerbaijan Belarus Bhutan Bolivia Botswana Czechia Ethiopia Hungary Kazakhstan Laos Liechtenstein Luxembourg Mongolia Nepal Serbia Slovakia Switzerland'.split(' '));
const redWhite=new Set('Canada Denmark Austria Poland Indonesia Japan Peru Switzerland Monaco Georgia Tonga Latvia Singapore Tunisia Türkiye Bahrain Qatar Malta'.split(' '));
const blueWhiteRed=new Set('France Russia Netherlands Luxembourg United States United Kingdom Australia New Zealand Chile Cuba Slovakia Croatia Serbia Czechia Thailand Paraguay Iceland Norway'.split(' '));
const greenWhiteRed=new Set('Italy Hungary Bulgaria Iran Lebanon Madagascar Oman'.split(' '));
const flagCross=new Set('Denmark Finland Sweden Norway Iceland Switzerland Greece United Kingdom'.split(' '));
const flagStar=new Set('United States China Vietnam Ghana Türkiye Pakistan Malaysia Australia New Zealand Chile Cuba'.split(' '));
const countries=rows.map(([name,continent,_landlocked,driving])=>{const attributes={continent,landlocked:landlockedAccurate.has(name),drivingSide:driving,...(redWhite.has(name)?{flagColors:['red','white']} :blueWhiteRed.has(name)?{flagColors:['blue','white','red']}:greenWhiteRed.has(name)?{flagColors:['green','white','red']}:{}),...(flagCross.has(name)?{flagFeatures:['cross']}:flagStar.has(name)?{flagFeatures:['star']}: {})};return {name,aliases:name==='United States'?['USA','US']:name==='United Kingdom'?['UK','Britain']:[],fame:2,attributes};});
const groups={country:rows.map(r=>r[0]),character:'Mario Luigi Sonic Tails Kirby Pikachu Link Zelda Donkey Kong Samus Yoshi Bowser Peach Ganondorf Kratos Lara Croft Master Chief Pac-Man Mega Man Ryu Chun-Li Cloud Strife Sephiroth Nathan Drake Ellie Joel Aloy Geralt Solid Snake Crash Bandicoot Spyro Ratchet Clank Steve Alex Creeper D.Va Tracer Jinx Ezio Arthur Morgan Doom Slayer Kirby Wario Waluigi Fox McCloud Isabelle Villager Sora Jin Sakai Leon Kennedy Jill Valentine'.split(/ (?=[A-Z])/)};
// Additional curated tables use broad, multi-member attribute classes.
const charNames='Mario|Luigi|Sonic|Tails|Kirby|Pikachu|Link|Zelda|Donkey Kong|Samus|Yoshi|Bowser|Peach|Ganondorf|Kratos|Lara Croft|Master Chief|Pac-Man|Mega Man|Ryu|Chun-Li|Cloud Strife|Sephiroth|Nathan Drake|Ellie|Joel|Aloy|Geralt|Solid Snake|Crash Bandicoot|Spyro|Ratchet|Clank|Steve|Alex|Creeper|Tracer|Jinx|Ezio|Arthur Morgan|Doom Slayer|Wario|Waluigi|Fox McCloud|Isabelle|Villager|Sora|Jin Sakai|Leon Kennedy|Jill Valentine|Sackboy|Scorpion|Sub-Zero|Toad|Birdo|Tingle|Alexios|Toadette|Diddy Kong|Bowser Jr.|Inkling|Shulk|Ness|Olimar|Bayonetta|Kiryu|Yuna|Lara Croft|Chun-Li|Pac-Man|Charizard|Mewtwo|Niko Bellic|Porky Minch'.split('|').filter((x,i,a)=>a.indexOf(x)===i);
const publishers={Nintendo:new Set('Mario|Luigi|Kirby|Pikachu|Link|Zelda|Donkey Kong|Samus|Yoshi|Bowser|Peach|Ganondorf|Wario|Waluigi|Fox McCloud|Isabelle|Villager|Toad|Birdo|Tingle|Toadette|Diddy Kong|Bowser Jr.|Inkling|Shulk|Ness|Olimar'.split('|')),Sega:new Set(['Sonic','Tails']),Sony:new Set('Kratos|Nathan Drake|Ellie|Joel|Aloy|Ratchet|Clank|Sackboy'.split('|')),Capcom:new Set('Mega Man|Ryu|Chun-Li|Leon Kennedy|Jill Valentine'.split('|')),'Square Enix':new Set('Cloud Strife|Sephiroth|Sora|Yuna'.split('|')),Activision:new Set('Crash Bandicoot|Spyro'.split('|')),Ubisoft:new Set(['Ezio']),'CD Projekt':new Set(['Geralt']),Rockstar:new Set(['Arthur Morgan']),Microsoft:new Set(['Master Chief'])};
const humanChars=new Set('Mario|Luigi|Link|Zelda|Samus|Peach|Ganondorf|Kratos|Lara Croft|Master Chief|Ryu|Chun-Li|Cloud Strife|Sephiroth|Nathan Drake|Ellie|Joel|Aloy|Geralt|Solid Snake|Tracer|Jinx|Ezio|Arthur Morgan|Doom Slayer|Wario|Waluigi|Sora|Jin Sakai|Leon Kennedy|Jill Valentine|Scorpion|Sub-Zero|Alexios|Bayonetta|Kiryu|Yuna'.split('|'));
const animalChars=new Set('Sonic|Tails|Fox McCloud|Donkey Kong|Yoshi|Bowser|Pikachu|Fox McCloud|Crash Bandicoot|Spyro|Isabelle|Diddy Kong|Kirby'.split('|'));
const swordChars=new Set('Link|Ganondorf|Cloud Strife|Sephiroth|Geralt|Ezio|Sora|Jin Sakai|Alexios|Shulk'.split('|'));
const debutDecade={'Mario':'1980s','Donkey Kong':'1980s','Link':'1980s','Zelda':'1980s','Samus':'1980s','Bowser':'1980s','Peach':'1980s','Luigi':'1980s','Pac-Man':'1980s','Mega Man':'1980s','Ryu':'1980s','Solid Snake':'1980s','Sonic':'1990s','Tails':'1990s','Kirby':'1990s','Pikachu':'1990s','Yoshi':'1990s','Ganondorf':'1990s','Wario':'1990s','Chun-Li':'1990s','Cloud Strife':'1990s','Sephiroth':'1990s','Lara Croft':'1990s','Crash Bandicoot':'1990s','Spyro':'1990s','Fox McCloud':'1990s','Waluigi':'2000s','Kratos':'2000s','Master Chief':'2000s','Ratchet':'2000s','Clank':'2000s','Sora':'2000s','Ezio':'2000s','Arthur Morgan':'2010s','Aloy':'2010s','Tracer':'2010s','Jinx':'2010s','Jin Sakai':'2020s','Bayonetta':'2000s','Ness':'1980s','Olimar':'2000s','Shulk':'2010s','Diddy Kong':'1990s','Toad':'1980s','Birdo':'1980s','Tingle':'1990s','Alexios':'2010s','Toadette':'2000s','Bowser Jr.':'2000s','Inkling':'2010s','Charizard':'1990s','Mewtwo':'1990s','Niko Bellic':'2000s','Porky Minch':'1990s'};
const silent=new Set('Link|Samus|Steve|Alex|Creeper|Villager|Doom Slayer|Jin Sakai|Ness|Olimar'.split('|'));
const chars=charNames.map(name=>{const publisher=Object.entries(publishers).find(([,members])=>members.has(name))?.[0];const kind=humanChars.has(name)?'human':animalChars.has(name)?'animal':name==='Creeper'||name==='Kirby'||name==='Mewtwo'?'creature':undefined;const attributes={...(publisher?{publisher}:{}),...(debutDecade[name]?{debutDecade:debutDecade[name]}:{}),...(kind?{speciesOrType:kind}:{}),...(swordChars.has(name)?{wieldsSword:true}:{}),...(silent.has(name)?{silentProtagonist:true}:{})};return {name,aliases:name==='Pac-Man'?['Pacman']:[],fame:2,attributes};});
const animals='lion|tiger|elephant|giraffe|zebra|panda|koala|kangaroo|wolf|fox|bear|polar bear|camel|horse|cow|dog|cat|rabbit|hare|deer|moose|bison|goat|sheep|pig|chicken|duck|goose|swan|eagle|owl|parrot|penguin|ostrich|flamingo|crocodile|alligator|turtle|snake|frog|dolphin|whale|shark|octopus|seal|otter|beaver|bat|butterfly|bee|ant|spider|salmon|tuna|crab|lobster|peacock|armadillo|raccoon|capybara'.split('|');
const birds=new Set('chicken duck goose swan eagle owl parrot penguin ostrich flamingo peacock'.split(' '));const reptiles=new Set('crocodile alligator turtle snake'.split(' '));const fish=new Set('salmon tuna shark'.split(' '));const insects=new Set('butterfly bee ant spider'.split(' '));
const carnivores=new Set('lion tiger wolf fox polar|bear eagle owl crocodile alligator snake shark octopus'.split(/ (?=[A-Z])/));const herbivores=new Set('elephant giraffe zebra panda koala kangaroo camel horse cow rabbit hare deer moose bison goat sheep'.split(' '));const flyers=new Set('eagle owl parrot goose swan duck chicken ostrich flamingo peacock bat butterfly bee'.split(' '));const swimmers=new Set('elephant duck goose swan penguin crocodile alligator turtle frog dolphin whale shark octopus seal otter beaver salmon tuna crab lobster'.split(' '));
const animalEntities=animals.map(name=>{const animalClass=birds.has(name)?'bird':reptiles.has(name)?'reptile':fish.has(name)?'fish':insects.has(name)?'insect':name==='octopus'?'mollusc':name==='spider'?'arachnid':'mammal';const diet=carnivores.has(name)?'carnivore':herbivores.has(name)?'herbivore':'omnivore';return {name,aliases:[],fame:2,attributes:{animalClass,diet,canFly:flyers.has(name),swims:swimmers.has(name)}};});
const objects='Mercury|Venus|Earth|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|Ceres|Europa|Ganymede|Callisto|Titan|Enceladus|Io|Triton|Phobos|Deimos|Moon|Sun|Halley’s Comet|Orion Nebula|Andromeda|Milky Way|Eris|Makemake|Haumea|Chariklo'.split('|');
const planetSet=new Set('Mercury Venus Earth Mars Jupiter Saturn Uranus Neptune'.split(' '));const moonSet=new Set('Europa Ganymede Callisto Titan Enceladus Io Triton Phobos Deimos Moon'.split(' '));const dwarfSet=new Set('Pluto Ceres Eris Makemake Haumea'.split(' '));const ringSet=new Set('Jupiter Saturn Uranus Neptune Chariklo Haumea'.split(' '));
const space=objects.map(name=>({name,aliases:name==='Moon'?['The Moon']:[],fame:2,attributes:{objectType:planetSet.has(name)?'planet':moonSet.has(name)?'moon':dwarfSet.has(name)?'dwarf planet':name==='Sun'?'star':name==='Milky Way'||name==='Andromeda'?'galaxy':name==='Orion Nebula'?'nebula':name==='Halley’s Comet'?'comet':name==='Chariklo'?'asteroid':'comet',...(!['Andromeda','Orion Nebula'].includes(name)?{solarSystem:'Solar'}:{}),hasRings:ringSet.has(name)}}));
const instruments='piano|guitar|violin|viola|cello|double bass|harp|flute|piccolo|oboe|clarinet|bassoon|saxophone|trumpet|trombone|tuba|French horn|recorder|accordion|harmonica|bagpipes|drums|xylophone|marimba|vibraphone|sitar|tabla|tambura|veena|banjo|mandolin|ukulele|electric guitar|synthesizer|organ'.split('|');
const bowed=new Set('violin viola cello double bass'.split(' '));const woodwind=new Set('flute piccolo oboe clarinet bassoon saxophone recorder'.split(' '));const freeReed=new Set('accordion harmonica'.split(' '));const brass=new Set('trumpet trombone tuba French horn'.split(' '));const percussion=new Set('drums xylophone marimba vibraphone tabla'.split(' '));const keyboard=new Set('piano accordion synthesizer organ'.split(' '));const strings=new Set('guitar violin viola cello double bass harp sitar tambura veena banjo mandolin ukulele'.split(' '));const reed=new Set('oboe clarinet bassoon saxophone harmonica bagpipes accordion'.split(' '));
const instrumentEntities=instruments.map(name=>({name,aliases:[],fame:2,attributes:{family:bowed.has(name)||strings.has(name)?'strings':woodwind.has(name)?'woodwind':brass.has(name)?'brass':percussion.has(name)?'percussion':freeReed.has(name)?'free-reed':name==='bagpipes'?'bagpipe':'keyboard',playedWithBow:bowed.has(name),keys:keyboard.has(name),reed:reed.has(name)}}));
const foods='pizza|sushi|curry|biryani|dosa|samosa|idli|naan|ramen|pho|pad thai|tacos|burrito|enchilada|paella|risotto|pasta|lasagna|dumpling|dim sum|kebab|falafel|hummus|guacamole|pancake|waffle|croissant|baguette|butter chicken|gulab jamun|pani puri|chole bhature|dal makhani|miso soup|kimchi|fried rice|hamburger|hot dog|sandwich|salad|ice cream|chocolate|cheesecake|apple pie|gelato|tiramisu|samosa chaat|poha|upma|paratha|jalebi|rasgulla|mango lassi|tandoori chicken|bibimbap|tempura|pad see ew|spring roll|pierogi|schnitzel|fish and chips|brownie|mochi'.split('|');
const foodOrigin={pizza:'Italy',sushi:'Japan',biryani:'India',dosa:'India',samosa:'India',idli:'India',naan:'India',ramen:'Japan',pho:'Vietnam','pad thai':'Thailand',tacos:'Mexico',burrito:'Mexico',enchilada:'Mexico',paella:'Spain',risotto:'Italy',pasta:'Italy',lasagna:'Italy',dumpling:'China','dim sum':'China',guacamole:'Mexico',croissant:'France',baguette:'France','butter chicken':'India','gulab jamun':'India','pani puri':'India','chole bhature':'India','dal makhani':'India','miso soup':'Japan',kimchi:'Korea',gelato:'Italy',tiramisu:'Italy'};
const riceFoods=new Set('sushi biryani idli ramen pho risotto'.split(' '));const wheatFoods=new Set('pizza samosa naan pasta lasagna dumpling croissant baguette'.split(' '));const potatoFoods=new Set('dosa samosa french fries'.split(' '));const desserts=new Set('gulab jamun ice cream chocolate cheesecake apple pie gelato tiramisu'.split(' '));const snacks=new Set('samosa pani puri guacamole hummus hot dog'.split(' '));
const foodEntities=foods.map(name=>({name,aliases:name==='biryani'?['biriyani']:[],fame:2,attributes:{...(foodOrigin[name]?{originCountry:foodOrigin[name]}:{}),...(riceFoods.has(name)?{mainIngredient:'rice'}:wheatFoods.has(name)?{mainIngredient:'wheat'}:potatoFoods.has(name)?{mainIngredient:'potato'}:{}),taste:desserts.has(name)?'sweet':'savoury',...(desserts.has(name)?{servedAs:'dessert'}:snacks.has(name)?{servedAs:'snack'}:{})}}));
const sports='football basketball cricket tennis volleyball rugby baseball golf badminton table tennis swimming athletics boxing wrestling cycling skiing gymnastics soccer field hockey ice hockey American football kabaddi chess archery rowing fencing weightlifting'.split(' ');
const teamSports=new Set('football basketball cricket volleyball rugby baseball field hockey ice hockey American football kabaddi'.split(' '));const ballSports=new Set('football basketball cricket tennis volleyball rugby baseball golf badminton soccer field hockey ice hockey American football'.split(' '));const players={'football':11,'basketball':5,'cricket':11,'volleyball':6,'baseball':9,'field hockey':11,'ice hockey':6,'American football':11,'kabaddi':7};
const sportEntities=sports.map(name=>({name,aliases:name==='football'?['soccer']:[],fame:2,attributes:{teamOrIndividual:teamSports.has(name)?'team':'individual',...(ballSports.has(name)?{usesBall:true}:{}),...(players[name]?{playersPerSide:players[name]}:{})}}));
await mkdir('facts',{recursive:true});
for(const [file,table] of [['countries',header('countries',countries)],['video-game-characters',header('video game characters',chars)],['animals',header('animals',animalEntities)],['space-objects',header('space objects',space)],['musical-instruments',header('musical instruments',instrumentEntities)],['foods',header('foods and dishes',foodEntities)],['sports',header('sports',sportEntities)]]){const path=`facts/${file}.json`;if(await access(path).then(()=>true,()=>false)){console.log(`Skipping ${path}: curated table already exists.`);continue;}await writeFile(path,JSON.stringify(table,null,2)+'\n');}
console.log(JSON.stringify({countries:countries.length,characters:chars.length,animals:animalEntities.length,space:space.length,instruments:instrumentEntities.length,foods:foodEntities.length,sports:sportEntities.length}));
