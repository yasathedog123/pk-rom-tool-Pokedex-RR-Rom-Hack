-- CFRU Pokedex Reader
-- Reads Pokedex caught/seen bit flags from SaveBlock1 for CFRU-based ROM hacks (e.g. Radical Red)
-- Arrays are in SaveBlock1: dexSeenFlags at +0x0310, dexCaughtFlags at +0x038D
-- Indexed by (NationalDexNo - 1), NOT by internal species ID.

local gameUtils = require("utils.gameutils")
local pokemonData = require("readers.pokemondata")
local charmaps = require("data.charmaps")
local constants = require("data.constants")
local encounters = require("data.encounters")

local CFRUPokedexReader = {}
CFRUPokedexReader.__index = CFRUPokedexReader

-- Well-known National Dex numbers for Gen 4+ Pokemon (species ID ≠ NatDex)
-- Gen 1-3 (species 1-386): speciesID == NatDex in CFRU
local NAME_TO_NATDEX = {
    -- Gen 4
    ["Turtwig"]=387,["Grotle"]=388,["Torterra"]=389,["Chimchar"]=390,["Monferno"]=391,
    ["Infernape"]=392,["Piplup"]=393,["Prinplup"]=394,["Empoleon"]=395,["Starly"]=396,
    ["Staravia"]=397,["Staraptor"]=398,["Bidoof"]=399,["Bibarel"]=400,["Kricketot"]=401,
    ["Kricketune"]=402,["Shinx"]=403,["Luxio"]=404,["Luxray"]=405,["Budew"]=406,
    ["Roserade"]=407,["Cranidos"]=408,["Rampardos"]=409,["Shieldon"]=410,["Bastiodon"]=411,
    ["Burmy"]=412,["Wormadam"]=413,["Mothim"]=414,["Combee"]=415,["Vespiquen"]=416,
    ["Pachirisu"]=417,["Buizel"]=418,["Floatzel"]=419,["Cherubi"]=420,["Cherrim"]=421,
    ["Shellos"]=422,["Gastrodon"]=423,["Ambipom"]=424,["Drifloon"]=425,["Drifblim"]=426,
    ["Buneary"]=427,["Lopunny"]=428,["Mismagius"]=429,["Honchkrow"]=430,["Glameow"]=431,
    ["Purugly"]=432,["Chingling"]=433,["Stunky"]=434,["Skuntank"]=435,["Bronzor"]=436,
    ["Bronzong"]=437,["Bonsly"]=438,["Mime Jr."]=439,["Happiny"]=440,["Chatot"]=441,
    ["Spiritomb"]=442,["Gible"]=443,["Gabite"]=444,["Garchomp"]=445,["Munchlax"]=446,
    ["Riolu"]=447,["Lucario"]=448,["Hippopotas"]=449,["Hippowdon"]=450,["Skorupi"]=451,
    ["Drapion"]=452,["Croagunk"]=453,["Toxicroak"]=454,["Carnivine"]=455,["Finneon"]=456,
    ["Lumineon"]=457,["Mantyke"]=458,["Snover"]=459,["Abomasnow"]=460,["Weavile"]=461,
    ["Magnezone"]=462,["Lickilicky"]=463,["Rhyperior"]=464,["Tangrowth"]=465,["Electivire"]=466,
    ["Magmortar"]=467,["Togekiss"]=468,["Yanmega"]=469,["Leafeon"]=470,["Glaceon"]=471,
    ["Gliscor"]=472,["Mamoswine"]=473,["Porygon-Z"]=474,["Gallade"]=475,["Probopass"]=476,
    ["Dusknoir"]=477,["Froslass"]=478,["Rotom"]=479,["Uxie"]=480,["Mesprit"]=481,
    ["Azelf"]=482,["Dialga"]=483,["Palkia"]=484,["Heatran"]=485,["Regigigas"]=486,
    ["Giratina"]=487,["Cresselia"]=488,["Phione"]=489,["Manaphy"]=490,["Darkrai"]=491,
    ["Shaymin"]=492,["Arceus"]=493,
    -- Gen 5
    ["Victini"]=494,["Snivy"]=495,["Servine"]=496,["Serperior"]=497,["Tepig"]=498,
    ["Pignite"]=499,["Emboar"]=500,["Oshawott"]=501,["Dewott"]=502,["Samurott"]=503,
    ["Patrat"]=504,["Watchog"]=505,["Lillipup"]=506,["Herdier"]=507,["Stoutland"]=508,
    ["Purrloin"]=509,["Liepard"]=510,["Pansage"]=511,["Simisage"]=512,["Pansear"]=513,
    ["Simisear"]=514,["Panpour"]=515,["Simipour"]=516,["Munna"]=517,["Musharna"]=518,
    ["Pidove"]=519,["Tranquill"]=520,["Unfezant"]=521,["Blitzle"]=522,["Zebstrika"]=523,
    ["Roggenrola"]=524,["Boldore"]=525,["Gigalith"]=526,["Woobat"]=527,["Swoobat"]=528,
    ["Drilbur"]=529,["Excadrill"]=530,["Audino"]=531,["Timburr"]=532,["Gurdurr"]=533,
    ["Conkeldurr"]=534,["Tympole"]=535,["Palpitoad"]=536,["Seismitoad"]=537,["Throh"]=538,
    ["Sawk"]=539,["Sewaddle"]=540,["Swadloon"]=541,["Leavanny"]=542,["Venipede"]=543,
    ["Whirlipede"]=544,["Scolipede"]=545,["Cottonee"]=546,["Whimsicott"]=547,["Petilil"]=548,
    ["Lilligant"]=549,["Basculin"]=550,["Sandile"]=551,["Krokorok"]=552,["Krookodile"]=553,
    ["Darumaka"]=554,["Darmanitan"]=555,["Maractus"]=556,["Dwebble"]=557,["Crustle"]=558,
    ["Scraggy"]=559,["Scrafty"]=560,["Sigilyph"]=561,["Yamask"]=562,["Cofagrigus"]=563,
    ["Tirtouga"]=564,["Carracosta"]=565,["Archen"]=566,["Archeops"]=567,["Trubbish"]=568,
    ["Garbodor"]=569,["Zorua"]=570,["Zoroark"]=571,["Minccino"]=572,["Cinccino"]=573,
    ["Gothita"]=574,["Gothorita"]=575,["Gothitelle"]=576,["Solosis"]=577,["Duosion"]=578,
    ["Reuniclus"]=579,["Ducklett"]=580,["Swanna"]=581,["Vanillite"]=582,["Vanillish"]=583,
    ["Vanilluxe"]=584,["Deerling"]=585,["Sawsbuck"]=586,["Emolga"]=587,["Karrablast"]=588,
    ["Escavalier"]=589,["Foongus"]=590,["Amoonguss"]=591,["Frillish"]=592,["Jellicent"]=593,
    ["Alomomola"]=594,["Joltik"]=595,["Galvantula"]=596,["Ferroseed"]=597,["Ferrothorn"]=598,
    ["Klink"]=599,["Klang"]=600,["Klinklang"]=601,["Tynamo"]=602,["Eelektrik"]=603,
    ["Eelektross"]=604,["Elgyem"]=605,["Beheeyem"]=606,["Litwick"]=607,["Lampent"]=608,
    ["Chandelure"]=609,["Axew"]=610,["Fraxure"]=611,["Haxorus"]=612,["Cubchoo"]=613,
    ["Beartic"]=614,["Cryogonal"]=615,["Shelmet"]=616,["Accelgor"]=617,["Stunfisk"]=618,
    ["Mienfoo"]=619,["Mienshao"]=620,["Druddigon"]=621,["Golett"]=622,["Golurk"]=623,
    ["Pawniard"]=624,["Bisharp"]=625,["Bouffalant"]=626,["Rufflet"]=627,["Braviary"]=628,
    ["Vullaby"]=629,["Mandibuzz"]=630,["Heatmor"]=631,["Durant"]=632,["Deino"]=633,
    ["Zweilous"]=634,["Hydreigon"]=635,["Larvesta"]=636,["Volcarona"]=637,["Cobalion"]=638,
    ["Terrakion"]=639,["Virizion"]=640,["Tornadus"]=641,["Thundurus"]=642,["Reshiram"]=643,
    ["Zekrom"]=644,["Landorus"]=645,["Kyurem"]=646,["Keldeo"]=647,["Meloetta"]=648,
    ["Genesect"]=649,
    -- Gen 6
    ["Chespin"]=650,["Quilladin"]=651,["Chesnaught"]=652,["Fennekin"]=653,["Braixen"]=654,
    ["Delphox"]=655,["Froakie"]=656,["Frogadier"]=657,["Greninja"]=658,["Bunnelby"]=659,
    ["Diggersby"]=660,["Fletchling"]=661,["Fletchinder"]=662,["Talonflame"]=663,["Scatterbug"]=664,
    ["Spewpa"]=665,["Vivillon"]=666,["Litleo"]=667,["Pyroar"]=668,["Flabebe"]=669,
    ["Floette"]=670,["Florges"]=671,["Skiddo"]=672,["Gogoat"]=673,["Pancham"]=674,
    ["Pangoro"]=675,["Furfrou"]=676,["Espurr"]=677,["Meowstic"]=678,["Honedge"]=679,
    ["Doublade"]=680,["Aegislash"]=681,["Spritzee"]=682,["Aromatisse"]=683,["Swirlix"]=684,
    ["Slurpuff"]=685,["Inkay"]=686,["Malamar"]=687,["Binacle"]=688,["Barbaracle"]=689,
    ["Skrelp"]=690,["Dragalge"]=691,["Clauncher"]=692,["Clawitzer"]=693,["Helioptile"]=694,
    ["Heliolisk"]=695,["Tyrunt"]=696,["Tyrantrum"]=697,["Amaura"]=698,["Aurorus"]=699,
    ["Sylveon"]=700,["Hawlucha"]=701,["Dedenne"]=702,["Carbink"]=703,["Goomy"]=704,
    ["Sliggoo"]=705,["Goodra"]=706,["Klefki"]=707,["Phantump"]=708,["Trevenant"]=709,
    ["Pumpkaboo"]=710,["Gourgeist"]=711,["Bergmite"]=712,["Avalugg"]=713,["Noibat"]=714,
    ["Noivern"]=715,["Xerneas"]=716,["Yveltal"]=717,["Zygarde"]=718,["Diancie"]=719,
    ["Hoopa"]=720,["Volcanion"]=721,
    -- Gen 7
    ["Rowlet"]=722,["Dartrix"]=723,["Decidueye"]=724,["Litten"]=725,["Torracat"]=726,
    ["Incineroar"]=727,["Popplio"]=728,["Brionne"]=729,["Primarina"]=730,["Pikipek"]=731,
    ["Trumbeak"]=732,["Toucannon"]=733,["Yungoos"]=734,["Gumshoos"]=735,["Grubbin"]=736,
    ["Charjabug"]=737,["Vikavolt"]=738,["Crabrawler"]=739,["Crabominable"]=740,
    ["Oricorio"]=741,["Cutiefly"]=742,["Ribombee"]=743,["Rockruff"]=744,["Lycanroc"]=745,
    ["Wishiwashi"]=746,["Mareanie"]=747,["Toxapex"]=748,["Mudbray"]=749,["Mudsdale"]=750,
    ["Dewpider"]=751,["Araquanid"]=752,["Fomantis"]=753,["Lurantis"]=754,["Morelull"]=755,
    ["Shiinotic"]=756,["Salandit"]=757,["Salazzle"]=758,["Stufful"]=759,["Bewear"]=760,
    ["Bounsweet"]=761,["Steenee"]=762,["Tsareena"]=763,["Comfey"]=764,["Oranguru"]=765,
    ["Passimian"]=766,["Wimpod"]=767,["Golisopod"]=768,["Sandygast"]=769,["Palossand"]=770,
    ["Pyukumuku"]=771,["Type: Null"]=772,["Silvally"]=773,["Minior"]=774,["Komala"]=775,
    ["Turtonator"]=776,["Togedemaru"]=777,["Mimikyu"]=778,["Bruxish"]=779,["Drampa"]=780,
    ["Dhelmise"]=781,["Jangmo-o"]=782,["Hakamo-o"]=783,["Kommo-o"]=784,["Tapu Koko"]=785,
    ["Tapu Lele"]=786,["Tapu Bulu"]=787,["Tapu Fini"]=788,["Cosmog"]=789,["Cosmoem"]=790,
    ["Solgaleo"]=791,["Lunala"]=792,["Nihilego"]=793,["Buzzwole"]=794,["Pheromosa"]=795,
    ["Xurkitree"]=796,["Celesteela"]=797,["Kartana"]=798,["Guzzlord"]=799,["Necrozma"]=800,
    ["Magearna"]=801,["Marshadow"]=802,["Poipole"]=803,["Naganadel"]=804,["Stakataka"]=805,
    ["Blacephalon"]=806,["Zeraora"]=807,["Meltan"]=808,["Melmetal"]=809,
    -- Gen 8
    ["Grookey"]=810,["Thwackey"]=811,["Rillaboom"]=812,["Scorbunny"]=813,["Raboot"]=814,
    ["Cinderace"]=815,["Sobble"]=816,["Drizzile"]=817,["Inteleon"]=818,["Skwovet"]=819,
    ["Greedent"]=820,["Rookidee"]=821,["Corvisquire"]=822,["Corviknight"]=823,
    ["Blipbug"]=824,["Dottler"]=825,["Orbeetle"]=826,["Nickit"]=827,["Thievul"]=828,
    ["Gossifleur"]=829,["Eldegoss"]=830,["Wooloo"]=831,["Dubwool"]=832,["Chewtle"]=833,
    ["Drednaw"]=834,["Yamper"]=835,["Boltund"]=836,["Rolycoly"]=837,["Carkol"]=838,
    ["Coalossal"]=839,["Applin"]=840,["Flapple"]=841,["Appletun"]=842,["Silicobra"]=843,
    ["Sandaconda"]=844,["Cramorant"]=845,["Arrokuda"]=846,["Barraskewda"]=847,
    ["Toxel"]=848,["Toxtricity"]=849,["Sizzlipede"]=850,["Centiskorch"]=851,
    ["Clobbopus"]=852,["Grapploct"]=853,["Sinistea"]=854,["Polteageist"]=855,
    ["Hatenna"]=856,["Hattrem"]=857,["Hatterene"]=858,["Impidimp"]=859,["Morgrem"]=860,
    ["Grimmsnarl"]=861,["Obstagoon"]=862,["Perrserker"]=863,["Cursola"]=864,
    ["Sirfetch'd"]=865,["Mr. Rime"]=866,["Runerigus"]=867,["Milcery"]=868,
    ["Alcremie"]=869,["Falinks"]=870,["Pincurchin"]=871,["Snom"]=872,["Frosmoth"]=873,
    ["Stonjourner"]=874,["Eiscue"]=875,["Indeedee"]=876,["Morpeko"]=877,["Cufant"]=878,
    ["Copperajah"]=879,["Dracozolt"]=880,["Arctozolt"]=881,["Dracovish"]=882,
    ["Arctovish"]=883,["Duraludon"]=884,["Dreepy"]=885,["Drakloak"]=886,["Dragapult"]=887,
    ["Zacian"]=888,["Zamazenta"]=889,["Eternatus"]=890,["Kubfu"]=891,["Urshifu"]=892,
    ["Zarude"]=893,["Regieleki"]=894,["Regidrago"]=895,["Glastrier"]=896,
    ["Spectrier"]=897,["Calyrex"]=898,
}

