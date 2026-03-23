local gameUtils = require("utils.gameutils")

local BattleReader = {}
BattleReader.__index = BattleReader

function BattleReader:new()
    local obj = setmetatable({}, BattleReader)
    obj.structSize = nil
    return obj
end

function BattleReader:detectStructSize(baseAddr, enemyParty)
    if self.structSize then return self.structSize end
    if not enemyParty then return nil end

    local enemySpecies = {}
    for _, mon in ipairs(enemyParty) do
        if mon and mon.speciesID and mon.speciesID > 0 then
            enemySpecies[mon.speciesID] = true
        end
    end

    local bestSize = nil
    for size = 56, 128, 4 do
        local candidate = gameUtils.read16(baseAddr + size)
        if candidate > 0 and enemySpecies[candidate] then
            local thirdSlot = gameUtils.read16(baseAddr + 2 * size)
            if thirdSlot == 0 then
                self.structSize = size
                console.log("BattleReader: detected gBattleMons struct size = " .. size)
                return size
            end
            if not bestSize then
                bestSize = size
            end
        end
    end

    if bestSize then
        self.structSize = bestSize
        console.log("BattleReader: detected gBattleMons struct size = " .. bestSize .. " (doubles?)")
        return bestSize
    end

    return nil
end

function BattleReader:resetStructSize()
    self.structSize = nil
end

function BattleReader:getActiveSlots(gBattleMonsAddr, playerParty, enemyParty)
    if not gBattleMonsAddr then return nil end

    local baseAddr = gameUtils.hexToNumber(gBattleMonsAddr)
    if not baseAddr then return nil end

    local playerSpecies = gameUtils.read16(baseAddr)
    if playerSpecies == 0 then return nil end

    local size = self:detectStructSize(baseAddr, enemyParty)

    local playerSlot = nil
    if playerParty then
        for i, mon in ipairs(playerParty) do
            if mon and mon.speciesID == playerSpecies then
                playerSlot = i
                break
            end
        end
    end

    local enemySlot = nil
    if size and enemyParty then
        local enemySpecies = gameUtils.read16(baseAddr + size)
        if enemySpecies > 0 then
            for i, mon in ipairs(enemyParty) do
                if mon and mon.speciesID == enemySpecies then
                    enemySlot = i
                    break
                end
            end
        end
    end

    return {
        playerSlot = playerSlot,
        enemySlot = enemySlot,
    }
end

return BattleReader
