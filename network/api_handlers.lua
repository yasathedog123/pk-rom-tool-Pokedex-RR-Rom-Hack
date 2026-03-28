-- API Handlers - HTTP endpoint handlers for the Pokemon Memory Reader API
-- Contains handlers for /party, /status, and root documentation endpoints

local json = require("modules.dkjson")
local httpUtils = require("network.http_utils")
local dataConverter = require("network.data_converter")
local htmlDocs = require("network.html_docs")
local pokedexHtml = require("network.pokedex_html")

local ApiHandlers = {}

-- Lazy-initialized Pokedex reader (created on first request)
local pokedexReader = nil

function ApiHandlers.handlePartyRequest(client, memoryReader)
    if not memoryReader.isInitialized then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json", 
            json.encode({error = "Memory reader not initialized", message = "No Pokemon game detected"}))
        return
    end
    
    if not memoryReader.partyReader then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
            json.encode({error = "Party reader not available", message = "Game not supported"}))
        return
    end
    
    -- Get party data
    local party = dataConverter.getPartyData(memoryReader)
    
    -- Send JSON response
    local jsonData = json.encode(party, {indent = true})
    httpUtils.sendResponse(client, 200, "OK", "application/json", jsonData)
end

function ApiHandlers.handleEnemyPartyRequest(client, memoryReader)
    if not memoryReader.isInitialized then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
            json.encode({error = "Memory reader not initialized", message = "No Pokemon game detected"}))
        return
    end

    if not memoryReader.partyReader then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
            json.encode({error = "Party reader not available", message = "Game not supported"}))
        return
    end

    local enemyParty = dataConverter.getEnemyPartyData(memoryReader)
    local jsonData = json.encode(enemyParty, {indent = true})
    httpUtils.sendResponse(client, 200, "OK", "application/json", jsonData)
end

function ApiHandlers.handleStatusRequest(client, memoryReader, port, host, isRunning)
    local gameInfo = memoryReader.currentGame and memoryReader.currentGame.gameInfo or nil
    local gameUtils = require("utils.gameutils")
    local romHash = memoryReader.currentGame and gameUtils.getROMHash() or ""
    local profileId = ""
    if gameInfo then
        local name = (gameInfo.gameName or ""):lower():gsub("[^%w]+", "-")
        local version = (gameInfo.versionColor or ""):lower():gsub("[^%w]+", "-")
        profileId = (name ~= "" and version ~= "") and (name .. "-" .. version) or name
    end

    local status = {
        server = {
            running = isRunning,
            port = port,
            host = host,
            type = "HTTP Server"
        },
        game = {
            initialized = memoryReader.isInitialized,
            name = gameInfo and gameInfo.gameName or "None",
            generation = gameInfo and gameInfo.generation or 0,
            version = gameInfo and gameInfo.versionColor or "None",
            engine = gameInfo and tostring(gameInfo.generation or "") or "",
            profileId = profileId,
            romHash = romHash or ""
        },
        soullink = memoryReader.soulLink and {
            initialized = memoryReader.soulLink.baselineEstablished,
            trackedPokemon = memoryReader.soulLink:getState().summary.trackedPokemon,
            routeCount = memoryReader.soulLink:getState().summary.routeCount,
            eventCount = memoryReader.soulLink:getState().summary.eventCount,
        } or {
            initialized = false,
            trackedPokemon = 0,
            routeCount = 0,
            eventCount = 0,
        }
    }
    
    local jsonData = json.encode(status, {indent = true})
    httpUtils.sendResponse(client, 200, "OK", "application/json", jsonData)
end

function ApiHandlers.handleRootRequest(client, port, host)
    local html = htmlDocs.getDocumentationHtml(port, host)
    httpUtils.sendResponse(client, 200, "OK", "text/html", html)
end

function ApiHandlers.handleSoulLinkStateRequest(client, memoryReader)
    if not memoryReader.isInitialized then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
            json.encode({error = "Memory reader not initialized", message = "No Pokemon game detected"}))
        return
    end

    if not memoryReader.soulLink then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
            json.encode({error = "Soul Link not available"}))
        return
    end

    local state = memoryReader.soulLink:getState()
    local jsonData = json.encode(state, {indent = true})
    httpUtils.sendResponse(client, 200, "OK", "application/json", jsonData)
end

function ApiHandlers.handleSoulLinkEventsRequest(client, memoryReader)
    if not memoryReader.isInitialized then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
            json.encode({error = "Memory reader not initialized", message = "No Pokemon game detected"}))
        return
    end

    if not memoryReader.soulLink then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
            json.encode({error = "Soul Link not available"}))
        return
    end

    local events = memoryReader.soulLink:getRecentEvents()
    local jsonData = json.encode(events, {indent = true})
    httpUtils.sendResponse(client, 200, "OK", "application/json", jsonData)
