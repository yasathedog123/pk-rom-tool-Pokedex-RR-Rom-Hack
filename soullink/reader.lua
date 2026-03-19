local gameUtils = require("utils.gameutils")
local charmaps = require("data.charmaps")
local pokemonData = require("readers.pokemondata")

local SoulLinkReader = {}
SoulLinkReader.__index = SoulLinkReader

function SoulLinkReader:new()
    local obj = {
        speciesNameCache = {},
        speciesMetaCache = {},
    }
    setmetatable(obj, SoulLinkReader)
    return obj
end

function SoulLinkReader:readNickname(baseAddr)
    local bytes = gameUtils.readBytes(baseAddr + 8, 10)
    return charmaps.decryptText(bytes)
end

function SoulLinkReader:getSpeciesName(speciesId)
    if not speciesId or speciesId <= 0 then
        return "Unknown"
    end
    if not self.speciesNameCache[speciesId] then
        local gameData = MemoryReader.currentGame
        if gameData and gameData.gameInfo and gameData.gameInfo.generation == "CFRU" then
            local speciesNameTableAddr = gameUtils.hexToNumber(gameData.addresses.speciesNameTable)
            local pointer = speciesNameTableAddr + ((speciesId - 1) * 11)
            local bytes = gameUtils.readBytesCFRU(pointer, 11)
            self.speciesNameCache[speciesId] = charmaps.decryptText(bytes)
        else
            self.speciesNameCache[speciesId] = pokemonData.readSpeciesName(speciesId)
        end
    end
    return self.speciesNameCache[speciesId]
end

function SoulLinkReader:getSpeciesMeta(speciesId)
    if not speciesId or speciesId <= 0 then
        return {species = "Unknown", types = {}}
    end

    if not self.speciesMetaCache[speciesId] then
        local species = self:getSpeciesName(speciesId)
        local types = {}
        local speciesData
        local gameData = MemoryReader.currentGame
        if gameData and gameData.gameInfo and gameData.gameInfo.generation == "CFRU" then
            local speciesDataTableAddr = gameUtils.hexToNumber(gameData.addresses.speciesDataTable)
            local speciesAddr = speciesDataTableAddr + ((speciesId - 1) * 28)
            local bytes = gameUtils.readBytesCFRU(speciesAddr, 28)
            speciesData = {
                type1 = bytes[7],
                type2 = bytes[8],
            }
        else
            speciesData = pokemonData.readSpeciesData(speciesId)
        end
        if speciesData then
            local type1Name = pokemonData.getTypeName(speciesData.type1)
            local type2Name = pokemonData.getTypeName(speciesData.type2)
            if type1Name and type1Name ~= "Unknown" then
                table.insert(types, type1Name)
            end
            if type2Name and type2Name ~= "Unknown" and type2Name ~= type1Name then
                table.insert(types, type2Name)
            end
        end

        self.speciesMetaCache[speciesId] = {
            species = species,
            types = types,
        }
    end

    return self.speciesMetaCache[speciesId]
end

function SoulLinkReader:readCFRUParty(memoryReader)
    local gameData = memoryReader.currentGame
    local partyAddr = gameUtils.hexToNumber(gameData.addresses.partyAddr)
    local snapshot = {}

    for slot = 1, 6 do
        local pokemonStart = partyAddr + 100 * (slot - 1)
        local personality = gameUtils.read32(pokemonStart)
        if personality ~= 0 then
            local speciesID = gameUtils.read16(pokemonStart + 32)
            local speciesMeta = self:getSpeciesMeta(speciesID)
            local nickname = self:readNickname(pokemonStart)
            local origins = gameUtils.read16(pokemonStart + 70)
            local otid = gameUtils.read32(pokemonStart + 4)
            local tid = otid & 0xFFFF
            local sid = (otid >> 16) & 0xFFFF
            local shinyValue = (personality ~ otid) ~ (tid ~ sid)

            snapshot[personality] = {
                slot = slot,
                personality = personality,
                speciesId = speciesID,
                species = speciesMeta.species,
                nickname = nickname,
                level = gameUtils.read8(pokemonStart + 84),
                currentHP = gameUtils.read16(pokemonStart + 86),
                maxHP = gameUtils.read16(pokemonStart + 88),
                metLocation = gameUtils.read8(pokemonStart + 69),
                metLevel = gameUtils.getBits(origins, 0, 7),
                isShiny = (shinyValue & 0xFFFF) < 8,
                types = speciesMeta.types,
            }
        end
    end

    return snapshot
end

function SoulLinkReader:readFallbackParty(memoryReader)
    local rawParty = memoryReader.getPartyData() or {}
    local snapshot = {}

    for slot = 1, 6 do
        local pokemon = rawParty[slot]
        if pokemon and pokemon.speciesID and pokemon.speciesID > 0 and pokemon.personality and pokemon.personality > 0 then
            local types = {}
            if pokemon.type1Name and pokemon.type1Name ~= "Unknown" then
                table.insert(types, pokemon.type1Name)
            end
            if pokemon.type2Name and pokemon.type2Name ~= "Unknown" and pokemon.type2Name ~= pokemon.type1Name then
                table.insert(types, pokemon.type2Name)
            end

            snapshot[pokemon.personality] = {
                slot = slot,
                personality = pokemon.personality,
                speciesId = pokemon.speciesID,
                species = pokemon.speciesName,
                nickname = pokemon.nickname,
                level = pokemon.level,
                currentHP = pokemon.curHP,
                maxHP = pokemon.maxHP,
                metLocation = pokemon.metLocation,
                metLevel = pokemon.metLevel,
                isShiny = pokemon.isShiny or false,
                types = types,
            }
        end
    end

    return snapshot
end

function SoulLinkReader:readParty(memoryReader)
    if not memoryReader or not memoryReader.currentGame then
        return {}
    end

    if memoryReader.currentGame.gameInfo.generation == "CFRU" then
        return self:readCFRUParty(memoryReader)
    end

    return self:readFallbackParty(memoryReader)
end

return SoulLinkReader
