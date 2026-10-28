import type { Puzzle } from './types.js';
export const forgedPack: Puzzle[]=[
  {
    "id": "forge-3b7865ae49",
    "sourceTable": "video game characters",
    "category": "games",
    "difficulty": "medium",
    "answer": "Link",
    "aliases": [],
    "halfA": "A character is in a Nintendo series and first appeared in the 1980s.",
    "halfB": "A character wields a sword.",
    "alsoFitsA": [
      "Luigi",
      "Mario",
      "Samus",
      "Birdo",
      "Bowser",
      "Donkey Kong",
      "Peach",
      "Toad",
      "Zelda"
    ],
    "alsoFitsB": [
      "Cloud Strife",
      "Ganondorf",
      "Jin Sakai",
      "Alexios",
      "Ezio",
      "Geralt",
      "Sephiroth",
      "Shulk"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "publisher",
          "operator": "eq",
          "value": "Nintendo"
        },
        {
          "attribute": "debutDecade",
          "operator": "eq",
          "value": "1980s"
        }
      ],
      "halfB": [
        {
          "attribute": "wieldsSword",
          "operator": "eq",
          "value": true
        }
      ],
      "setSizeA": 10,
      "setSizeB": 9
    },
    "halfAAlsoFits": [
      "Luigi",
      "Mario",
      "Samus",
      "Birdo",
      "Bowser",
      "Donkey Kong",
      "Peach",
      "Toad",
      "Zelda"
    ],
    "halfBAlsoFits": [
      "Cloud Strife",
      "Ganondorf",
      "Jin Sakai",
      "Alexios",
      "Ezio",
      "Geralt",
      "Sephiroth",
      "Shulk"
    ],
    "hintA": "A character is a silent protagonist.",
    "hintB": "A character debuted in an action-adventure game."
  },
  {
    "id": "forge-7e8cb07986",
    "sourceTable": "video game characters",
    "category": "games",
    "difficulty": "medium",
    "answer": "Mega Man",
    "aliases": [],
    "halfA": "A character first appeared in the 1980s and debuted in a platform game.",
    "halfB": "A character is in a Capcom series.",
    "alsoFitsA": [
      "Luigi",
      "Mario",
      "Birdo",
      "Bowser",
      "Donkey Kong",
      "Peach",
      "Toad"
    ],
    "alsoFitsB": [
      "Chun-Li",
      "Jill Valentine",
      "Leon Kennedy",
      "Ryu",
      "Albert Wesker",
      "Ken Masters"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "debutDecade",
          "operator": "eq",
          "value": "1980s"
        },
        {
          "attribute": "debutGenre",
          "operator": "eq",
          "value": "platform"
        }
      ],
      "halfB": [
        {
          "attribute": "publisher",
          "operator": "eq",
          "value": "Capcom"
        }
      ],
      "setSizeA": 8,
      "setSizeB": 7
    },
    "halfAAlsoFits": [
      "Luigi",
      "Mario",
      "Birdo",
      "Bowser",
      "Donkey Kong",
      "Peach",
      "Toad"
    ],
    "halfBAlsoFits": [
      "Chun-Li",
      "Jill Valentine",
      "Leon Kennedy",
      "Ryu",
      "Albert Wesker",
      "Ken Masters"
    ],
    "hintA": "A character is male.",
    "hintB": "A character is male."
  },
  {
    "id": "forge-4fc54ce6db",
    "sourceTable": "video game characters",
    "category": "games",
    "difficulty": "medium",
    "answer": "Sephiroth",
    "aliases": [],
    "halfA": "A character debuted in a role-playing game and wields a sword.",
    "halfB": "A character is a villain.",
    "alsoFitsA": [
      "Cloud Strife",
      "Alexios",
      "Geralt",
      "Shulk"
    ],
    "alsoFitsB": [
      "Ganondorf",
      "Albert Wesker",
      "Bowser",
      "Bowser Jr.",
      "Dr. Eggman",
      "Porky Minch",
      "King K. Rool"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "debutGenre",
          "operator": "eq",
          "value": "role-playing"
        },
        {
          "attribute": "wieldsSword",
          "operator": "eq",
          "value": true
        }
      ],
      "halfB": [
        {
          "attribute": "isVillain",
          "operator": "eq",
          "value": true
        }
      ],
      "setSizeA": 5,
      "setSizeB": 8
    },
    "halfAAlsoFits": [
      "Cloud Strife",
      "Alexios",
      "Geralt",
      "Shulk"
    ],
    "halfBAlsoFits": [
      "Ganondorf",
      "Albert Wesker",
      "Bowser",
      "Bowser Jr.",
      "Dr. Eggman",
      "Porky Minch",
      "King K. Rool"
    ],
    "hintA": "A character first appeared in the 1990s.",
    "hintB": "A character first appeared in the 1990s."
  },
  {
    "id": "forge-c4a645943d",
    "sourceTable": "countries",
    "category": "geography",
    "difficulty": "medium",
    "answer": "Iceland",
    "aliases": [],
    "halfA": "A country drives on the right and is not in the European Union.",
    "halfB": "A country has white in its flag and is an island nation.",
    "alsoFitsA": [
      "Albania",
      "Andorra",
      "Belarus",
      "Norway",
      "Russia",
      "Serbia",
      "Switzerland",
      "Ukraine"
    ],
    "alsoFitsB": [
      "Cuba",
      "Japan",
      "Indonesia",
      "Ireland",
      "Maldives",
      "New Zealand",
      "Philippines",
      "Singapore",
      "United Kingdom"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "drivingSide",
          "operator": "eq",
          "value": "right"
        },
        {
          "attribute": "euMember",
          "operator": "eq",
          "value": false
        }
      ],
      "halfB": [
        {
          "attribute": "flagColors",
          "operator": "has",
          "value": "white"
        },
        {
          "attribute": "islandNation",
          "operator": "eq",
          "value": true
        }
      ],
      "setSizeA": 9,
      "setSizeB": 10
    },
    "halfAAlsoFits": [
      "Albania",
      "Andorra",
      "Belarus",
      "Norway",
      "Russia",
      "Serbia",
      "Switzerland",
      "Ukraine"
    ],
    "halfBAlsoFits": [
      "Cuba",
      "Japan",
      "Indonesia",
      "Ireland",
      "Maldives",
      "New Zealand",
      "Philippines",
      "Singapore",
      "United Kingdom"
    ],
    "hintA": "A country has a cross on its flag.",
    "hintB": "A country is in Europe."
  },
  {
    "id": "forge-3f36e4a0b8",
    "sourceTable": "countries",
    "category": "geography",
    "difficulty": "medium",
    "answer": "Morocco",
    "aliases": [],
    "halfA": "A country has never hosted the Summer Olympics and is a monarchy.",
    "halfB": "A country has a coastline and is in Africa.",
    "alsoFitsA": [
      "Denmark",
      "Bhutan",
      "Cambodia",
      "Jordan",
      "Malaysia",
      "New Zealand",
      "Norway",
      "Saudi Arabia",
      "Thailand"
    ],
    "alsoFitsB": [
      "Algeria",
      "Angola",
      "Cameroon",
      "Egypt",
      "Ghana",
      "Kenya",
      "Nigeria",
      "South Africa"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "hostedSummerOlympics",
          "operator": "eq",
          "value": false
        },
        {
          "attribute": "monarchy",
          "operator": "eq",
          "value": true
        }
      ],
      "halfB": [
        {
          "attribute": "landlocked",
          "operator": "eq",
          "value": false
        },
        {
          "attribute": "continent",
          "operator": "eq",
          "value": "Africa"
        }
      ],
      "setSizeA": 10,
      "setSizeB": 9
    },
    "halfAAlsoFits": [
      "Denmark",
      "Bhutan",
      "Cambodia",
      "Jordan",
      "Malaysia",
      "New Zealand",
      "Norway",
      "Saudi Arabia",
      "Thailand"
    ],
    "halfBAlsoFits": [
      "Algeria",
      "Angola",
      "Cameroon",
      "Egypt",
      "Ghana",
      "Kenya",
      "Nigeria",
      "South Africa"
    ],
    "hintA": "A country has green in its flag.",
    "hintB": "A country is mainly Arabic-speaking."
  },
  {
    "id": "forge-165704b5d9",
    "sourceTable": "countries",
    "category": "geography",
    "difficulty": "medium",
    "answer": "Ecuador",
    "aliases": [],
    "halfA": "A country is not an island nation and is mainly Spanish-speaking.",
    "halfB": "A country uses the dollar as its currency.",
    "alsoFitsA": [
      "Mexico",
      "Argentina",
      "Bolivia",
      "Chile",
      "Colombia",
      "Costa Rica",
      "Panama",
      "Peru",
      "Spain"
    ],
    "alsoFitsB": [
      "Australia",
      "Canada",
      "Jamaica",
      "United States",
      "Fiji",
      "New Zealand",
      "Singapore"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "islandNation",
          "operator": "eq",
          "value": false
        },
        {
          "attribute": "mainLanguage",
          "operator": "eq",
          "value": "Spanish"
        }
      ],
      "halfB": [
        {
          "attribute": "currency",
          "operator": "eq",
          "value": "dollar"
        }
      ],
      "setSizeA": 10,
      "setSizeB": 8
    },
    "halfAAlsoFits": [
      "Mexico",
      "Argentina",
      "Bolivia",
      "Chile",
      "Colombia",
      "Costa Rica",
      "Panama",
      "Peru",
      "Spain"
    ],
    "halfBAlsoFits": [
      "Australia",
      "Canada",
      "Jamaica",
      "United States",
      "Fiji",
      "New Zealand",
      "Singapore"
    ],
    "hintA": "A country is in South America.",
    "hintB": "A country drives on the right."
  },
  {
    "id": "forge-08838cb671",
    "sourceTable": "countries",
    "category": "geography",
    "difficulty": "medium",
    "answer": "Spain",
    "aliases": [],
    "halfA": "A country is not an island nation and is mainly Spanish-speaking.",
    "halfB": "A country is in Europe and has hosted the Summer Olympics.",
    "alsoFitsA": [
      "Mexico",
      "Argentina",
      "Bolivia",
      "Chile",
      "Colombia",
      "Costa Rica",
      "Ecuador",
      "Panama",
      "Peru"
    ],
    "alsoFitsB": [
      "France",
      "Belgium",
      "Finland",
      "Germany",
      "Greece",
      "Italy",
      "Netherlands",
      "Sweden",
      "United Kingdom"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "islandNation",
          "operator": "eq",
          "value": false
        },
        {
          "attribute": "mainLanguage",
          "operator": "eq",
          "value": "Spanish"
        }
      ],
      "halfB": [
        {
          "attribute": "continent",
          "operator": "eq",
          "value": "Europe"
        },
        {
          "attribute": "hostedSummerOlympics",
          "operator": "eq",
          "value": true
        }
      ],
      "setSizeA": 10,
      "setSizeB": 10
    },
    "halfAAlsoFits": [
      "Mexico",
      "Argentina",
      "Bolivia",
      "Chile",
      "Colombia",
      "Costa Rica",
      "Ecuador",
      "Panama",
      "Peru"
    ],
    "halfBAlsoFits": [
      "France",
      "Belgium",
      "Finland",
      "Germany",
      "Greece",
      "Italy",
      "Netherlands",
      "Sweden",
      "United Kingdom"
    ],
    "hintA": "A country has a coastline.",
    "hintB": "A country is a monarchy."
  },
  {
    "id": "forge-5843427be1",
    "sourceTable": "countries",
    "category": "geography",
    "difficulty": "medium",
    "answer": "Bulgaria",
    "aliases": [],
    "halfA": "A country has never hosted the Summer Olympics and is in the European Union.",
    "halfB": "A country borders Türkiye.",
    "alsoFitsA": [
      "Denmark",
      "Austria",
      "Croatia",
      "Czechia",
      "Hungary",
      "Ireland",
      "Poland",
      "Portugal",
      "Romania"
    ],
    "alsoFitsB": [
      "Armenia",
      "Azerbaijan",
      "Georgia",
      "Greece",
      "Iran",
      "Iraq"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "hostedSummerOlympics",
          "operator": "eq",
          "value": false
        },
        {
          "attribute": "euMember",
          "operator": "eq",
          "value": true
        }
      ],
      "halfB": [
        {
          "attribute": "notableNeighbours",
          "operator": "has",
          "value": "Türkiye"
        }
      ],
      "setSizeA": 10,
      "setSizeB": 7
    },
    "halfAAlsoFits": [
      "Denmark",
      "Austria",
      "Croatia",
      "Czechia",
      "Hungary",
      "Ireland",
      "Poland",
      "Portugal",
      "Romania"
    ],
    "halfBAlsoFits": [
      "Armenia",
      "Azerbaijan",
      "Georgia",
      "Greece",
      "Iran",
      "Iraq"
    ],
    "hintA": "A country has green in its flag.",
    "hintB": "A country is in Europe."
  },
  {
    "id": "forge-289c87bf59",
    "sourceTable": "countries",
    "category": "geography",
    "difficulty": "medium",
    "answer": "Switzerland",
    "aliases": [],
    "halfA": "A country has no coastline and has red in its flag.",
    "halfB": "A country has white in its flag and has a cross on its flag.",
    "alsoFitsA": [
      "Armenia",
      "Austria",
      "Azerbaijan",
      "Belarus",
      "Czechia",
      "Ethiopia",
      "Hungary",
      "Laos",
      "Mongolia",
      "Nepal"
    ],
    "alsoFitsB": [
      "Australia",
      "Denmark",
      "Finland",
      "Georgia",
      "Greece",
      "Iceland",
      "New Zealand",
      "Norway",
      "United Kingdom"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "landlocked",
          "operator": "eq",
          "value": true
        },
        {
          "attribute": "flagColors",
          "operator": "has",
          "value": "red"
        }
      ],
      "halfB": [
        {
          "attribute": "flagColors",
          "operator": "has",
          "value": "white"
        },
        {
          "attribute": "flagFeatures",
          "operator": "has",
          "value": "cross"
        }
      ],
      "setSizeA": 11,
      "setSizeB": 10
    },
    "halfAAlsoFits": [
      "Armenia",
      "Austria",
      "Azerbaijan",
      "Belarus",
      "Czechia",
      "Ethiopia",
      "Hungary",
      "Laos",
      "Mongolia",
      "Nepal"
    ],
    "halfBAlsoFits": [
      "Australia",
      "Denmark",
      "Finland",
      "Georgia",
      "Greece",
      "Iceland",
      "New Zealand",
      "Norway",
      "United Kingdom"
    ],
    "hintA": "A country is not in the European Union.",
    "hintB": "A country borders Germany."
  },
  {
    "id": "forge-20e5fc7f57",
    "sourceTable": "countries",
    "category": "geography",
    "difficulty": "hard",
    "answer": "Cuba",
    "aliases": [],
    "halfA": "A country drives on the right and is in North America.",
    "halfB": "A country is an island nation.",
    "alsoFitsA": [
      "Canada",
      "Mexico",
      "United States",
      "Costa Rica",
      "Panama"
    ],
    "alsoFitsB": [
      "Jamaica",
      "Japan",
      "Fiji",
      "Iceland",
      "Indonesia",
      "Ireland",
      "Maldives",
      "New Zealand",
      "Philippines",
      "Singapore",
      "Sri Lanka",
      "United Kingdom"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "drivingSide",
          "operator": "eq",
          "value": "right"
        },
        {
          "attribute": "continent",
          "operator": "eq",
          "value": "North America"
        }
      ],
      "halfB": [
        {
          "attribute": "islandNation",
          "operator": "eq",
          "value": true
        }
      ],
      "setSizeA": 6,
      "setSizeB": 13
    },
    "halfAAlsoFits": [
      "Canada",
      "Mexico",
      "United States",
      "Costa Rica",
      "Panama"
    ],
    "halfBAlsoFits": [
      "Jamaica",
      "Japan",
      "Fiji",
      "Iceland",
      "Indonesia",
      "Ireland",
      "Maldives",
      "New Zealand",
      "Philippines",
      "Singapore",
      "Sri Lanka",
      "United Kingdom"
    ],
    "hintA": "A country uses the peso as its currency.",
    "hintB": "A country has a star on its flag."
  },
  {
    "id": "forge-836ad8450a",
    "sourceTable": "countries",
    "category": "geography",
    "difficulty": "hard",
    "answer": "Japan",
    "aliases": [],
    "halfA": "A country is in Asia and has red in its flag.",
    "halfB": "A country is a monarchy and has hosted the Summer Olympics.",
    "alsoFitsA": [
      "China",
      "Türkiye",
      "Armenia",
      "Azerbaijan",
      "Bangladesh",
      "Georgia",
      "Indonesia",
      "Iran",
      "Iraq",
      "Jordan",
      "Laos",
      "Lebanon",
      "Malaysia",
      "Maldives",
      "Mongolia",
      "Myanmar",
      "Nepal",
      "North Korea",
      "Philippines",
      "Singapore",
      "South Korea",
      "Thailand",
      "United Arab Emirates",
      "Vietnam"
    ],
    "alsoFitsB": [
      "Australia",
      "Canada",
      "Belgium",
      "Netherlands",
      "Spain",
      "Sweden",
      "United Kingdom"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "continent",
          "operator": "eq",
          "value": "Asia"
        },
        {
          "attribute": "flagColors",
          "operator": "has",
          "value": "red"
        }
      ],
      "halfB": [
        {
          "attribute": "monarchy",
          "operator": "eq",
          "value": true
        },
        {
          "attribute": "hostedSummerOlympics",
          "operator": "eq",
          "value": true
        }
      ],
      "setSizeA": 25,
      "setSizeB": 8
    },
    "halfAAlsoFits": [
      "China",
      "Türkiye",
      "Armenia",
      "Azerbaijan",
      "Bangladesh",
      "Georgia",
      "Indonesia",
      "Iran",
      "Iraq",
      "Jordan",
      "Laos",
      "Lebanon",
      "Malaysia",
      "Maldives",
      "Mongolia",
      "Myanmar",
      "Nepal",
      "North Korea",
      "Philippines",
      "Singapore",
      "South Korea",
      "Thailand",
      "United Arab Emirates",
      "Vietnam"
    ],
    "halfBAlsoFits": [
      "Australia",
      "Canada",
      "Belgium",
      "Netherlands",
      "Spain",
      "Sweden",
      "United Kingdom"
    ],
    "hintA": "A country is an island nation.",
    "hintB": "A country drives on the left."
  },
  {
    "id": "forge-cdbfc9b572",
    "sourceTable": "animals",
    "category": "science",
    "difficulty": "medium",
    "answer": "pig",
    "aliases": [],
    "halfA": "An animal is a mammal and is kept as a farm animal or pet.",
    "halfB": "An animal cannot fly and is an omnivore.",
    "alsoFitsA": [
      "camel",
      "cat",
      "cow",
      "dog",
      "goat",
      "horse",
      "llama",
      "rabbit",
      "sheep"
    ],
    "alsoFitsB": [
      "bear",
      "chimpanzee",
      "crab",
      "fox",
      "lobster",
      "opossum",
      "raccoon",
      "skunk"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "animalClass",
          "operator": "eq",
          "value": "mammal"
        },
        {
          "attribute": "domesticated",
          "operator": "eq",
          "value": true
        }
      ],
      "halfB": [
        {
          "attribute": "canFly",
          "operator": "eq",
          "value": false
        },
        {
          "attribute": "diet",
          "operator": "eq",
          "value": "omnivore"
        }
      ],
      "setSizeA": 10,
      "setSizeB": 9
    },
    "halfAAlsoFits": [
      "camel",
      "cat",
      "cow",
      "dog",
      "goat",
      "horse",
      "llama",
      "rabbit",
      "sheep"
    ],
    "halfBAlsoFits": [
      "bear",
      "chimpanzee",
      "crab",
      "fox",
      "lobster",
      "opossum",
      "raccoon",
      "skunk"
    ],
    "hintA": "An animal has hooves.",
    "hintB": "An animal has four legs."
  },
  {
    "id": "forge-1d1813e286",
    "sourceTable": "animals",
    "category": "science",
    "difficulty": "hard",
    "answer": "cat",
    "aliases": [],
    "halfA": "An animal is a mammal and is a carnivore.",
    "halfB": "An animal cannot fly and is kept as a farm animal or pet.",
    "alsoFitsA": [
      "cheetah",
      "dolphin",
      "lion",
      "seal",
      "tiger",
      "whale",
      "jaguar",
      "leopard",
      "orca",
      "otter",
      "platypus",
      "polar bear",
      "Tasmanian devil",
      "wolf"
    ],
    "alsoFitsB": [
      "camel",
      "cow",
      "dog",
      "goat",
      "horse",
      "llama",
      "pig",
      "rabbit",
      "sheep"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "animalClass",
          "operator": "eq",
          "value": "mammal"
        },
        {
          "attribute": "diet",
          "operator": "eq",
          "value": "carnivore"
        }
      ],
      "halfB": [
        {
          "attribute": "canFly",
          "operator": "eq",
          "value": false
        },
        {
          "attribute": "domesticated",
          "operator": "eq",
          "value": true
        }
      ],
      "setSizeA": 15,
      "setSizeB": 10
    },
    "halfAAlsoFits": [
      "cheetah",
      "dolphin",
      "lion",
      "seal",
      "tiger",
      "whale",
      "jaguar",
      "leopard",
      "orca",
      "otter",
      "platypus",
      "polar bear",
      "Tasmanian devil",
      "wolf"
    ],
    "halfBAlsoFits": [
      "camel",
      "cow",
      "dog",
      "goat",
      "horse",
      "llama",
      "pig",
      "rabbit",
      "sheep"
    ],
    "hintA": "An animal has four legs."
  },
  {
    "id": "forge-161e9d7023",
    "sourceTable": "animals",
    "category": "science",
    "difficulty": "hard",
    "answer": "penguin",
    "aliases": [],
    "halfA": "An animal cannot fly and is a carnivore.",
    "halfB": "An animal is a bird.",
    "alsoFitsA": [
      "cheetah",
      "dolphin",
      "lion",
      "seal",
      "tiger",
      "whale",
      "alligator",
      "cat",
      "crocodile",
      "frog",
      "jaguar",
      "jellyfish",
      "king cobra",
      "Komodo dragon",
      "leopard",
      "octopus",
      "orca",
      "otter",
      "platypus",
      "polar bear",
      "salmon",
      "scorpion",
      "shark",
      "snake",
      "spider",
      "Tasmanian devil",
      "tuna",
      "wolf"
    ],
    "alsoFitsB": [
      "duck",
      "eagle",
      "chicken",
      "emu",
      "flamingo",
      "goose",
      "ostrich",
      "owl",
      "parrot",
      "peacock",
      "swan"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "canFly",
          "operator": "eq",
          "value": false
        },
        {
          "attribute": "diet",
          "operator": "eq",
          "value": "carnivore"
        }
      ],
      "halfB": [
        {
          "attribute": "animalClass",
          "operator": "eq",
          "value": "bird"
        }
      ],
      "setSizeA": 29,
      "setSizeB": 12
    },
    "halfAAlsoFits": [
      "cheetah",
      "dolphin",
      "lion",
      "seal",
      "tiger",
      "whale",
      "alligator",
      "cat",
      "crocodile",
      "frog",
      "jaguar",
      "jellyfish",
      "king cobra",
      "Komodo dragon",
      "leopard",
      "octopus",
      "orca",
      "otter",
      "platypus",
      "polar bear",
      "salmon",
      "scorpion",
      "shark",
      "snake",
      "spider",
      "Tasmanian devil",
      "tuna",
      "wolf"
    ],
    "halfBAlsoFits": [
      "duck",
      "eagle",
      "chicken",
      "emu",
      "flamingo",
      "goose",
      "ostrich",
      "owl",
      "parrot",
      "peacock",
      "swan"
    ],
    "hintA": "An animal is black and white.",
    "hintB": "An animal lives in the wild."
  },
  {
    "id": "forge-b8813f0192",
    "sourceTable": "foods and dishes",
    "category": "food",
    "difficulty": "medium",
    "answer": "takoyaki",
    "aliases": [],
    "halfA": "A dish comes from Japan.",
    "halfB": "A dish is a popular street food.",
    "alsoFitsA": [
      "ramen",
      "sushi",
      "miso soup",
      "mochi",
      "tempura",
      "udon",
      "yakitori",
      "onigiri"
    ],
    "alsoFitsB": [
      "falafel",
      "hot dog",
      "kebab",
      "pad thai",
      "pani puri",
      "samosa",
      "samosa chaat",
      "satay",
      "tacos",
      "tteokbokki"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "Japan"
        }
      ],
      "halfB": [
        {
          "attribute": "servedAs",
          "operator": "eq",
          "value": "street food"
        }
      ],
      "setSizeA": 9,
      "setSizeB": 11
    },
    "halfAAlsoFits": [
      "ramen",
      "sushi",
      "miso soup",
      "mochi",
      "tempura",
      "udon",
      "yakitori",
      "onigiri"
    ],
    "halfBAlsoFits": [
      "falafel",
      "hot dog",
      "kebab",
      "pad thai",
      "pani puri",
      "samosa",
      "samosa chaat",
      "satay",
      "tacos",
      "tteokbokki"
    ],
    "hintA": "A dish is usually served hot.",
    "hintB": "A dish is usually served hot."
  },
  {
    "id": "forge-19753100c9",
    "sourceTable": "foods and dishes",
    "category": "food",
    "difficulty": "medium",
    "answer": "tempura",
    "aliases": [],
    "halfA": "A dish comes from Japan.",
    "halfB": "A dish is usually deep-fried.",
    "alsoFitsA": [
      "ramen",
      "sushi",
      "miso soup",
      "mochi",
      "takoyaki",
      "udon",
      "yakitori",
      "onigiri"
    ],
    "alsoFitsB": [
      "churros",
      "doughnut",
      "falafel",
      "fish and chips",
      "French fries",
      "gulab jamun",
      "jalebi",
      "pani puri",
      "samosa",
      "spring roll"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "Japan"
        }
      ],
      "halfB": [
        {
          "attribute": "cookingMethod",
          "operator": "eq",
          "value": "deep-fried"
        }
      ],
      "setSizeA": 9,
      "setSizeB": 11
    },
    "halfAAlsoFits": [
      "ramen",
      "sushi",
      "miso soup",
      "mochi",
      "takoyaki",
      "udon",
      "yakitori",
      "onigiri"
    ],
    "halfBAlsoFits": [
      "churros",
      "doughnut",
      "falafel",
      "fish and chips",
      "French fries",
      "gulab jamun",
      "jalebi",
      "pani puri",
      "samosa",
      "spring roll"
    ],
    "hintA": "A dish is usually served hot.",
    "hintB": "A dish is usually savoury."
  },
  {
    "id": "forge-0fc13d8985",
    "sourceTable": "foods and dishes",
    "category": "food",
    "difficulty": "medium",
    "answer": "cornbread",
    "aliases": [],
    "halfA": "A dish is usually baked.",
    "halfB": "A dish is mainly made with corn.",
    "alsoFitsA": [
      "lasagna",
      "pizza",
      "apple pie",
      "baguette",
      "brownie",
      "croissant",
      "focaccia",
      "naan",
      "quiche"
    ],
    "alsoFitsB": [
      "enchilada",
      "nachos",
      "polenta",
      "tamales"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "cookingMethod",
          "operator": "eq",
          "value": "baked"
        }
      ],
      "halfB": [
        {
          "attribute": "mainIngredient",
          "operator": "eq",
          "value": "corn"
        }
      ],
      "setSizeA": 10,
      "setSizeB": 5
    },
    "halfAAlsoFits": [
      "lasagna",
      "pizza",
      "apple pie",
      "baguette",
      "brownie",
      "croissant",
      "focaccia",
      "naan",
      "quiche"
    ],
    "halfBAlsoFits": [
      "enchilada",
      "nachos",
      "polenta",
      "tamales"
    ],
    "hintA": "A dish comes from the United States."
  },
  {
    "id": "forge-774c053ae4",
    "sourceTable": "foods and dishes",
    "category": "food",
    "difficulty": "medium",
    "answer": "gazpacho",
    "aliases": [],
    "halfA": "A dish is a soup.",
    "halfB": "A dish is usually served cold.",
    "alsoFitsA": [
      "ramen",
      "miso soup",
      "pho",
      "tom yum"
    ],
    "alsoFitsB": [
      "cheesecake",
      "gelato",
      "ice cream",
      "mango lassi",
      "salad",
      "tiramisu",
      "rasmalai"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "dishType",
          "operator": "has",
          "value": "soup"
        }
      ],
      "halfB": [
        {
          "attribute": "servedHotOrCold",
          "operator": "eq",
          "value": "cold"
        }
      ],
      "setSizeA": 5,
      "setSizeB": 8
    },
    "halfAAlsoFits": [
      "ramen",
      "miso soup",
      "pho",
      "tom yum"
    ],
    "halfBAlsoFits": [
      "cheesecake",
      "gelato",
      "ice cream",
      "mango lassi",
      "salad",
      "tiramisu",
      "rasmalai"
    ]
  },
  {
    "id": "forge-d699dbe215",
    "sourceTable": "foods and dishes",
    "category": "food",
    "difficulty": "medium",
    "answer": "polenta",
    "aliases": [],
    "halfA": "A dish comes from Italy.",
    "halfB": "A dish is mainly made with corn.",
    "alsoFitsA": [
      "lasagna",
      "pasta",
      "pizza",
      "risotto",
      "carbonara",
      "focaccia",
      "gelato",
      "gnocchi",
      "tiramisu"
    ],
    "alsoFitsB": [
      "enchilada",
      "nachos",
      "tamales",
      "cornbread"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "Italy"
        }
      ],
      "halfB": [
        {
          "attribute": "mainIngredient",
          "operator": "eq",
          "value": "corn"
        }
      ],
      "setSizeA": 10,
      "setSizeB": 5
    },
    "halfAAlsoFits": [
      "lasagna",
      "pasta",
      "pizza",
      "risotto",
      "carbonara",
      "focaccia",
      "gelato",
      "gnocchi",
      "tiramisu"
    ],
    "halfBAlsoFits": [
      "enchilada",
      "nachos",
      "tamales",
      "cornbread"
    ],
    "hintA": "A dish is usually served hot.",
    "hintB": "A dish is usually savoury."
  },
  {
    "id": "forge-ed80615956",
    "sourceTable": "foods and dishes",
    "category": "food",
    "difficulty": "medium",
    "answer": "falafel",
    "aliases": [],
    "halfA": "A dish is usually deep-fried.",
    "halfB": "A dish is mainly made with chickpeas.",
    "alsoFitsA": [
      "churros",
      "doughnut",
      "fish and chips",
      "French fries",
      "gulab jamun",
      "jalebi",
      "pani puri",
      "samosa",
      "spring roll",
      "tempura"
    ],
    "alsoFitsB": [
      "chana masala",
      "chole bhature",
      "hummus",
      "dhokla"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "cookingMethod",
          "operator": "eq",
          "value": "deep-fried"
        }
      ],
      "halfB": [
        {
          "attribute": "mainIngredient",
          "operator": "eq",
          "value": "chickpeas"
        }
      ],
      "setSizeA": 11,
      "setSizeB": 5
    },
    "halfAAlsoFits": [
      "churros",
      "doughnut",
      "fish and chips",
      "French fries",
      "gulab jamun",
      "jalebi",
      "pani puri",
      "samosa",
      "spring roll",
      "tempura"
    ],
    "halfBAlsoFits": [
      "chana masala",
      "chole bhature",
      "hummus",
      "dhokla"
    ],
    "hintA": "A dish is a popular street food.",
    "hintB": "A dish is usually served hot."
  },
  {
    "id": "forge-5de71bc762",
    "sourceTable": "foods and dishes",
    "category": "food",
    "difficulty": "hard",
    "answer": "fried rice",
    "aliases": [],
    "halfA": "A dish is usually savoury and is mainly made with rice.",
    "halfB": "A dish comes from China.",
    "alsoFitsA": [
      "biryani",
      "risotto",
      "sushi",
      "bibimbap",
      "dosa",
      "idli",
      "pad see ew",
      "pad thai",
      "paella",
      "pho",
      "poha",
      "onigiri",
      "tteokbokki"
    ],
    "alsoFitsB": [
      "chow mein",
      "dim sum",
      "kung pao chicken",
      "Peking duck",
      "spring roll",
      "mapo tofu",
      "xiaolongbao"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "taste",
          "operator": "eq",
          "value": "savoury"
        },
        {
          "attribute": "mainIngredient",
          "operator": "eq",
          "value": "rice"
        }
      ],
      "halfB": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "China"
        }
      ],
      "setSizeA": 14,
      "setSizeB": 8
    },
    "halfAAlsoFits": [
      "biryani",
      "risotto",
      "sushi",
      "bibimbap",
      "dosa",
      "idli",
      "pad see ew",
      "pad thai",
      "paella",
      "pho",
      "poha",
      "onigiri",
      "tteokbokki"
    ],
    "halfBAlsoFits": [
      "chow mein",
      "dim sum",
      "kung pao chicken",
      "Peking duck",
      "spring roll",
      "mapo tofu",
      "xiaolongbao"
    ],
    "hintA": "A dish is usually stir-fried.",
    "hintB": "A dish is usually served hot."
  },
  {
    "id": "forge-2973d3dfee",
    "sourceTable": "foods and dishes",
    "category": "food",
    "difficulty": "hard",
    "answer": "risotto",
    "aliases": [],
    "halfA": "A dish comes from Italy.",
    "halfB": "A dish is usually savoury and is mainly made with rice.",
    "alsoFitsA": [
      "lasagna",
      "pasta",
      "pizza",
      "carbonara",
      "focaccia",
      "gelato",
      "gnocchi",
      "polenta",
      "tiramisu"
    ],
    "alsoFitsB": [
      "biryani",
      "sushi",
      "bibimbap",
      "dosa",
      "fried rice",
      "idli",
      "pad see ew",
      "pad thai",
      "paella",
      "pho",
      "poha",
      "onigiri",
      "tteokbokki"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "Italy"
        }
      ],
      "halfB": [
        {
          "attribute": "taste",
          "operator": "eq",
          "value": "savoury"
        },
        {
          "attribute": "mainIngredient",
          "operator": "eq",
          "value": "rice"
        }
      ],
      "setSizeA": 10,
      "setSizeB": 14
    },
    "halfAAlsoFits": [
      "lasagna",
      "pasta",
      "pizza",
      "carbonara",
      "focaccia",
      "gelato",
      "gnocchi",
      "polenta",
      "tiramisu"
    ],
    "halfBAlsoFits": [
      "biryani",
      "sushi",
      "bibimbap",
      "dosa",
      "fried rice",
      "idli",
      "pad see ew",
      "pad thai",
      "paella",
      "pho",
      "poha",
      "onigiri",
      "tteokbokki"
    ],
    "hintA": "A dish is usually served hot.",
    "hintB": "A dish is usually served hot."
  },
  {
    "id": "forge-29194f9716",
    "sourceTable": "foods and dishes",
    "category": "food",
    "difficulty": "easy",
    "answer": "tamales",
    "aliases": [],
    "halfA": "A dish is usually steamed.",
    "halfB": "A dish comes from Mexico.",
    "alsoFitsA": [
      "idli",
      "momo",
      "dhokla",
      "xiaolongbao"
    ],
    "alsoFitsB": [
      "burrito",
      "enchilada",
      "guacamole",
      "nachos",
      "quesadilla",
      "tacos"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "cookingMethod",
          "operator": "eq",
          "value": "steamed"
        }
      ],
      "halfB": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "Mexico"
        }
      ],
      "setSizeA": 5,
      "setSizeB": 7
    },
    "halfAAlsoFits": [
      "idli",
      "momo",
      "dhokla",
      "xiaolongbao"
    ],
    "halfBAlsoFits": [
      "burrito",
      "enchilada",
      "guacamole",
      "nachos",
      "quesadilla",
      "tacos"
    ],
    "hintA": "A dish is usually served hot.",
    "hintB": "A dish is mainly made with corn."
  },
  {
    "id": "forge-3d42d657d0",
    "sourceTable": "foods and dishes",
    "category": "food",
    "difficulty": "easy",
    "answer": "tom yum",
    "aliases": [],
    "halfA": "A dish is a soup.",
    "halfB": "A dish comes from Thailand.",
    "alsoFitsA": [
      "ramen",
      "gazpacho",
      "miso soup",
      "pho"
    ],
    "alsoFitsB": [
      "green curry",
      "pad see ew",
      "pad thai",
      "mango sticky rice"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "dishType",
          "operator": "has",
          "value": "soup"
        }
      ],
      "halfB": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "Thailand"
        }
      ],
      "setSizeA": 5,
      "setSizeB": 5
    },
    "halfAAlsoFits": [
      "ramen",
      "gazpacho",
      "miso soup",
      "pho"
    ],
    "halfBAlsoFits": [
      "green curry",
      "pad see ew",
      "pad thai",
      "mango sticky rice"
    ],
    "hintA": "A dish is usually served hot.",
    "hintB": "A dish is usually savoury."
  },
  {
    "id": "forge-bfb227a198",
    "sourceTable": "musical instruments",
    "category": "music",
    "difficulty": "medium",
    "answer": "bansuri",
    "aliases": [],
    "halfA": "An instrument is a wind instrument without a reed.",
    "halfB": "An instrument comes from India.",
    "alsoFitsA": [
      "flute",
      "trumpet",
      "didgeridoo",
      "French horn",
      "piccolo",
      "recorder",
      "trombone",
      "tuba",
      "dizi",
      "shakuhachi"
    ],
    "alsoFitsB": [
      "sitar",
      "tabla",
      "veena",
      "mridangam",
      "sarangi",
      "sarod",
      "shehnai",
      "tambura"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "reed",
          "operator": "eq",
          "value": false
        }
      ],
      "halfB": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "India"
        }
      ],
      "setSizeA": 11,
      "setSizeB": 9
    },
    "halfAAlsoFits": [
      "flute",
      "trumpet",
      "didgeridoo",
      "French horn",
      "piccolo",
      "recorder",
      "trombone",
      "tuba",
      "dizi",
      "shakuhachi"
    ],
    "halfBAlsoFits": [
      "sitar",
      "tabla",
      "veena",
      "mridangam",
      "sarangi",
      "sarod",
      "shehnai",
      "tambura"
    ],
    "hintA": "An instrument is made of bamboo.",
    "hintB": "An instrument belongs to the woodwind family."
  },
  {
    "id": "forge-30054dde67",
    "sourceTable": "musical instruments",
    "category": "music",
    "difficulty": "medium",
    "answer": "sheng",
    "aliases": [],
    "halfA": "An instrument uses a reed.",
    "halfB": "An instrument comes from China.",
    "alsoFitsA": [
      "saxophone",
      "accordion",
      "bagpipes",
      "bassoon",
      "clarinet",
      "harmonica",
      "oboe",
      "shehnai"
    ],
    "alsoFitsB": [
      "dizi",
      "erhu",
      "guzheng",
      "pipa"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "reed",
          "operator": "eq",
          "value": true
        }
      ],
      "halfB": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "China"
        }
      ],
      "setSizeA": 9,
      "setSizeB": 5
    },
    "halfAAlsoFits": [
      "saxophone",
      "accordion",
      "bagpipes",
      "bassoon",
      "clarinet",
      "harmonica",
      "oboe",
      "shehnai"
    ],
    "halfBAlsoFits": [
      "dizi",
      "erhu",
      "guzheng",
      "pipa"
    ],
    "hintA": "An instrument comes from Asia.",
    "hintB": "An instrument is made of bamboo."
  },
  {
    "id": "forge-0154b54d89",
    "sourceTable": "musical instruments",
    "category": "music",
    "difficulty": "medium",
    "answer": "mandolin",
    "aliases": [],
    "halfA": "An instrument comes from Italy.",
    "halfB": "An instrument has frets.",
    "alsoFitsA": [
      "piano",
      "violin",
      "cello",
      "viola"
    ],
    "alsoFitsB": [
      "electric guitar",
      "guitar",
      "balalaika",
      "banjo",
      "sitar",
      "ukulele",
      "veena",
      "bouzouki",
      "pipa"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "Italy"
        }
      ],
      "halfB": [
        {
          "attribute": "hasFrets",
          "operator": "eq",
          "value": true
        }
      ],
      "setSizeA": 5,
      "setSizeB": 10
    },
    "halfAAlsoFits": [
      "piano",
      "violin",
      "cello",
      "viola"
    ],
    "halfBAlsoFits": [
      "electric guitar",
      "guitar",
      "balalaika",
      "banjo",
      "sitar",
      "ukulele",
      "veena",
      "bouzouki",
      "pipa"
    ],
    "hintA": "An instrument belongs to the strings family.",
    "hintB": "An instrument comes from Europe."
  },
  {
    "id": "forge-5245adec6a",
    "sourceTable": "musical instruments",
    "category": "music",
    "difficulty": "easy",
    "answer": "erhu",
    "aliases": [],
    "halfA": "An instrument is played with a bow.",
    "halfB": "An instrument comes from China.",
    "alsoFitsA": [
      "violin",
      "cello",
      "double bass",
      "viola",
      "sarangi"
    ],
    "alsoFitsB": [
      "dizi",
      "guzheng",
      "pipa",
      "sheng"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "playMethod",
          "operator": "eq",
          "value": "bowing"
        }
      ],
      "halfB": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "China"
        }
      ],
      "setSizeA": 6,
      "setSizeB": 5
    },
    "halfAAlsoFits": [
      "violin",
      "cello",
      "double bass",
      "viola",
      "sarangi"
    ],
    "halfBAlsoFits": [
      "dizi",
      "guzheng",
      "pipa",
      "sheng"
    ],
    "hintA": "An instrument comes from Asia.",
    "hintB": "An instrument is a fretless string instrument."
  },
  {
    "id": "forge-cec9a54e17",
    "sourceTable": "space objects",
    "category": "science",
    "difficulty": "medium",
    "answer": "Ceres",
    "aliases": [],
    "halfA": "An object orbits the Sun and has no thick atmosphere.",
    "halfB": "An object was discovered in the 1800s.",
    "alsoFitsA": [
      "Mars",
      "Mercury",
      "Pluto",
      "Chariklo",
      "Eris",
      "Haumea",
      "Makemake"
    ],
    "alsoFitsB": [
      "Neptune",
      "Phobos",
      "Ariel",
      "Deimos",
      "Triton",
      "Umbriel"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "orbits",
          "operator": "eq",
          "value": "Sun"
        },
        {
          "attribute": "thickAtmosphere",
          "operator": "eq",
          "value": false
        }
      ],
      "halfB": [
        {
          "attribute": "discoveryCentury",
          "operator": "eq",
          "value": "1800s"
        }
      ],
      "setSizeA": 8,
      "setSizeB": 7
    },
    "halfAAlsoFits": [
      "Mars",
      "Mercury",
      "Pluto",
      "Chariklo",
      "Eris",
      "Haumea",
      "Makemake"
    ],
    "halfBAlsoFits": [
      "Neptune",
      "Phobos",
      "Ariel",
      "Deimos",
      "Triton",
      "Umbriel"
    ],
    "hintA": "An object has no moons.",
    "hintB": "An object has a name from Roman myth."
  },
  {
    "id": "forge-ac5b802003",
    "sourceTable": "space objects",
    "category": "science",
    "difficulty": "medium",
    "answer": "Mars",
    "aliases": [],
    "halfA": "An object has no thick atmosphere and is a rocky world.",
    "halfB": "An object has moons.",
    "alsoFitsA": [
      "Mercury",
      "Moon",
      "Io",
      "Phobos",
      "Deimos"
    ],
    "alsoFitsB": [
      "Earth",
      "Jupiter",
      "Neptune",
      "Pluto",
      "Saturn",
      "Uranus",
      "Eris",
      "Haumea",
      "Makemake"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "thickAtmosphere",
          "operator": "eq",
          "value": false
        },
        {
          "attribute": "composition",
          "operator": "eq",
          "value": "rocky"
        }
      ],
      "halfB": [
        {
          "attribute": "hasMoons",
          "operator": "eq",
          "value": true
        }
      ],
      "setSizeA": 6,
      "setSizeB": 10
    },
    "halfAAlsoFits": [
      "Mercury",
      "Moon",
      "Io",
      "Phobos",
      "Deimos"
    ],
    "halfBAlsoFits": [
      "Earth",
      "Jupiter",
      "Neptune",
      "Pluto",
      "Saturn",
      "Uranus",
      "Eris",
      "Haumea",
      "Makemake"
    ],
    "hintA": "An object has a name from Roman myth.",
    "hintB": "An object has been known since ancient times."
  },
  {
    "id": "forge-431df05c79",
    "sourceTable": "space objects",
    "category": "science",
    "difficulty": "easy",
    "answer": "Ganymede",
    "aliases": [],
    "halfA": "An object is bigger than our Moon and has no thick atmosphere.",
    "halfB": "An object has an ocean of liquid water.",
    "alsoFitsA": [
      "Mars",
      "Mercury",
      "Io",
      "Callisto"
    ],
    "alsoFitsB": [
      "Earth",
      "Enceladus",
      "Europa",
      "Titan"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "biggerThanMoon",
          "operator": "eq",
          "value": true
        },
        {
          "attribute": "thickAtmosphere",
          "operator": "eq",
          "value": false
        }
      ],
      "halfB": [
        {
          "attribute": "liquidWaterOcean",
          "operator": "eq",
          "value": true
        }
      ],
      "setSizeA": 5,
      "setSizeB": 5
    },
    "halfAAlsoFits": [
      "Mars",
      "Mercury",
      "Io",
      "Callisto"
    ],
    "halfBAlsoFits": [
      "Earth",
      "Enceladus",
      "Europa",
      "Titan"
    ],
    "hintA": "An object is an icy world.",
    "hintB": "An object was discovered by Galileo Galilei."
  },
  {
    "id": "forge-0352d68a5e",
    "sourceTable": "sports",
    "category": "sport",
    "difficulty": "medium",
    "answer": "darts",
    "aliases": [],
    "halfA": "A sport comes from England.",
    "halfB": "A sport keeps score in points and does not use a ball.",
    "alsoFitsA": [
      "cricket",
      "football",
      "tennis",
      "netball",
      "rugby",
      "squash",
      "table tennis"
    ],
    "alsoFitsB": [
      "archery",
      "badminton",
      "curling",
      "diving",
      "fencing",
      "figure skating",
      "kabaddi",
      "karate",
      "surfing",
      "taekwondo",
      "wrestling"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "originCountry",
          "operator": "eq",
          "value": "England"
        }
      ],
      "halfB": [
        {
          "attribute": "scoredIn",
          "operator": "eq",
          "value": "points"
        },
        {
          "attribute": "usesBall",
          "operator": "eq",
          "value": false
        }
      ],
      "setSizeA": 8,
      "setSizeB": 12
    },
    "halfAAlsoFits": [
      "cricket",
      "football",
      "tennis",
      "netball",
      "rugby",
      "squash",
      "table tennis"
    ],
    "halfBAlsoFits": [
      "archery",
      "badminton",
      "curling",
      "diving",
      "fencing",
      "figure skating",
      "kabaddi",
      "karate",
      "surfing",
      "taekwondo",
      "wrestling"
    ],
    "hintA": "A sport has never been in the Olympics.",
    "hintB": "A sport is not a combat sport."
  },
  {
    "id": "forge-09857ed25d",
    "sourceTable": "sports",
    "category": "sport",
    "difficulty": "hard",
    "answer": "badminton",
    "aliases": [],
    "halfA": "A sport is part of the Summer Olympics and does not use a ball.",
    "halfB": "A sport is played on a court.",
    "alsoFitsA": [
      "swimming",
      "archery",
      "boxing",
      "cycling",
      "diving",
      "fencing",
      "judo",
      "rowing",
      "sailing",
      "skateboarding",
      "surfing",
      "taekwondo",
      "weightlifting",
      "wrestling"
    ],
    "alsoFitsB": [
      "basketball",
      "tennis",
      "handball",
      "kabaddi",
      "netball",
      "squash",
      "volleyball",
      "padel"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "olympics",
          "operator": "eq",
          "value": "Summer"
        },
        {
          "attribute": "usesBall",
          "operator": "eq",
          "value": false
        }
      ],
      "halfB": [
        {
          "attribute": "playedOn",
          "operator": "eq",
          "value": "court"
        }
      ],
      "setSizeA": 15,
      "setSizeB": 9
    },
    "halfAAlsoFits": [
      "swimming",
      "archery",
      "boxing",
      "cycling",
      "diving",
      "fencing",
      "judo",
      "rowing",
      "sailing",
      "skateboarding",
      "surfing",
      "taekwondo",
      "weightlifting",
      "wrestling"
    ],
    "halfBAlsoFits": [
      "basketball",
      "tennis",
      "handball",
      "kabaddi",
      "netball",
      "squash",
      "volleyball",
      "padel"
    ],
    "hintA": "A sport keeps score in points.",
    "hintB": "A sport is an individual sport."
  },
  {
    "id": "forge-abf8ec3239",
    "sourceTable": "sports",
    "category": "sport",
    "difficulty": "hard",
    "answer": "squash",
    "aliases": [],
    "halfA": "A sport is not played over a net and is played on a court.",
    "halfB": "A sport keeps score in points and is an individual sport.",
    "alsoFitsA": [
      "basketball",
      "handball",
      "kabaddi",
      "netball"
    ],
    "alsoFitsB": [
      "tennis",
      "archery",
      "badminton",
      "darts",
      "diving",
      "fencing",
      "gymnastics",
      "karate",
      "snooker",
      "surfing",
      "table tennis",
      "taekwondo",
      "wrestling"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "playedOverNet",
          "operator": "eq",
          "value": false
        },
        {
          "attribute": "playedOn",
          "operator": "eq",
          "value": "court"
        }
      ],
      "halfB": [
        {
          "attribute": "scoredIn",
          "operator": "eq",
          "value": "points"
        },
        {
          "attribute": "teamOrIndividual",
          "operator": "eq",
          "value": "individual"
        }
      ],
      "setSizeA": 5,
      "setSizeB": 14
    },
    "halfAAlsoFits": [
      "basketball",
      "handball",
      "kabaddi",
      "netball"
    ],
    "halfBAlsoFits": [
      "tennis",
      "archery",
      "badminton",
      "darts",
      "diving",
      "fencing",
      "gymnastics",
      "karate",
      "snooker",
      "surfing",
      "table tennis",
      "taekwondo",
      "wrestling"
    ],
    "hintA": "A sport comes from England.",
    "hintB": "A sport is played with a racket."
  },
  {
    "id": "forge-f0db3d3caa",
    "sourceTable": "sports",
    "category": "sport",
    "difficulty": "hard",
    "answer": "golf",
    "aliases": [],
    "halfA": "A sport uses a ball and is not played over a net.",
    "halfB": "A sport is part of the Summer Olympics and is an individual sport.",
    "alsoFitsA": [
      "basketball",
      "cricket",
      "football",
      "American football",
      "baseball",
      "field hockey",
      "handball",
      "netball",
      "rugby",
      "snooker",
      "squash",
      "water polo",
      "polo",
      "softball"
    ],
    "alsoFitsB": [
      "swimming",
      "tennis",
      "archery",
      "athletics",
      "badminton",
      "boxing",
      "diving",
      "fencing",
      "gymnastics",
      "judo",
      "skateboarding",
      "surfing",
      "table tennis",
      "taekwondo",
      "weightlifting",
      "wrestling"
    ],
    "predicates": {
      "halfA": [
        {
          "attribute": "usesBall",
          "operator": "eq",
          "value": true
        },
        {
          "attribute": "playedOverNet",
          "operator": "eq",
          "value": false
        }
      ],
      "halfB": [
        {
          "attribute": "olympics",
          "operator": "eq",
          "value": "Summer"
        },
        {
          "attribute": "teamOrIndividual",
          "operator": "eq",
          "value": "individual"
        }
      ],
      "setSizeA": 15,
      "setSizeB": 17
    },
    "halfAAlsoFits": [
      "basketball",
      "cricket",
      "football",
      "American football",
      "baseball",
      "field hockey",
      "handball",
      "netball",
      "rugby",
      "snooker",
      "squash",
      "water polo",
      "polo",
      "softball"
    ],
    "halfBAlsoFits": [
      "swimming",
      "tennis",
      "archery",
      "athletics",
      "badminton",
      "boxing",
      "diving",
      "fencing",
      "gymnastics",
      "judo",
      "skateboarding",
      "surfing",
      "table tennis",
      "taekwondo",
      "weightlifting",
      "wrestling"
    ],
    "hintA": "A sport is usually played on grass.",
    "hintB": "A sport is not a combat sport."
  }
];