-- Reverse lookup: NatDex → name (built from NAME_TO_NATDEX + constants)
local NATDEX_TO_NAME = {}

function CFRUPokedexReader:new()
    local obj = setmetatable({}, CFRUPokedexReader)
    obj.pokedexData = nil

    -- Build NatDex→name from constants (Gen 1-3, NatDex 1-386)
    if constants.pokemonData and constants.pokemonData.species then
        for i = 2, #constants.pokemonData.species do
            NATDEX_TO_NAME[i - 1] = constants.pokemonData.species[i]
        end
    end
    -- Add Gen 4+ from hardcoded lookup
    for name, natDex in pairs(NAME_TO_NATDEX) do
        if not NATDEX_TO_NAME[natDex] then
            NATDEX_TO_NAME[natDex] = name
        end
    end

    return obj
end

function CFRUPokedexReader:getSaveBlock1Addr()
    local gameData = MemoryReader.currentGame
    local tp = gameData.trainerPointers
    local sb1 = gameUtils.hexToNumber(tp.saveBlock1)
    if tp.isPointer then
        sb1 = gameUtils.read32(sb1)
    end
    return sb1
end

-- Read species name from ROM using CFRU method
function CFRUPokedexReader:readSpeciesNameCFRU(speciesId)
    local gameData = MemoryReader.currentGame
    local addr = gameData.addresses.speciesNameTable
    if not addr then return "Unknown" end
    local base = gameUtils.hexToNumber(addr)
    local pointer = base + ((speciesId - 1) * 11)
    local bytes = gameUtils.readBytesCFRU(pointer, 11)
    return charmaps.decryptText(bytes)