end

function ApiHandlers.handlePlayerRequest(client, memoryReader)
    if not memoryReader.isInitialized then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json", 
            json.encode({error = "Memory reader not initialized", message = "No Pokemon game detected"}))
        return
    end
    
    if not memoryReader.playerReader then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
            json.encode({error = "Player reader not available", message = "Game not supported"}))
        return
    end
    
    -- Update trainer info to get latest data
    memoryReader.playerReader:updateTrainerInfo()
    
    -- Get trainer info
    local trainerInfo = memoryReader.playerReader.trainerInfo
    
    -- Send JSON response
    local jsonData = json.encode(trainerInfo, {indent = true})
    httpUtils.sendResponse(client, 200, "OK", "application/json", jsonData)
end

function ApiHandlers.handleBagRequest(client, memoryReader)
    if not memoryReader.isInitialized then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json", 
            json.encode({error = "Memory reader not initialized", message = "No Pokemon game detected"}))
        return
    end
    
    -- Get bag data
    local bag = dataConverter.getBagData(memoryReader)
    
    -- Send JSON response
    local jsonData = json.encode(bag, {indent = true})
    httpUtils.sendResponse(client, 200, "OK", "application/json", jsonData)
end

function ApiHandlers.handleSetMoneyRequest(client, memoryReader, body)
    if not memoryReader.isInitialized then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json", 
            json.encode({error = "Memory reader not initialized", message = "No Pokemon game detected"}))
        return
    end
    
    if not memoryReader.playerReader then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
            json.encode({error = "Player reader not available", message = "Game not supported"}))
        return
    end
    
    -- Parse JSON body to get the amount
    local requestData, err = json.decode(body)
    if not requestData then
        httpUtils.sendResponse(client, 400, "Bad Request", "application/json",
            json.encode({error = "Invalid JSON", message = "Failed to parse request body"}))
        return
    end
    
    -- Validate amount parameter
    local amount = requestData.amount
    if not amount or type(amount) ~= "number" then
        httpUtils.sendResponse(client, 400, "Bad Request", "application/json",
            json.encode({error = "Invalid amount", message = "Amount must be a number"}))
        return
    end
    
    -- Validate amount range (assuming Pokemon games use 32-bit unsigned integers)
    if amount < 0 or amount > 999999 then
        httpUtils.sendResponse(client, 400, "Bad Request", "application/json",
            json.encode({error = "Amount out of range", message = "Amount must be between 0 and 999999"}))
        return
    end
    
    -- Call the setMoney function
    local success, errorMsg = pcall(function()
        memoryReader.playerReader:setMoney(amount)
    end)
    
    if not success then
        httpUtils.sendResponse(client, 500, "Internal Server Error", "application/json",
            json.encode({error = "Failed to set money", message = errorMsg or "Unknown error"}))
        return
    end
    
    -- Return success response
    httpUtils.sendResponse(client, 200, "OK", "application/json",
        json.encode({success = true, message = "Money set to " .. amount}))
end

function ApiHandlers.handlePokedexApiRequest(client, memoryReader)
    if not memoryReader.isInitialized then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
            json.encode({error = "Memory reader not initialized", message = "No Pokemon game detected"}))
        return
    end

    local gameData = memoryReader.currentGame
    if not gameData or not gameData.pokedexOffsets then
        httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
            json.encode({error = "Pokedex not supported", message = "This game does not have Pokedex offset data configured"}))
        return
    end

    -- Create or reuse the Pokedex reader based on game generation
    if not pokedexReader then
        local generation = gameData.gameInfo.generation
        if generation == "CFRU" or generation == 3 then
            local CFRUPokedexReader = require("readers.pokedex.cfrupokedexreader")
            pokedexReader = CFRUPokedexReader:new()
        else
            httpUtils.sendResponse(client, 503, "Service Unavailable", "application/json",
                json.encode({error = "Pokedex not supported", message = "Pokedex reading is only supported for Gen 3 and CFRU games"}))
            return
        end
    end

    local data = pokedexReader:readPokedex()
    if not data then
        httpUtils.sendResponse(client, 500, "Internal Server Error", "application/json",
            json.encode({error = "Failed to read Pokedex data"}))
        return
    end

    local jsonData = json.encode(data, {indent = true})
    httpUtils.sendResponse(client, 200, "OK", "application/json", jsonData)
end

function ApiHandlers.handlePokedexPageRequest(client, port, host)
    local html = pokedexHtml.getPokedexPage(port, host)
    httpUtils.sendResponse(client, 200, "OK", "text/html", html)
end

return ApiHandlers