end

-- Resolve species ID → NatDex number
function CFRUPokedexReader:speciesIdToNatDex(speciesId)
    if speciesId <= 386 then return speciesId end
    local name = self:readSpeciesNameCFRU(speciesId)
    if name and NAME_TO_NATDEX[name] then
        return NAME_TO_NATDEX[name]
    end
    return nil
end

-- Check if bit at bitIndex is set in byteArray (0-indexed bit)
function CFRUPokedexReader:isBitSet(byteArray, bitIndex)
    local byteIdx = math.floor(bitIndex / 8) + 1
    local bitOff = bitIndex % 8
    if byteIdx > #byteArray then return false end
    return (byteArray[byteIdx] & (1 << bitOff)) ~= 0
end

function CFRUPokedexReader:readPokedex()
    if not MemoryReader.isInitialized or not MemoryReader.currentGame then
        return nil
    end

    local gameData = MemoryReader.currentGame
    local pokedexConfig = gameData.pokedexOffsets
    if not pokedexConfig then return nil end

    local sb1Addr = self:getSaveBlock1Addr()
    local domain = "EWRAM"

    -- Read from SaveBlock1: dexSeenFlags and dexCaughtFlags
    local seenAddr = sb1Addr + pokedexConfig.seenOffsetSB1
    local caughtAddr = sb1Addr + pokedexConfig.caughtOffsetSB1
    local flagBytes = pokedexConfig.flagBytes
    local totalSpecies = pokedexConfig.totalSpecies

    local caughtBytes = gameUtils.readBytes(caughtAddr, flagBytes, domain)
    local seenBytes = gameUtils.readBytes(seenAddr, flagBytes, domain)

    -- Build entries indexed by National Dex number
    -- Bit index = (NatDex - 1)
    local entries = {}
    local caughtCount = 0
    local seenCount = 0

    for natDex = 1, totalSpecies do
        local bitIdx = natDex - 1  -- CFRU indexes by NatDex-1
        local caught = self:isBitSet(caughtBytes, bitIdx)
        local seen = self:isBitSet(seenBytes, bitIdx)
        if caught then seen = true end

        -- Get name from NatDex lookup
        local name = NATDEX_TO_NAME[natDex]
        if not name then
            name = string.format("Pokemon #%d", natDex)
        end

        -- Look up encounter/location data
        local encounterData = encounters[name]

        local entry = {
            natDex = natDex,
            name = name,
            caught = caught,
            seen = seen,
            locations = encounterData,
        }

        if caught then
            caughtCount = caughtCount + 1
        end
        if seen then
            seenCount = seenCount + 1
        end

        table.insert(entries, entry)
    end

    self.pokedexData = {
        totalSpecies = #entries,
        caught = caughtCount,
        seen = seenCount,
        uncaught = #entries - caughtCount,
        unseen = #entries - seenCount,
        completionPercent = #entries > 0 and math.floor((caughtCount / #entries) * 1000) / 10 or 0,
        caughtAddr = string.format("0x%X", caughtAddr),
        seenAddr = string.format("0x%X", seenAddr),
        entries = entries,
    }

    return self.pokedexData
end

return CFRUPokedexReader
